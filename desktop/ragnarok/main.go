// Quest's installed Ragnarok renderer and full local client resources.
package main

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"html/template"
	"io"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"syscall"
	"time"
)

//go:embed assets/runtime.zip assets/runtime.sha256
var bundle embed.FS

const version = "2.0.8"
const portal = "https://quest-game-plum.vercel.app"

var installComplete = errors.New("installed and launched")

type app struct {
	mu                                     sync.RWMutex
	phase, problem, server                 string
	ready                                  bool
	assetsFailed                           bool
	runtimeDir, clientDir, dataDir, origin string
	transport                              *http.Transport
	remote                                 *httputil.ReverseProxy
	assetProxy                             *httputil.ReverseProxy
	node                                   *exec.Cmd
	stopped                                bool
}

func main() {
	if err := run(); err != nil {
		log.Print(err)
		notify(err.Error())
		os.Exit(1)
	}
}

func run() error {
	portable := flag.Bool("portable", false, "Usar somente a pasta do jogo, sem instalar em outras pastas")
	serverFlag := flag.String("server", "", "Endereço do servidor Quest")
	followPortal := flag.Bool("follow-portal", true, "Encontrar automaticamente o servidor principal do portal")
	caFlag := flag.String("ca", "", "CA explícita para servidor local administrado pelo usuário")
	dataFlag := flag.String("data-dir", "", "Pasta privada de instalação e cache")
	assetsFlag := flag.String("assets-dir", "", "Cliente kRO já instalado, para validação/administração")
	portFlag := flag.Int("port", 38777, "Porta de acesso local ao aplicativo")
	noBrowser := flag.Bool("no-browser", false, "Validação sem abrir navegador")
	showVersion := flag.Bool("version", false, "Versão")
	flag.Parse()
	if *showVersion {
		fmt.Println("Quest Ragnarok " + version)
		return nil
	}
	if *portFlag < 1024 || *portFlag > 65535 {
		return errors.New("porta local inválida")
	}
	if !*portable {
		if err := install(); err != nil {
			if errors.Is(err, installComplete) {
				return nil
			}
			return err
		}
	}
	base, err := os.UserCacheDir()
	if err != nil {
		return err
	}
	data := *dataFlag
	if data == "" {
		if *portable {
			exe, e := os.Executable()
			if e != nil {
				return e
			}
			data = filepath.Join(filepath.Dir(exe), "Cliente")
		} else {
			data = filepath.Join(base, "QuestRagnarok")
		}
	}
	if err = os.MkdirAll(data, 0700); err != nil {
		return err
	}
	runtimeDir := filepath.Join(data, "runtime", version)
	if err = extractRuntime(runtimeDir); err != nil {
		return err
	}
	clientDir := *assetsFlag
	if clientDir == "" {
		if *portable {
			clientDir = filepath.Join(filepath.Dir(data), "Dados")
		} else {
			clientDir = filepath.Join(data, "client")
		}
	}
	roots, err := x509.SystemCertPool()
	if err != nil || roots == nil {
		roots = x509.NewCertPool()
	}
	if *caFlag != "" {
		cert, e := os.ReadFile(*caFlag)
		if e != nil {
			return e
		}
		if !roots.AppendCertsFromPEM(cert) {
			return errors.New("CA inválida")
		}
	}
	transport := &http.Transport{Proxy: http.ProxyFromEnvironment, TLSClientConfig: &tls.Config{RootCAs: roots, MinVersion: tls.VersionTLS12}, DialContext: (&net.Dialer{Timeout: 8 * time.Second}).DialContext, TLSHandshakeTimeout: 8 * time.Second, ResponseHeaderTimeout: 25 * time.Second, MaxIdleConnsPerHost: 64}
	address := fmt.Sprintf("127.0.0.1:%d", *portFlag)
	listener, err := net.Listen("tcp", address)
	if err != nil {
		response, e := (&http.Client{Timeout: time.Second}).Get("http://" + address + "/api/client-status")
		if e == nil {
			defer response.Body.Close()
			var existing struct {
				Client  string `json:"client"`
				Version string `json:"version"`
			}
			json.NewDecoder(io.LimitReader(response.Body, 4096)).Decode(&existing)
			if response.StatusCode == 200 && existing.Client == "quest-ragnarok" {
				if existing.Version != version {
					return errors.New("feche o cliente anterior e abra o novo atalho Quest Ragnarok")
				}
				if !*noBrowser {
					return openGame("http://" + address)
				}
				return errors.New("o cliente Quest já está em execução")
			}
		}
		return errors.New("a porta local está ocupada; selecione outra porta")
	}
	a := &app{phase: "Preparando os arquivos do Ragnarok…", runtimeDir: runtimeDir, clientDir: clientDir, dataDir: data, origin: "http://" + address, transport: transport}
	selected := *serverFlag
	if selected == "" && !*followPortal {
		previous, _ := os.ReadFile(filepath.Join(data, "server.json"))
		var saved struct {
			Server string `json:"server"`
		}
		json.Unmarshal(previous, &saved)
		selected = saved.Server
	}
	if selected == "" {
		request, _ := http.NewRequest("GET", portal+"/releases/ragnarok-server.json", nil)
		response, e := (&http.Client{Transport: transport, Timeout: 4 * time.Second}).Do(request)
		if e == nil {
			var current struct {
				Server string `json:"server"`
			}
			if response.StatusCode == 200 {
				json.NewDecoder(io.LimitReader(response.Body, 8192)).Decode(&current)
				selected = current.Server
			}
			response.Body.Close()
		}
	}
	if selected != "" {
		if err = a.selectServer(selected); err != nil {
			a.mu.Lock()
			a.problem = err.Error()
			a.mu.Unlock()
		}
	}
	httpServer := &http.Server{Handler: a, ReadHeaderTimeout: 8 * time.Second, IdleTimeout: 60 * time.Second}
	go a.prepare()
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	go func() { <-stop; httpServer.Close(); a.stopAssets() }()
	if !*noBrowser {
		go func() {
			if err := openGame(a.origin); err != nil {
				log.Print(err)
			}
		}()
	}
	log.Printf("Quest Ragnarok client running on local port %d", *portFlag)
	err = httpServer.Serve(listener)
	a.stopAssets()
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return err
}

func extractRuntime(destination string) error {
	data, err := bundle.ReadFile("assets/runtime.zip")
	if err != nil {
		return err
	}
	expected, _ := bundle.ReadFile("assets/runtime.sha256")
	digest := sha256.Sum256(data)
	if hex.EncodeToString(digest[:]) != strings.TrimSpace(string(expected)) {
		return errors.New("o pacote do cliente falhou na verificação de integridade")
	}
	reader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return err
	}
	for _, entry := range reader.File {
		relative, err := safeArchiveName(entry.Name)
		if err != nil {
			return err
		}
		target := filepath.Join(destination, relative)
		if entry.Mode()&os.ModeSymlink != 0 {
			return errors.New("link inesperado no pacote")
		}
		if entry.FileInfo().IsDir() {
			if err = os.MkdirAll(target, 0755); err != nil {
				return err
			}
			continue
		}
		if err = os.MkdirAll(filepath.Dir(target), 0755); err != nil {
			return err
		}
		if _, e := os.Lstat(target); e == nil {
			if matchesArchiveEntry(target, entry) {
				continue
			}
			return fmt.Errorf("arquivo de instalação existente preservado: %s", entry.Name)
		} else if !os.IsNotExist(e) {
			return e
		}
		if err := writeArchiveEntry(entry, target, 0755); err != nil {
			return err
		}
	}
	return nil
}

func normalizeServer(value string) (*url.URL, error) {
	u, err := url.Parse(strings.TrimSpace(value))
	if err != nil || u.Hostname() == "" || u.User != nil || (u.Path != "" && u.Path != "/") || u.RawQuery != "" || u.Fragment != "" {
		return nil, errors.New("informe somente o endereço do servidor Quest")
	}
	if u.Scheme != "https" {
		ip := net.ParseIP(u.Hostname())
		local := u.Hostname() == "localhost" || (ip != nil && (ip.IsLoopback() || ip.IsPrivate()))
		if u.Scheme != "http" || !local {
			return nil, errors.New("o servidor na internet precisa usar HTTPS")
		}
	}
	u.Path = ""
	return u, nil
}

func (a *app) selectServer(value string) error {
	target, err := normalizeServer(value)
	if err != nil {
		return err
	}
	response, err := (&http.Client{Transport: a.transport, Timeout: 10 * time.Second}).Get(target.String() + "/api/readiness")
	if err != nil {
		return errors.New("não foi possível conectar ao servidor selecionado")
	}
	defer response.Body.Close()
	var status struct {
		Engine      string `json:"engine"`
		NativeReady bool   `json:"nativeReady"`
		AssetsReady bool   `json:"assetsReady"`
		Packet      int    `json:"packetver"`
	}
	if response.StatusCode != 200 || json.NewDecoder(io.LimitReader(response.Body, 8192)).Decode(&status) != nil || status.Engine != "rAthena" || !status.NativeReady || !status.AssetsReady || status.Packet != 20211103 {
		return errors.New("esse endereço ainda não oferece um servidor Quest Ragnarok disponível")
	}
	proxy := &httputil.ReverseProxy{Transport: a.transport, Rewrite: func(p *httputil.ProxyRequest) {
		p.SetURL(target)
		p.Out.Header.Set("Origin", target.String())
		p.Out.Header.Del("Forwarded")
		p.Out.Header.Del("X-Forwarded-For")
	}, ErrorHandler: func(w http.ResponseWriter, r *http.Request, e error) { http.Error(w, "Servidor sem conexão", 503) }}
	configuration, _ := json.Marshal(map[string]string{"server": target.String()})
	if err = os.WriteFile(filepath.Join(a.dataDir, "server.json"), configuration, 0600); err != nil {
		return err
	}
	a.mu.Lock()
	a.server = target.String()
	a.remote = proxy
	if !a.assetsFailed {
		a.problem = ""
	}
	a.mu.Unlock()
	return nil
}

func (a *app) prepare() {
	update := func(message string) { a.mu.Lock(); a.phase = message; a.mu.Unlock() }
	if err := prepareClient(a.clientDir, filepath.Join(a.runtimeDir, "kro.lock.json"), update); err != nil {
		a.fail(err)
		return
	}
	update("Abrindo mapas e animações do Ragnarok…")
	node := filepath.Join(a.runtimeDir, "node")
	if runtime.GOOS == "windows" {
		node += ".exe"
	}
	logFile, err := os.OpenFile(filepath.Join(a.dataDir, "assets.log"), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		a.fail(err)
		return
	}
	defer logFile.Close()
	fmt.Fprintf(logFile, "\nQuest Ragnarok %s — %s\n", version, time.Now().UTC().Format(time.RFC3339))
	child := exec.Command(node, filepath.Join(a.runtimeDir, "start-assets.mjs"), a.clientDir, a.origin)
	hideConsole(child)
	child.Dir = a.runtimeDir
	child.Stdout = logFile
	child.Stderr = logFile
	portFile := filepath.Join(a.runtimeDir, "asset-port.json")
	if err = os.Remove(portFile); err != nil && !os.IsNotExist(err) {
		a.fail(err)
		return
	}
	a.mu.Lock()
	if a.stopped {
		a.mu.Unlock()
		return
	}
	err = child.Start()
	if err == nil {
		a.node = child
	}
	a.mu.Unlock()
	if err != nil {
		a.fail(err)
		return
	}
	exited := make(chan error, 1)
	go func() { exited <- child.Wait() }()
	endpoint, err := waitForAssetService(exited, portFile, 120*time.Second)
	if err != nil {
		if child.Process != nil {
			child.Process.Kill()
		}
		a.fail(err)
		return
	}
	a.mu.Lock()
	a.assetsFailed = false
	a.assetProxy = httputil.NewSingleHostReverseProxy(endpoint)
	a.ready = true
	a.phase = "Cliente Ragnarok instalado."
	a.mu.Unlock()
	go func() {
		<-exited
		a.mu.Lock()
		defer a.mu.Unlock()
		if !a.stopped {
			a.assetsFailed = true
			a.ready = false
			a.problem = "O serviço de mapas encerrou. Abra o diagnóstico do cliente."
			a.phase = "Não foi possível manter os mapas disponíveis."
		}
	}()

}

func (a *app) stopAssets() {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.stopped = true
	if a.node != nil && a.node.Process != nil {
		a.node.Process.Kill()
	}
}

func (a *app) fail(err error) {
	a.mu.Lock()
	a.assetsFailed = true
	a.ready = false
	a.problem = err.Error()
	a.phase = "Não foi possível concluir a preparação."
	a.mu.Unlock()
}

var launcher = template.Must(template.New("launcher").Parse(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Quest — Ragnarok</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#111820;color:#f0e5d3;font:18px system-ui;margin:8vh auto;padding:24px;max-width:700px}h1{color:#e8b84b}input,button{font:inherit;padding:12px;box-sizing:border-box}input{width:100%;margin:12px 0}button{background:#e8b84b;border:0;cursor:pointer}#error{color:#f8b7a4}small{display:block;margin-top:24px}</style><h1>Quest — Cinzas de Éridan</h1><p>Ragnarok · Mundo compartilhado</p><p id="status">Preparando o cliente…</p><p id="error"></p><details id="diagnostic" hidden><summary>Ver diagnóstico do cliente</summary><pre id="asset-log" style="white-space:pre-wrap;overflow-wrap:anywhere"></pre></details><form id="connection"><label>Endereço do servidor Quest<input id="server" type="url" placeholder="https://servidor-do-jogo" required></label><button>Conectar ao mundo</button></form><small>Na primeira instalação, os mapas, personagens e músicas são baixados. Seu personagem e os outros jogadores vivem no mesmo servidor.</small><script src="/launcher.js"></script></html>`))

func questServerAsset(resource string) bool {
	resource = strings.ToLower(strings.ReplaceAll(resource, "\\", "/"))
	if !strings.HasPrefix(resource, "/remote-client/data/") {
		return false
	}
	name := strings.TrimPrefix(resource, "/remote-client/data/")
	for _, prefix := range []string{"model/eridan/", "texture/eridan/", "sprite/quest/", "luafiles514/lua files/skillinfoz/"} {
		if strings.HasPrefix(name, prefix) {
			return true
		}
	}
	if strings.HasPrefix(name, "texture/") && strings.Contains(name, "/quest/") {
		return true
	}
	for _, worldMap := range []string{"er_chama0", "er_chama1", "er_chama2", "er_chama3", "er_estrada", "er_mata", "er_cacada", "er_vilav", "er_costas", "er_deserto", "er_aurea", "er_ruinas", "er_mina1", "er_mina2", "er_rubra", "er_celeste", "er_forja", "er_azul", "er_brasa", "er_jardim", "er_escomb", "er_selva"} {
		if strings.HasPrefix(name, "texture/") && strings.HasSuffix(name, "/map/"+worldMap+".bmp") {
			return true
		}
		for _, suffix := range []string{"rsw", "gnd", "gat"} {
			if name == worldMap+"."+suffix {
				return true
			}
		}
	}
	switch name {
	case "bookitemnametable.txt", "idnum2itemdesctable.txt", "idnum2itemdisplaynametable.txt", "mapnametable.txt", "msgstringtable.txt", "num2itemdesctable.txt", "num2itemdisplaynametable.txt", "questid2display.txt", "tipoftheday.txt":
		return true
	}
	return false
}

func (a *app) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Host != strings.TrimPrefix(a.origin, "http://") || (r.Header.Get("Origin") != "" && r.Header.Get("Origin") != a.origin) {
		http.Error(w, "Origem inválida", 403)
		return
	}
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "no-store")
	a.mu.RLock()
	ready, server, problem, phase, remote, assetProxy := a.ready, a.server, a.problem, a.phase, a.remote, a.assetProxy
	a.mu.RUnlock()
	switch r.URL.Path {
	case "/api/client-log":
		if r.Method != "GET" {
			http.Error(w, "Método inválido", 405)
			return
		}
		data, err := assetLogTail(filepath.Join(a.dataDir, "assets.log"), 32<<10)
		if err != nil {
			http.Error(w, "O log ainda não foi criado.", 404)
			return
		}
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.Write(data)
		return
	case "/api/client-status":
		json.NewEncoder(w).Encode(map[string]any{"client": "quest-ragnarok", "version": version, "assetsReady": ready, "server": server, "problem": problem, "phase": phase, "sharedWorld": true})
		return
	case "/api/server":
		if r.Method != "POST" {
			http.Error(w, "Método inválido", 405)
			return
		}
		var input struct {
			Server string `json:"server"`
		}
		if json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&input) != nil {
			http.Error(w, "Endereço inválido", 400)
			return
		}
		if err := a.selectServer(input.Server); err != nil {
			http.Error(w, err.Error(), 503)
			return
		}
		w.WriteHeader(204)
		return
	case "/launcher.js":
		w.Header().Set("Content-Type", "text/javascript")
		io.WriteString(w, `async function status(){const s=await(await fetch('/api/client-status')).json();document.querySelector('#status').textContent=s.phase;document.querySelector('#error').textContent=s.problem;document.querySelector('#diagnostic').hidden=!(s.problem&&!s.assetsReady);const input=document.querySelector('#server');if(!input.value)input.value=s.server;if(s.assetsReady&&s.server&&!s.problem)location.href='/play/';}document.querySelector('#connection').onsubmit=async e=>{e.preventDefault();const r=await fetch('/api/server',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({server:document.querySelector('#server').value})});if(!r.ok)document.querySelector('#error').textContent=await r.text();else status();};document.querySelector('#diagnostic').ontoggle=async e=>{if(e.target.open){const r=await fetch('/api/client-log');document.querySelector('#asset-log').textContent=await r.text();}};status();setInterval(status,1500);`)
		return
	case "/", "/index.html":
		launcher.Execute(w, nil)
		return
	case "/play/Config.js":
		configuration := map[string]any{"development": false, "skipIntro": false, "skipServerList": true, "clientVersionMode": "PacketVer", "remoteClient": a.origin + "/remote-client/", "BGMFileExtension": []string{"mp3"}, "servers": []any{map[string]any{"display": "Quest — Cinzas de Éridan", "address": "127.0.0.1", "port": 6900, "version": 55, "langtype": 1, "packetver": 20211103, "renewal": true, "packetKeys": false, "forceUseAddress": true, "remoteClient": a.origin + "/remote-client/", "socketProxy": "ws://" + strings.TrimPrefix(a.origin, "http://")}}}
		data, _ := json.Marshal(configuration)
		w.Header().Set("Content-Type", "text/javascript")
		fmt.Fprintf(w, "window.ROConfigBase = %s;", data)
		return
	}
	if strings.HasPrefix(r.URL.Path, "/remote-client/") {
		// Quest maps and Portuguese overlays follow the current world's revisions;
		// ordinary GRF resources continue to use the verified local client cache.
		if questServerAsset(r.URL.Path) {
			if remote == nil {
				http.Error(w, "Servidor não configurado", 503)
				return
			}
			remote.ServeHTTP(w, r)
			return
		}
		if !ready || assetProxy == nil {
			http.Error(w, "Mapas em preparação", 503)
			return
		}
		r.URL.Path = strings.TrimPrefix(r.URL.Path, "/remote-client")
		assetProxy.ServeHTTP(w, r)
		return
	}
	if r.URL.Path == "/127.0.0.1:6900" || r.URL.Path == "/127.0.0.1:6121" || r.URL.Path == "/127.0.0.1:5121" {
		if remote == nil {
			http.Error(w, "Servidor não configurado", 503)
			return
		}
		remote.ServeHTTP(w, r)
		return
	}
	if strings.HasPrefix(r.URL.Path, "/play/") {
		if !ready || remote == nil {
			http.Redirect(w, r, "/", http.StatusSeeOther)
			return
		}
		http.StripPrefix("/play/", http.FileServer(http.Dir(filepath.Join(a.runtimeDir, "web")))).ServeHTTP(w, r)
		return
	}
	http.NotFound(w, r)
}
