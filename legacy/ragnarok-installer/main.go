package main

import (
	"archive/zip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"time"
)

// Set by the release builder after the public portal URL exists.
var portalURL string

const maxClientBytes int64 = 8 << 30

type clientRelease struct {
	URL    string `json:"url"`
	SHA256 string `json:"sha256"`
	EXE    string `json:"exe"`
}

type release struct {
	Ready         bool           `json:"ready"`
	Version       string         `json:"version"`
	PacketVersion int            `json:"packetVersion"`
	Server        string         `json:"server"`
	Client        *clientRelease `json:"client"`
}

func httpsURL(value string) error {
	u, err := url.Parse(value)
	if err != nil || u.Scheme != "https" || u.Hostname() == "" || u.User != nil || u.Fragment != "" {
		return errors.New("O endereço de download deve usar HTTPS, sem credenciais")
	}
	return nil
}

func validateRelease(r release) error {
	if !r.Ready {
		return errors.New("O download de Quest ainda não foi liberado. Acompanhe a página oficial")
	}
	if r.Client == nil || r.Version == "" || r.Server == "" || r.PacketVersion != 20211103 {
		return errors.New("A versão do cliente ainda não está configurada para este servidor")
	}
	if err := httpsURL(r.Client.URL); err != nil {
		return err
	}
	digest, err := hex.DecodeString(r.Client.SHA256)
	if err != nil || len(digest) != sha256.Size {
		return errors.New("A verificação do cliente não foi configurada")
	}
	if !safePath(r.Client.EXE) || !strings.HasSuffix(strings.ToLower(r.Client.EXE), ".exe") {
		return errors.New("Executável do jogo inválido")
	}
	return nil
}

func newHTTPClient() *http.Client {
	return &http.Client{
		Timeout: 30 * time.Minute,
		CheckRedirect: func(req *http.Request, previous []*http.Request) error {
			if len(previous) >= 5 {
				return errors.New("Muitos redirecionamentos no download")
			}
			return httpsURL(req.URL.String())
		},
	}
}

func fetchRelease(client *http.Client, site string) (release, error) {
	var r release
	if err := httpsURL(site); err != nil {
		return r, err
	}
	res, err := client.Get(strings.TrimRight(site, "/") + "/releases/game.json")
	if err != nil {
		return r, fmt.Errorf("Não foi possível consultar a página de Quest: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return r, errors.New("A página de downloads está indisponível. Tente novamente mais tarde")
	}
	if err := json.NewDecoder(io.LimitReader(res.Body, 64<<10)).Decode(&r); err != nil {
		return r, errors.New("A página de downloads retornou uma versão inválida")
	}
	return r, validateRelease(r)
}

func download(client *http.Client, info clientRelease, destination string) error {
	if err := httpsURL(info.URL); err != nil {
		return err
	}
	res, err := client.Get(info.URL)
	if err != nil {
		return fmt.Errorf("Falha no download: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("O download do cliente retornou HTTP %d", res.StatusCode)
	}
	file, err := os.OpenFile(destination, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		return err
	}
	hash := sha256.New()
	written, err := io.Copy(io.MultiWriter(file, hash), io.LimitReader(res.Body, maxClientBytes+1))
	closeErr := file.Close()
	if err != nil || closeErr != nil || written > maxClientBytes {
		os.Remove(destination)
		return errors.New("Não foi possível concluir o download do cliente")
	}
	if !strings.EqualFold(hex.EncodeToString(hash.Sum(nil)), info.SHA256) {
		os.Remove(destination)
		return errors.New("A verificação do download falhou. Nenhum arquivo será instalado")
	}
	return nil
}

var windowsReserved = regexp.MustCompile(`(?i)^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)`)

func safePath(name string) bool {
	if name == "" || strings.ContainsAny(name, "\\:\x00") || strings.HasPrefix(name, "/") || path.Clean(name) != name || name == "." {
		return false
	}
	for _, part := range strings.Split(name, "/") {
		if part == ".." || strings.HasSuffix(part, ".") || strings.HasSuffix(part, " ") || windowsReserved.MatchString(part) {
			return false
		}
	}
	return true
}

func extract(filename, destination string) error {
	archive, err := zip.OpenReader(filename)
	if err != nil {
		return errors.New("O pacote do cliente não é um ZIP válido")
	}
	defer archive.Close()
	seen := make(map[string]bool)
	var total uint64
	for _, file := range archive.File {
		name := strings.TrimSuffix(file.Name, "/")
		key := strings.ToLower(name)
		if !safePath(name) || seen[key] || file.Mode()&os.ModeSymlink != 0 || (!file.FileInfo().IsDir() && !file.Mode().IsRegular()) {
			return errors.New("O pacote contém um caminho inválido, duplicado ou um link")
		}
		seen[key] = true
		if file.UncompressedSize64 > uint64(maxClientBytes)-total {
			return errors.New("O pacote do cliente excede o tamanho permitido")
		}
		total += file.UncompressedSize64
	}
	for _, file := range archive.File {
		name := strings.TrimSuffix(file.Name, "/")
		target := filepath.Join(destination, filepath.FromSlash(name))
		if file.FileInfo().IsDir() {
			if err := os.MkdirAll(target, 0700); err != nil {
				return err
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(target), 0700); err != nil {
			return err
		}
		input, err := file.Open()
		if err != nil {
			return err
		}
		output, err := os.OpenFile(target, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
		if err != nil {
			input.Close()
			return err
		}
		_, copyErr := io.Copy(output, input)
		input.Close()
		closeErr := output.Close()
		if copyErr != nil || closeErr != nil {
			return errors.New("Falha ao extrair o pacote do jogo")
		}
	}
	return nil
}

func shellQuote(value string) string { return "'" + strings.ReplaceAll(value, "'", "'\"'\"'") + "'" }

func install(r release) (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	var target string
	switch runtime.GOOS {
	case "windows":
		base := os.Getenv("LOCALAPPDATA")
		if base == "" {
			return "", errors.New("Não foi possível localizar a pasta de aplicativos do Windows")
		}
		target = filepath.Join(base, "Quest")
	case "darwin":
		os.Setenv("PATH", "/opt/homebrew/bin:/usr/local/bin:/Applications/Wine Stable.app/Contents/Resources/wine/bin:"+os.Getenv("PATH"))
		if _, err := exec.LookPath("wine"); err != nil {
			if _, err := os.Stat("/Applications/Wine Stable.app/Contents/Resources/wine/bin/wine"); err != nil {
				return "", errors.New("Quest utiliza o cliente Windows. Instale o Wine no macOS antes de continuar; esta compatibilidade precisa ser validada para sua versão do sistema")
			}
		}
		target = filepath.Join(home, "Applications", "Quest.app")
	default:
		return "", errors.New("Este instalador destina-se ao Windows e ao macOS")
	}
	if _, err := os.Stat(target); !os.IsNotExist(err) {
		return "", errors.New("Quest já está instalado. A instalação existente foi preservada")
	}
	if err := os.MkdirAll(filepath.Dir(target), 0700); err != nil {
		return "", err
	}
	stage, err := os.MkdirTemp(filepath.Dir(target), ".quest-install-")
	if err != nil {
		return "", err
	}
	defer os.RemoveAll(stage)
	archive := filepath.Join(stage, "client.zip")
	if err := download(newHTTPClient(), *r.Client, archive); err != nil {
		return "", err
	}
	candidate := filepath.Join(stage, "Quest")
	game := candidate
	if runtime.GOOS == "darwin" {
		game = filepath.Join(candidate, "Contents", "Resources", "game")
	}
	if err := os.MkdirAll(game, 0700); err != nil {
		return "", err
	}
	if err := extract(archive, game); err != nil {
		return "", err
	}
	if info, err := os.Stat(filepath.Join(game, filepath.FromSlash(r.Client.EXE))); err != nil || !info.Mode().IsRegular() {
		return "", errors.New("O executável indicado não foi encontrado no pacote")
	}
	if runtime.GOOS == "darwin" {
		macos := filepath.Join(candidate, "Contents", "MacOS")
		if err := os.MkdirAll(macos, 0700); err != nil {
			return "", err
		}
		launcher := "#!/bin/bash\nset -e\nquest_game=\"$(cd \"$(dirname \"$0\")/../Resources/game\" && pwd)\"\nexport PATH=\"/opt/homebrew/bin:/usr/local/bin:/Applications/Wine Stable.app/Contents/Resources/wine/bin:$PATH\"\nexport WINEPREFIX=\"$HOME/Library/Application Support/Quest/Wine\"\ncd \"$quest_game\"/" + shellQuote(path.Dir(r.Client.EXE)) + "\nexec wine " + shellQuote(path.Base(r.Client.EXE)) + "\n"
		if err := os.WriteFile(filepath.Join(macos, "Quest"), []byte(launcher), 0700); err != nil {
			return "", err
		}
		plist := `<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>CFBundleExecutable</key><string>Quest</string><key>CFBundleIdentifier</key><string>online.quest.game</string><key>CFBundleName</key><string>Quest</string><key>CFBundlePackageType</key><string>APPL</string></dict></plist>`
		if err := os.WriteFile(filepath.Join(candidate, "Contents", "Info.plist"), []byte(plist), 0600); err != nil {
			return "", err
		}
	}
	if err := os.Rename(candidate, target); err != nil {
		return "", err
	}
	if runtime.GOOS == "windows" {
		// Build a per-user Start Menu shortcut without requiring administrator rights.
		// Pass paths via environment variables so PowerShell never interprets path text.
		script := `$shortcut = [IO.Path]::Combine([Environment]::GetFolderPath('Programs'), 'Quest.lnk'); if (Test-Path $shortcut) { throw 'Atalho existente preservado' }; $ws = New-Object -ComObject WScript.Shell; $link = $ws.CreateShortcut($shortcut); $link.TargetPath = $env:QUEST_EXE; $link.WorkingDirectory = $env:QUEST_DIRECTORY; $link.Save()`
		cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script)
		cmd.Env = append(os.Environ(), "QUEST_EXE="+filepath.Join(target, filepath.FromSlash(r.Client.EXE)), "QUEST_DIRECTORY="+filepath.Dir(filepath.Join(target, filepath.FromSlash(r.Client.EXE))))
		if err := cmd.Run(); err != nil {
			return target, fmt.Errorf("Jogo instalado em %s; não foi possível criar o atalho no menu Iniciar", target)
		}
	}
	return target, nil
}

func notify(message string, failed bool) {
	fmt.Println(message)
	if runtime.GOOS == "darwin" {
		icon := "note"
		if failed {
			icon = "caution"
		}
		_ = exec.Command("osascript", "-e", "display dialog "+strconv.Quote(message)+" with title \"Quest\" buttons {\"OK\"} default button \"OK\" with icon "+icon).Run()
	} else if runtime.GOOS == "windows" {
		cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show($env:QUEST_MESSAGE, 'Quest') | Out-Null")
		cmd.Env = append(os.Environ(), "QUEST_MESSAGE="+message)
		_ = cmd.Run()
	}
}

func run() error {
	if portalURL == "" {
		return errors.New("A página oficial de Quest ainda não foi vinculada a este instalador")
	}
	r, err := fetchRelease(newHTTPClient(), portalURL)
	if err != nil {
		return err
	}
	target, err := install(r)
	if err != nil {
		return err
	}
	notify("Quest foi instalado em "+target+". Abra o jogo pelo menu Iniciar ou pela pasta Aplicativos", false)
	return nil
}

func main() {
	if err := run(); err != nil {
		notify(err.Error(), true)
		os.Exit(1)
	}
}
