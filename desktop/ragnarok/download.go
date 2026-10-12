package main

import (
	"archive/zip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"hash/crc32"
	"html"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

type clientFile struct {
	Name  string `json:"name"`
	Page  string `json:"page"`
	Bytes int64  `json:"bytes"`
	Hash  string `json:"sha256"`
}

var anchor = regexp.MustCompile(`(?is)<a\b[^>]*\bid\s*=\s*["']downloadButton["'][^>]*>`)
var href = regexp.MustCompile(`(?is)\bhref\s*=\s*["']([^"']+)["']`)

func safeArchiveName(value string) (string, error) {
	normalized := strings.ReplaceAll(value, "\\", "/")
	if strings.HasPrefix(normalized, "/") || strings.Contains(normalized, ":") || strings.ContainsRune(normalized, 0) {
		return "", errors.New("caminho inesperado no pacote")
	}
	for _, part := range strings.Split(normalized, "/") {
		if part == ".." {
			return "", errors.New("caminho fora da pasta do cliente")
		}
	}
	return filepath.FromSlash(normalized), nil
}

func fileDigest(path string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()
	h := sha256.New()
	if _, err = io.Copy(h, file); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

func prepareClient(base, lockFile string, progress func(string)) error {
	data, err := os.ReadFile(lockFile)
	if err != nil {
		return err
	}
	var manifest struct {
		Files []clientFile `json:"files"`
	}
	if err = json.Unmarshal(data, &manifest); err != nil {
		return err
	}
	if err = os.MkdirAll(base, 0755); err != nil {
		return err
	}
	for _, entry := range manifest.Files {
		progress("Verificando " + entry.Name + "…")
		filename := filepath.Join(base, entry.Name)
		if info, e := os.Stat(filename); e == nil {
			digest, e := fileDigest(filename)
			if e != nil {
				return e
			}
			if info.Size() != entry.Bytes || digest != entry.Hash {
				return fmt.Errorf("o arquivo existente %s foi preservado porque difere do cliente original", entry.Name)
			}
			continue
		} else if !os.IsNotExist(e) {
			return e
		}
		if err = downloadClientFile(entry, filename, progress); err != nil {
			return err
		}
	}
	for _, name := range []string{"BGM.zip", "dll_exe.zip"} {
		marker := filepath.Join(base, "."+name+".extracted")
		if _, err = os.Stat(marker); err == nil {
			continue
		}
		progress("Instalando músicas e arquivos do cliente…")
		if err = extractClientZip(filepath.Join(base, name), base); err != nil {
			return err
		}
		if err = os.WriteFile(marker, []byte("Verified client archive extracted.\n"), 0644); err != nil {
			return err
		}
	}
	return nil
}

func downloadClientFile(entry clientFile, destination string, progress func(string)) error {
	client := &http.Client{Timeout: 90 * time.Second}
	response, err := client.Get(entry.Page)
	if err != nil {
		return err
	}
	page, err := io.ReadAll(io.LimitReader(response.Body, 3<<20))
	response.Body.Close()
	if err != nil {
		return err
	}
	tag := anchor.FindString(string(page))
	match := href.FindStringSubmatch(tag)
	if len(match) != 2 {
		return errors.New("o espelho não forneceu o link do cliente; tente novamente mais tarde")
	}
	target, err := url.Parse(html.UnescapeString(match[1]))
	if err != nil || target.Scheme != "https" || target.User != nil {
		return errors.New("link HTTPS inválido no espelho")
	}
	return downloadRanges(client, target.String(), entry, destination, progress)
}

func downloadRanges(client *http.Client, target string, entry clientFile, destination string, progress func(string)) error {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	partial := destination + ".part"
	file, err := os.OpenFile(partial, os.O_CREATE|os.O_RDWR|os.O_TRUNC, 0644)
	if err != nil {
		return err
	}
	defer file.Close()
	if err = file.Truncate(entry.Bytes); err != nil {
		return err
	}
	const chunk = int64(16 << 20)
	jobs := make(chan int64, 4)
	results := make(chan error, 4)
	var workers sync.WaitGroup
	for worker := 0; worker < 4; worker++ {
		workers.Add(1)
		go func() {
			defer workers.Done()
			for offset := range jobs {
				end := offset + chunk - 1
				if end >= entry.Bytes {
					end = entry.Bytes - 1
				}
				position := offset
				var last error
				for attempt := 0; attempt < 4 && position <= end; attempt++ {
					request, _ := http.NewRequestWithContext(ctx, "GET", target, nil)
					request.Header.Set("Range", fmt.Sprintf("bytes=%d-%d", position, end))
					r, e := client.Do(request)
					if e != nil {
						last = e
						continue
					}
					expected := fmt.Sprintf("bytes %d-%d/%d", position, end, entry.Bytes)
					if r.StatusCode != 206 || r.Header.Get("Content-Range") != expected {
						r.Body.Close()
						last = errors.New("o espelho retornou uma faixa de download inválida")
						continue
					}
					buffer := make([]byte, 1<<20)
					for position <= end {
						size := int64(len(buffer))
						if remaining := end - position + 1; remaining < size {
							size = remaining
						}
						count, readErr := r.Body.Read(buffer[:size])
						if count > 0 {
							written, writeErr := file.WriteAt(buffer[:count], position)
							position += int64(written)
							if writeErr != nil {
								last = writeErr
								break
							}
							if written != count {
								last = io.ErrShortWrite
								break
							}
						}
						if readErr != nil {
							last = readErr
							break
						}
					}
					r.Body.Close()
				}
				if position != end+1 {
					results <- fmt.Errorf("download incompleto de %s: %w", entry.Name, last)
					cancel()
					return
				}
			}
		}()
	}
	go func() {
	dispatch:
		for offset := int64(0); offset < entry.Bytes; offset += chunk {
			select {
			case jobs <- offset:
			case <-ctx.Done():
				break dispatch
			}
		}
		close(jobs)
		workers.Wait()
		close(results)
	}()
	progress("Baixando " + entry.Name + ". Aguarde o download completo…")
	var failure error
	for e := range results {
		if failure == nil {
			failure = e
		}
	}
	if failure != nil {
		return failure
	}
	if err = file.Sync(); err != nil {
		return err
	}
	if err = file.Close(); err != nil {
		return err
	}
	digest, err := fileDigest(partial)
	if err != nil {
		return err
	}
	if digest != entry.Hash {
		return errors.New("o download falhou na verificação SHA-256")
	}
	return os.Rename(partial, destination)
}

func extractClientZip(source, base string) error {
	reader, err := zip.OpenReader(source)
	if err != nil {
		return err
	}
	defer reader.Close()
	for _, entry := range reader.File {
		if _, err = safeArchiveName(entry.Name); err != nil {
			return err
		}
		if entry.Mode()&os.ModeSymlink != 0 {
			return errors.New("link inesperado no cliente")
		}
	}
	for _, entry := range reader.File {
		relative, _ := safeArchiveName(entry.Name)
		target := filepath.Join(base, relative)
		if entry.FileInfo().IsDir() {
			if err = os.MkdirAll(target, 0755); err != nil {
				return err
			}
			continue
		}
		if _, e := os.Lstat(target); e == nil {
			if matchesArchiveEntry(target, entry) {
				continue
			}
			return fmt.Errorf("arquivo existente preservado na extração: %s", entry.Name)
		} else if !os.IsNotExist(e) {
			return e
		}
		if err = os.MkdirAll(filepath.Dir(target), 0755); err != nil {
			return err
		}
		if err := writeArchiveEntry(entry, target, 0644); err != nil {
			return err
		}
	}
	return nil
}

func matchesArchiveEntry(path string, entry *zip.File) bool {
	info, err := os.Lstat(path)
	if err != nil || !info.Mode().IsRegular() || info.Size() != int64(entry.UncompressedSize64) {
		return false
	}
	file, err := os.Open(path)
	if err != nil {
		return false
	}
	defer file.Close()
	digest := crc32.NewIEEE()
	_, err = io.Copy(digest, file)
	return err == nil && digest.Sum32() == entry.CRC32
}

// Commit complete, CRC-verified files atomically, so interrupted installs can resume.
func writeArchiveEntry(entry *zip.File, target string, mode os.FileMode) error {
	source, err := entry.Open()
	if err != nil {
		return err
	}
	defer source.Close()
	staged, err := os.CreateTemp(filepath.Dir(target), ".quest-extract-*")
	if err != nil {
		return err
	}
	defer os.Remove(staged.Name())
	defer staged.Close()
	if err = staged.Chmod(mode); err != nil {
		return err
	}
	if _, err = io.Copy(staged, source); err != nil {
		return err
	}
	if err = staged.Sync(); err != nil {
		return err
	}
	if err = staged.Close(); err != nil {
		return err
	}
	if _, err = os.Lstat(target); err == nil {
		if matchesArchiveEntry(target, entry) {
			return nil
		}
		return fmt.Errorf("arquivo existente preservado: %s", entry.Name)
	} else if !os.IsNotExist(err) {
		return err
	}
	return os.Rename(staged.Name(), target)
}
