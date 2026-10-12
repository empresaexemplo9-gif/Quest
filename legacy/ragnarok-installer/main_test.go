package main

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func makeArchive(t *testing.T, names []string) []byte {
	t.Helper()
	var buffer bytes.Buffer
	w := zip.NewWriter(&buffer)
	for _, name := range names {
		f, err := w.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := f.Write([]byte("fixture")); err != nil {
			t.Fatal(err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	return buffer.Bytes()
}

func TestVerifiedHTTPSDownloadAndExtraction(t *testing.T) {
	payload := makeArchive(t, []string{"ragexe.exe", "data/clientinfo.xml"})
	digest := sha256.Sum256(payload)
	var manifest release
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/releases/game.json" {
			json.NewEncoder(w).Encode(manifest)
			return
		}
		if r.URL.Path == "/client.zip" {
			w.Write(payload)
			return
		}
		http.NotFound(w, r)
	}))
	defer server.Close()
	manifest = release{Ready: true, Version: "test-fixture", PacketVersion: 20211103, Server: "server.example.invalid", Client: &clientRelease{URL: server.URL + "/client.zip", SHA256: hex.EncodeToString(digest[:]), EXE: "ragexe.exe"}}
	// The test trusts only httptest's own CA; production TLS verification stays enabled.
	client := server.Client()
	actual, err := fetchRelease(client, server.URL)
	if err != nil {
		t.Fatal(err)
	}
	root := t.TempDir()
	archive := filepath.Join(root, "client.zip")
	if err := download(client, *actual.Client, archive); err != nil {
		t.Fatal(err)
	}
	if err := extract(archive, filepath.Join(root, "game")); err != nil {
		t.Fatal(err)
	}
	if data, err := os.ReadFile(filepath.Join(root, "game", "ragexe.exe")); err != nil || string(data) != "fixture" {
		t.Fatalf("Missing extracted fixture: %s, %v", data, err)
	}
}

func TestCorruptDownloadRejectedAndRemoved(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("tampered")) }))
	defer server.Close()
	target := filepath.Join(t.TempDir(), "download.zip")
	err := download(server.Client(), clientRelease{URL: server.URL, SHA256: strings.Repeat("0", 64)}, target)
	if err == nil {
		t.Fatal("Corrupt download was accepted")
	}
	if _, err := os.Stat(target); !os.IsNotExist(err) {
		t.Fatal("Corrupt archive was retained")
	}
}

func TestUnsafeArchiveRejectedBeforeWriting(t *testing.T) {
	for _, names := range [][]string{{"../escape.exe"}, {"/escape.exe"}, {"C:/escape.exe"}, {"data\\escape.exe"}, {"CON.exe"}, {"ragexe.exe", "RAGEXE.EXE"}, {"safe.txt", "../escape.exe"}} {
		t.Run(strings.Join(names, ","), func(t *testing.T) {
			root := t.TempDir()
			archive := filepath.Join(root, "client.zip")
			if err := os.WriteFile(archive, makeArchive(t, names), 0600); err != nil {
				t.Fatal(err)
			}
			destination := filepath.Join(root, "game")
			if err := extract(archive, destination); err == nil {
				t.Fatal("Unsafe archive accepted")
			}
			if _, err := os.Stat(destination); !os.IsNotExist(err) {
				t.Fatal("Files written before archive validation")
			}
		})
	}
}

func TestSymbolicLinkArchiveRejected(t *testing.T) {
	var payload bytes.Buffer
	w := zip.NewWriter(&payload)
	header := &zip.FileHeader{Name: "link"}
	header.SetMode(os.ModeSymlink | 0777)
	f, err := w.CreateHeader(header)
	if err != nil {
		t.Fatal(err)
	}
	f.Write([]byte("../outside"))
	w.Close()
	root := t.TempDir()
	archive := filepath.Join(root, "client.zip")
	os.WriteFile(archive, payload.Bytes(), 0600)
	if err := extract(archive, filepath.Join(root, "game")); err == nil {
		t.Fatal("Symlink accepted")
	}
}

func TestUnreleasedAndIncompatibleClientRejected(t *testing.T) {
	if err := validateRelease(release{Ready: false}); err == nil {
		t.Fatal("Unreleased client accepted")
	}
	if err := validateRelease(release{Ready: true, Version: "1", Server: "host", PacketVersion: 20240320, Client: &clientRelease{URL: "https://example.invalid/game.zip", SHA256: strings.Repeat("a", 64), EXE: "ragexe.exe"}}); err == nil {
		t.Fatal("Incompatible client accepted")
	}
	for _, value := range []string{"http://example.invalid/game.zip", "https://user:password@example.invalid/game.zip", "file:///tmp/game.zip"} {
		if err := httpsURL(value); err == nil {
			t.Fatal("Unsafe URL accepted:", value)
		}
	}
}
