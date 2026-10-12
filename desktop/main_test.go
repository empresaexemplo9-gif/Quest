package main

import (
	"io"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestEmbeddedGameAndOriginIsolation(t *testing.T) {
	handler, err := clientHandler(filepath.Join(t.TempDir(), "save.json"), "https://quest-game-plum.vercel.app")
	if err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{"/", "/game/core.js", "/game/tablet.css", "/icons/apple-touch-icon.png"} {
		request := httptest.NewRequest("GET", "http://"+address+path, nil)
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		if response.Code != 200 || response.Body.Len() == 0 {
			t.Fatalf("missing embedded asset %s: %d", path, response.Code)
		}
	}
	for _, header := range []string{"Origin", "Host"} {
		request := httptest.NewRequest("POST", "http://"+address+"/api/local-save", strings.NewReader(`{"format":"eridan-save","world":{}}`))
		request.Header.Set("Content-Type", "application/json")
		if header == "Host" {
			request.Host = "evil.invalid"
		} else {
			request.Header.Set(header, "https://evil.invalid")
		}
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		if response.Code != 403 {
			t.Fatalf("cross-origin %s not rejected", header)
		}
	}
}

func TestLocalSaveAtomicReplacementAndLimits(t *testing.T) {
	filename := filepath.Join(t.TempDir(), "save.json")
	handler, _ := clientHandler(filename, "https://quest-game-plum.vercel.app")
	request := func(method, body string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, "http://"+address+"/api/local-save", strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w
	}
	for _, body := range []string{`{"format":"eridan-save","world":{"schema":1}}`, `{"format":"eridan-save","world":{"schema":1,"revision":2}}`} {
		if response := request("POST", body); response.Code != 200 {
			t.Fatal(response.Code, response.Body.String())
		}
		saved, _ := os.ReadFile(filename)
		if string(saved) != body {
			t.Fatal("save replacement lost data")
		}
	}
	if response := request("POST", `{"format":"other"}`); response.Code != 400 {
		t.Fatal("invalid save accepted")
	}
	if response := request("POST", strings.Repeat("x", (2<<20)+1)); response.Code != 413 {
		t.Fatal("size limit not enforced")
	}
	response := request("GET", "")
	saved, _ := io.ReadAll(response.Body)
	if !strings.Contains(string(saved), `"revision":2`) {
		t.Fatal("failed writes destroyed previous save")
	}
}

func TestRejectInvalidOnlineOrigins(t *testing.T) {
	for _, origin := range []string{"http://quest-game-plum.vercel.app", "https://user:pass@example.invalid", "https://example.invalid/secret", "https://example.invalid?token=secret"} {
		if _, err := clientHandler("unused", origin); err == nil {
			t.Fatal("invalid origin accepted", origin)
		}
	}
}
