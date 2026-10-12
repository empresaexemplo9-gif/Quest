# Conectar o domínio ao mundo Ragnarok

O projeto Vercel existente é `quest-game`, vinculado a **empresaexemplo9-gif/Quest**, produção na branch **main**. O domínio continua **https://quest-game-plum.vercel.app**. A API Vercel conseguiu ler esse projeto usando a autenticação segura do ambiente; não foi criado outro projeto, servidor pago ou sandbox.

A raiz do domínio aponta para a entrada Ragnarok. Ela consulta `/api/ragnarok`, que verifica o servidor publicado em `public/releases/ragnarok-server.json`. O botão Jogar agora só aparece quando o endpoint responde com rAthena/roBrowserLegacy, PACKETVER 20211103, GRFs disponíveis e login/char/map conectados. O cliente anterior e seus saves continuam acessíveis em `/index.html`.

## Bloqueio observado em 12/10/2026

O servidor desta máquina continua saudável internamente. Ainda não foi criada uma rota pública para ele. O cliente oficial Cloudflare 2026.10.0, extraído de imagem OCI fixada por digest e conferido por SHA-256, falhou ao resolver `api.trycloudflare.com`: `connection refused`. A requisição HTTPS pelo proxy do ambiente retornou **403**, `Your request was blocked`.

O rascunho preserva os destinos anteriores e inclui os necessários ao diagnóstico:

- `api.trycloudflare.com`
- `*.trycloudflare.com`
- `*.argotunnel.com`
- `*.cftunnel.com`

É necessário aplicar a configuração de rede na interface do ambiente. Salvar o rascunho não altera a rede da máquina. Cloudflare Tunnel também precisa de DNS e saída TCP 7844 para HTTP/2, ou UDP 7844 para QUIC. Só adicionar hostnames não garante suporte a esse transporte; se a plataforma permitir apenas HTTP através do proxy, será necessário um host ou serviço de publicação de portas compatível. Não desative TLS nem contorne a política de rede.

Depois de uma mudança real na rede, o comando de diagnóstico é:

```bash
/workspace/.quest-env/cloudflared/cloudflared tunnel \
  --no-autoupdate --protocol http2 --url http://127.0.0.1:13005
```

Mantenha apenas um processo que informe uma conexão bem-sucedida com a borda. O endereço de um quick tunnel é temporário e depende desta máquina/processo. Para endereço estável, use túnel gerenciado ou host persistente.

## Ativação da conexão real

Depois de obter um **endpoint público HTTPS do gateway nativo**, execute:

```bash
cd /workspace/Quest
DOCKER_CONFIG=/workspace/.quest-env/docker python3 deploy/ragnarok/connect_public.py \
  --backend-url https://HOST-PUBLICO-REAL \
  --deployment .local/ragnarok/deployment
```

Esse comando verifica o endpoint, preserva banco, credenciais, portas privadas, Caddy e origens internas, adiciona a nova origem e reinicia apenas o serviço game. Depois testa login SQL real pelo HTTPS/WSS externo e bloqueio das origens/portas indevidas. Só após passar atualiza o manifesto público. Se o teste falhar, restaura a configuração anterior e não publica o endereço.

Revise a alteração de `public/releases/ragnarok-server.json`, faça commit e push na **mesma main**. A integração Git existente publica a conexão no portal e na descoberta automática dos instaladores. O botão abre o cliente nativo no host público; o endereço de entrada continua no domínio Vercel. A Vercel estática não transforma localhost em servidor público nem executa as conexões TCP persistentes do rAthena.

Validações da ligação preparada:

```bash
node --test tests/ragnarok-entry.test.js
python3 tests/test_connect_ragnarok.py
```

Os oito testes verificam rejeição de endereços locais/inseguros, serviços errados, protocolo incorreto, ausência de mapas/handshakes, falha de conexão e rollback preservando configuração/manifesto. A página foi exercitada no Chromium com toque: endpoint pendente retorna 503, botão de jogo permanece oculto e a consulta pode ser repetida. Isso não equivale a login público verificado.

## Executar a conexão no Windows

No repositório Quest do próprio PC, atualizado para main, execute `scripts\IniciarServidorWindows.cmd -Public -PublishMain`. Ele prepara WSL2/Docker/Cloudflare, inicia o servidor persistente e só atualiza o manifesto após verificar login nativo HTTPS/WSS. As solicitações de elevação, reinício e configuração inicial do Docker exigem ação no Windows. Consulte [servidor Windows](ragnarok-local-windows.md). Essa execução local não está sujeita à rede desta sessão da nuvem. A disponibilidade ainda depende da rede do PC e do funcionamento do túnel.
