// Original Eridan client. Embedded assets run locally; online actions use HTTPS.
package main

import (
	"crypto/sha256"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"
)

//go:embed assets
var assets embed.FS

var portalURL = "https://quest-game-plum.vercel.app"

const version = "1.3.0"

var address = "127.0.0.1:38477"
var errInstalled = errors.New("installed and launched")

func main() {
	if err := run(); err != nil {
		log.Print(err)
		notify("Não foi possível iniciar Éridan. " + err.Error())
		os.Exit(1)
	}
}

func run() error {
	if len(os.Args) > 1 && os.Args[1] == "--version" {
		fmt.Println("Cinzas de Éridan " + version)
		return nil
	}
	if port := os.Getenv("ERIDAN_PORT"); port != "" {
		value, err := strconv.Atoi(port)
		if err != nil || value < 1024 || value > 65535 {
			return errors.New("porta local inválida")
		}
		address = "127.0.0.1:" + port
	}
	if err := install(); err != nil {
		if errors.Is(err, errInstalled) {
			return nil
		}
		return err
	}
	base, err := os.UserConfigDir()
	if err != nil {
		return err
	}
	data := filepath.Join(base, "CinzasDeEridan")
	if err = os.MkdirAll(data, 0700); err != nil {
		return err
	}
	listener, err := net.Listen("tcp", address)
	if err != nil {
		client := &http.Client{Timeout: time.Second}
		response, probeErr := client.Get("http://" + address + "/api/health")
		if probeErr == nil {
			defer response.Body.Close()
			var status struct {
				Client  string `json:"client"`
				Version string `json:"version"`
			}
			if json.NewDecoder(response.Body).Decode(&status) == nil && status.Client == "eridan-desktop" {
				if status.Version != version {
					return errors.New("feche a versão anterior de Éridan antes de abrir esta atualização")
				}
				return openBrowser("http://" + address + "/")
			}
		}
		return errors.New("a porta do cliente está ocupada por outro programa")
	}
	handler, err := clientHandler(filepath.Join(data, "jornada.json"), portalURL)
	if err != nil {
		listener.Close()
		return err
	}
	server := &http.Server{Handler: handler, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 20 * time.Second, IdleTimeout: 60 * time.Second}
	go func() {
		if err := openBrowser("http://" + address + "/"); err != nil {
			log.Print(err)
		}
	}()
	return server.Serve(listener)
}

func clientHandler(savePath, origin string) (http.Handler, error) {
	target, err := url.Parse(origin)
	if err != nil || target.Scheme != "https" || target.Host == "" || target.User != nil || (target.Path != "" && target.Path != "/") || target.RawQuery != "" || target.Fragment != "" {
		return nil, errors.New("endereço HTTPS do mundo inválido")
	}
	target.Path = ""
	static, err := fs.Sub(assets, "assets")
	if err != nil {
		return nil, err
	}
	proxy := &httputil.ReverseProxy{
		Rewrite: func(r *httputil.ProxyRequest) {
			r.SetURL(target)
			r.Out.Header.Set("Origin", target.Scheme+"://"+target.Host)
			r.Out.Header.Del("X-Forwarded-Host")
			r.Out.Header.Del("Forwarded")
		},
		Transport: &http.Transport{Proxy: http.ProxyFromEnvironment, DialContext: (&net.Dialer{Timeout: 5 * time.Second}).DialContext, TLSHandshakeTimeout: 5 * time.Second, ResponseHeaderTimeout: 10 * time.Second},
		ModifyResponse: func(r *http.Response) error {
			// Session cookies remain HttpOnly and SameSite on this loopback origin.
			cookies := r.Header.Values("Set-Cookie")
			r.Header.Del("Set-Cookie")
			for _, cookie := range cookies {
				pieces := strings.Split(cookie, ";")
				clean := []string{}
				for _, piece := range pieces {
					attribute := strings.TrimSpace(piece)
					if strings.EqualFold(attribute, "secure") || strings.HasPrefix(strings.ToLower(attribute), "domain=") {
						continue
					}
					clean = append(clean, piece)
				}
				r.Header.Add("Set-Cookie", strings.Join(clean, ";"))
			}
			return nil
		},
		ErrorHandler: func(w http.ResponseWriter, r *http.Request, e error) {
			writeJSON(w, 503, map[string]any{"error": "O mundo compartilhado está sem conexão. A jornada solo continua disponível."})
		},
	}
	var lock sync.Mutex
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Host != address && r.Host != strings.Replace(address, "127.0.0.1", "localhost", 1) {
			http.Error(w, "Host inválido", 403)
			return
		}
		requestOrigin := r.Header.Get("Origin")
		if requestOrigin != "" && requestOrigin != "http://"+r.Host {
			http.Error(w, "Origem inválida", 403)
			return
		}
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'")
		if strings.HasPrefix(r.URL.Path, "/api/") {
			w.Header().Set("Cache-Control", "no-store")
		}
		switch r.URL.Path {
		case "/api/health":
			if r.Method != "GET" {
				http.Error(w, "Método inválido", 405)
				return
			}
			ctx := r.Context()
			request, _ := http.NewRequestWithContext(ctx, "GET", target.String()+"/api/health", nil)
			client := &http.Client{Timeout: 3 * time.Second}
			online := false
			if response, e := client.Do(request); e == nil {
				var status struct {
					Online bool `json:"online"`
				}
				if response.StatusCode == 200 && json.NewDecoder(io.LimitReader(response.Body, 4096)).Decode(&status) == nil {
					online = status.Online
				}
				response.Body.Close()
			}
			_, saveErr := os.Stat(savePath)
			writeJSON(w, 200, map[string]any{"client": "eridan-desktop", "desktop": true, "online": online, "version": version, "saveAvailable": saveErr == nil})
		case "/api/local-save":
			lock.Lock()
			defer lock.Unlock()
			if r.Method == "GET" {
				data, e := os.ReadFile(savePath)
				if e != nil {
					http.Error(w, "Nenhuma jornada salva", 404)
					return
				}
				w.Header().Set("Content-Type", "application/json")
				w.Write(data)
				return
			}
			if r.Method != "POST" {
				http.Error(w, "Método inválido", 405)
				return
			}
			if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
				http.Error(w, "JSON obrigatório", 415)
				return
			}
			data, e := io.ReadAll(http.MaxBytesReader(w, r.Body, 2<<20))
			if e != nil {
				http.Error(w, "Arquivo grande demais", 413)
				return
			}
			var save struct {
				Format string          `json:"format"`
				World  json.RawMessage `json:"world"`
			}
			if json.Unmarshal(data, &save) != nil || save.Format != "eridan-save" || len(save.World) < 2 {
				http.Error(w, "Jornada inválida", 400)
				return
			}
			temporary, e := os.CreateTemp(filepath.Dir(savePath), ".jornada-")
			if e != nil {
				http.Error(w, "Falha ao salvar", 500)
				return
			}
			name := temporary.Name()
			defer os.Remove(name)
			if _, e = temporary.Write(data); e == nil {
				e = temporary.Sync()
			}
			closeErr := temporary.Close()
			if e == nil {
				e = closeErr
			}
			if e == nil {
				e = replaceSave(name, savePath)
			}
			if e != nil {
				http.Error(w, "Falha ao salvar", 500)
				return
			}
			writeJSON(w, 200, map[string]any{"saved": true})
		case "/api/game":
			proxy.ServeHTTP(w, r)
		default:
			if strings.HasPrefix(r.URL.Path, "/api/") {
				http.NotFound(w, r)
				return
			}
			if r.URL.Path == "/sw.js" {
				w.Header().Set("Cache-Control", "no-cache")
			}
			http.FileServer(http.FS(static)).ServeHTTP(w, r)
		}
	}), nil
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(value)
}
func replaceSave(source, destination string) error {
	if runtime.GOOS == "windows" {
		if err := os.Rename(source, destination); err == nil {
			return nil
		}
		backup := destination + ".backup"
		os.Remove(backup)
		if err := os.Rename(destination, backup); err != nil && !os.IsNotExist(err) {
			return err
		}
		if err := os.Rename(source, destination); err != nil {
			os.Rename(backup, destination)
			return err
		}
		os.Remove(backup)
		return nil
	}
	return os.Rename(source, destination)
}
func copyFile(source, destination string) error {
	data, err := os.ReadFile(source)
	if err != nil {
		return err
	}
	if previous, e := os.ReadFile(destination); e == nil {
		if sha256.Sum256(previous) == sha256.Sum256(data) {
			return nil
		}
		return errors.New("outra versão já existe no destino; preserve a instalação existente")
	}
	file, err := os.OpenFile(destination, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0755)
	if err != nil {
		return err
	}
	_, err = file.Write(data)
	closeErr := file.Close()
	if err != nil {
		return err
	}
	return closeErr
}
func install() error {
	if runtime.GOOS != "windows" && runtime.GOOS != "darwin" {
		return nil
	}
	executable, err := os.Executable()
	if err != nil {
		return err
	}
	if runtime.GOOS == "windows" {
		base, err := os.UserCacheDir()
		if err != nil {
			return err
		}
		directory := filepath.Join(base, "Programs", "CinzasDeEridan", version)
		destination := filepath.Join(directory, "Eridan.exe")
		if strings.EqualFold(executable, destination) {
			return nil
		}
		if err = os.MkdirAll(directory, 0755); err != nil {
			return err
		}
		if err = copyFile(executable, destination); err != nil {
			return err
		}
		command := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", `$w=New-Object -ComObject WScript.Shell; $p=[IO.Path]::Combine($env:APPDATA,'Microsoft','Windows','Start Menu','Programs','Cinzas de Eridan.lnk'); $s=$w.CreateShortcut($p); $s.TargetPath=$env:ERIDAN_EXECUTABLE; $s.WorkingDirectory=[IO.Path]::GetDirectoryName($env:ERIDAN_EXECUTABLE); $s.Save()`)
		command.Env = append(os.Environ(), "ERIDAN_EXECUTABLE="+destination)
		if err = command.Run(); err != nil {
			return errors.New("o Windows não conseguiu criar o atalho do jogo")
		}
		if err = exec.Command(destination).Start(); err != nil {
			return err
		}
		return errInstalled
	}
	// The macOS app installs itself for this user; no administrator access.
	marker := string(filepath.Separator) + "Contents" + string(filepath.Separator) + "MacOS" + string(filepath.Separator)
	index := strings.LastIndex(executable, marker)
	if index < 0 {
		return nil
	}
	bundle := executable[:index]
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	directory := filepath.Join(home, "Applications")
	destination := filepath.Join(directory, "Cinzas de Eridan.app")
	if filepath.Clean(bundle) == filepath.Clean(destination) {
		return nil
	}
	if err = os.MkdirAll(directory, 0755); err != nil {
		return err
	}
	if _, err = os.Stat(destination); err == nil {
		return nil
	} // Preserve an existing app; run this copy without replacing it.
	if err = copyTree(bundle, destination); err != nil {
		return err
	}
	return nil
}
func copyTree(source, destination string) error {
	return filepath.WalkDir(source, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		relative, e := filepath.Rel(source, path)
		if e != nil {
			return e
		}
		target := filepath.Join(destination, relative)
		if entry.IsDir() {
			return os.MkdirAll(target, 0755)
		}
		if !entry.Type().IsRegular() {
			return errors.New("arquivo inesperado no aplicativo")
		}
		return copyFile(path, target)
	})
}
func openBrowser(address string) error {
	switch runtime.GOOS {
	case "windows":
		return exec.Command("rundll32.exe", "url.dll,FileProtocolHandler", address).Start()
	case "darwin":
		return exec.Command("/usr/bin/open", address).Start()
	default:
		if os.Getenv("ERIDAN_NO_BROWSER") == "1" {
			return nil
		}
		return exec.Command("xdg-open", address).Start()
	}
}
func notify(message string) {
	switch runtime.GOOS {
	case "windows":
		command := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", `Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show($env:ERIDAN_MESSAGE,'Cinzas de Eridan')`)
		command.Env = append(os.Environ(), "ERIDAN_MESSAGE="+message)
		command.Run()
	case "darwin":
		exec.Command("/usr/bin/osascript", "-e", "on run argv", "-e", "display dialog (item 1 of argv) with title \"Cinzas de Eridan\" buttons {\"OK\"}", "-e", "end run", message).Run()
	}
}
