package main

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"
)

func TestServerRejectsUnavailableAndAcceptsNativeWorld(t *testing.T) {
	state := `{"engine":"rAthena","packetver":20211103,"nativeReady":true,"assetsReady":true}`
	backend := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/readiness" {
			t.Error("unexpected path", r.URL.Path)
		}
		fmt.Fprint(w, state)
	}))
	defer backend.Close()
	a := &app{dataDir: t.TempDir(), transport: backend.Client().Transport.(*http.Transport)}
	if err := a.selectServer(backend.URL); err != nil {
		t.Fatal(err)
	}
	state = `{"engine":"original-client","nativeReady":true,"assetsReady":true,"packetver":20211103}`
	if err := a.selectServer(backend.URL); err == nil {
		t.Fatal("accepted the previous game as a native shared world")
	}
	state = `{"engine":"rAthena","packetver":20211103,"nativeReady":false,"assetsReady":true}`
	if err := a.selectServer(backend.URL); err == nil {
		t.Fatal("accepted disconnected native server")
	}
	a.transport = http.DefaultTransport.(*http.Transport)
	if err := a.selectServer(backend.URL); err == nil {
		t.Fatal("accepted TLS without trusted CA")
	}
}

func TestPublicServerRequiresHTTPS(t *testing.T) {
	for _, value := range []string{"http://example.com", "https://user:pass@example.com", "https://example.com/path", "https://example.com?token=x", "file:///etc/passwd"} {
		if _, err := normalizeServer(value); err == nil {
			t.Errorf("accepted %s", value)
		}
	}
	for _, value := range []string{"https://example.com", "http://192.168.1.10:13080", "http://127.0.0.1:13080"} {
		if _, err := normalizeServer(value); err != nil {
			t.Errorf("rejected %s: %v", value, err)
		}
	}
}

func TestRangeDownloadRetriesAndVerifiesHash(t *testing.T) {
	data := bytes.Repeat([]byte("client-data"), 20000)
	sum := sha256.Sum256(data)
	first := true
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var start, end int
		fmt.Sscanf(r.Header.Get("Range"), "bytes=%d-%d", &start, &end)
		if first {
			first = false
			w.WriteHeader(503)
			return
		}
		w.Header().Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end, len(data)))
		w.Header().Set("Content-Length", strconv.Itoa(end-start+1))
		w.WriteHeader(206)
		w.Write(data[start : end+1])
	}))
	defer server.Close()
	entry := clientFile{Name: "data.grf", Bytes: int64(len(data)), Hash: hex.EncodeToString(sum[:])}
	path := filepath.Join(t.TempDir(), entry.Name)
	if err := downloadRanges(server.Client(), server.URL, entry, path, func(string) {}); err != nil {
		t.Fatal(err)
	}
	read, err := os.ReadFile(path)
	if err != nil || !bytes.Equal(read, data) {
		t.Fatal("download was not verified and installed")
	}
	entry.Hash = strings.Repeat("0", 64)
	wrong := filepath.Join(t.TempDir(), entry.Name)
	if err := downloadRanges(server.Client(), server.URL, entry, wrong, func(string) {}); err == nil {
		t.Fatal("accepted corrupted digest")
	}
	if _, err := os.Stat(wrong); !os.IsNotExist(err) {
		t.Fatal("unverified data was installed")
	}
}

func TestFailedParallelRangesReturnWithoutDeadlock(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(503) }))
	defer server.Close()
	done := make(chan error, 1)
	go func() {
		done <- downloadRanges(server.Client(), server.URL, clientFile{Name: "broken", Bytes: 200 << 20}, filepath.Join(t.TempDir(), "broken"), func(string) {})
	}()
	select {
	case err := <-done:
		if err == nil {
			t.Fatal("accepted invalid ranges")
		}
	case <-time.After(5 * time.Second):
		t.Fatal("download workers deadlocked after failure")
	}
}

func TestExtractionResumesAndPreservesDifferentFiles(t *testing.T) {
	base := t.TempDir()
	archive := filepath.Join(base, "test.zip")
	file, err := os.Create(archive)
	if err != nil {
		t.Fatal(err)
	}
	writer := zip.NewWriter(file)
	for name, content := range map[string]string{"BGM/song.mp3": "music", "System/config.lua": "settings"} {
		entry, _ := writer.Create(name)
		fmt.Fprint(entry, content)
	}
	writer.Close()
	file.Close()
	target := filepath.Join(base, "client")
	for i := 0; i < 2; i++ {
		if err := extractClientZip(archive, target); err != nil {
			t.Fatal("cannot resume installation:", err)
		}
	}
	song := filepath.Join(target, "BGM/song.mp3")
	os.WriteFile(song, []byte("alter"), 0644)
	if err := extractClientZip(archive, target); err == nil {
		t.Fatal("accepted different existing file of same size")
	}
	content, _ := os.ReadFile(song)
	if string(content) != "alter" {
		t.Fatal("overwrote user file")
	}
	malicious := filepath.Join(base, "malicious.zip")
	file, _ = os.Create(malicious)
	writer = zip.NewWriter(file)
	entry, _ := writer.Create("../escape")
	fmt.Fprint(entry, "bad")
	writer.Close()
	file.Close()
	if err := extractClientZip(malicious, target); err == nil {
		t.Fatal("accepted archive traversal")
	}
}

func TestLocalClientRejectsCrossOriginRequests(t *testing.T) {
	a := &app{origin: "http://127.0.0.1:38777"}
	for _, origin := range []string{"https://evil.example", "http://localhost:38777"} {
		r := httptest.NewRequest("POST", a.origin+"/api/server", strings.NewReader(`{}`))
		r.Header.Set("Origin", origin)
		w := httptest.NewRecorder()
		a.ServeHTTP(w, r)
		if w.Code != 403 {
			t.Fatal("accepted cross-origin connection configuration")
		}
	}
}

func TestCorruptArchiveDoesNotLeaveInstalledPartialFile(t *testing.T) {
	base := t.TempDir()
	var buffer bytes.Buffer
	writer := zip.NewWriter(&buffer)
	entry, _ := writer.CreateHeader(&zip.FileHeader{Name: "System/config.lua", Method: zip.Store})
	entry.Write([]byte("asset-data"))
	writer.Close()
	corrupted := bytes.Replace(buffer.Bytes(), []byte("asset-data"), []byte("asset-fail"), 1)
	archive := filepath.Join(base, "corrupt.zip")
	os.WriteFile(archive, corrupted, 0600)
	target := filepath.Join(base, "client")
	if err := extractClientZip(archive, target); err == nil {
		t.Fatal("accepted CRC-corrupted client file")
	}
	if _, err := os.Stat(filepath.Join(target, "System/config.lua")); !os.IsNotExist(err) {
		t.Fatal("installed a partial file after checksum failure")
	}
	remaining, _ := filepath.Glob(filepath.Join(target, "System/.quest-extract-*"))
	if len(remaining) != 0 {
		t.Fatal("left temporary extraction files")
	}
}
