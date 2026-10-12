# Instalar Quest com o mundo compartilhado Ragnarok

O projeto real continua sendo **empresaexemplo9-gif/Quest**, branch **main**. O servidor é `deploy/ragnarok` (rAthena/MariaDB), o cliente visual é `client/ragnarok` (roBrowserLegacy/GRFs) e o instalador de jogadores é `desktop/ragnarok`. O cliente anterior e seus salvamentos permanecem no mesmo repositório.

## Jogadores

Página: https://quest-game-plum.vercel.app/downloads.html

- Windows 10/11 x64: `Quest-Ragnarok-Setup.exe`. Instala em `%LOCALAPPDATA%\Programs\QuestRagnarok\2.0.1`, cria atalhos na área de trabalho e no menu Iniciar. O jogo abre em janela do Edge ou no navegador padrão.
- macOS 12+ Intel ou Apple Silicon: extraia o ZIP correspondente e mova `Quest Ragnarok.app` para Aplicativos. O jogo abre no navegador padrão.
- Os dados ficam no cache de usuário `QuestRagnarok`; no Windows, `%LOCALAPPDATA%\QuestRagnarok`. A primeira execução baixa cerca de 4 GB de kRO e extrai músicas/arquivos auxiliares. Reserve 6 GB. A tradução inglesa, o renderer e o leitor de GRFs estão incluídos. Os arquivos kRO são obtidos diretamente dos espelhos fixados em `client/ragnarok/kro.lock.json`, sem redistribuí-los no instalador.
- O aplicativo solicita o endereço do servidor e só o aceita depois de verificar rAthena, protocolo compatível, mapas e login/char/map ativos. Internet exige HTTPS/WSS. HTTP só é permitido em localhost ou endereço IP de rede privada.
- O operador atualiza `public/releases/ragnarok-server.json` com a URL **real, verificada** do servidor quando existir. Atualmente `server` é `null`: a Vercel hospeda a página e os instaladores; o servidor desta máquina ainda não tem entrada pública. Baixar o instalador não resolve essa conexão.
- Novas contas usam o mecanismo nativo do rAthena: no primeiro login, usuário terminado em `_M` ou `_F`, senha de pelo menos 8 caracteres; depois use o nome sem esse sufixo. Crie um PIN e um personagem no cliente. Não há conta administrativa embutida.
- Aplicativos ainda não possuem assinatura/notarização. A instalação e o jogo foram executados no Linux; os formatos Windows/macOS foram conferidos, sem execução física nesses sistemas. Não é um Ragexe Windows modificado: é o cliente roBrowserLegacy/WebGL, lendo os recursos reais do Ragnarok e usando o protocolo rAthena.

## Esta máquina

O stack persistente `quest-ragnarok` está em `.local/ragnarok/deployment`. Consulte `docs/servidor-nesta-maquina.md` para iniciá-lo e preservar o banco. O player Linux está instalado em `.local/ragnarok/installed-player` e reutiliza os 4 GB de dados verificados já disponíveis na máquina.

Para executar internamente, com certificado verificado:

```bash
cd /workspace/Quest
desktop/ragnarok/build/Quest-Ragnarok-linux \
  --server https://localhost:13443 \
  --ca /workspace/.quest-env/run/quest-ragnarok-local-ca.crt \
  --assets-dir /workspace/Quest/.local/ragnarok/client \
  --data-dir /workspace/Quest/.local/ragnarok/installed-player --no-browser
```

Esse processo oferece acesso apenas no loopback da própria máquina. Nenhum endereço interno é um link público.

## Compilar e validar

Go 1.24+, Python 3.12+ e componentes previamente preparados por `scripts/setup_ragnarok_client.py --build-web`. O builder não modifica as fontes vendorizadas; inclui proveniência/licenças e verifica os arquivos Node contra SHA-256 oficiais fixados. Compilação sequencial porque cada plataforma usa seu runtime embutido.

```bash
python3 scripts/build_ragnarok_player.py --platform all --go /caminho/para/go
cd desktop/ragnarok
go test -race ./...
go vet ./...
cd ../..
DOCKER_CONFIG=/workspace/.quest-env/docker python3 scripts/test_ragnarok_shared_world.py
```

O teste usa duas contas descartáveis no MariaDB do servidor, entra em Prontera com dois clientes isolados, verifica chat recebido pelo outro jogador, movimento, sentar/levantar recebidos pela outra conexão e posição persistida. Limpa apenas os registros criados pelo teste. Os screenshots e o resultado ficam em `/workspace/.quest-env/run`.

Os checksums públicos estão em `public/downloads/Quest-Ragnarok-SHA256SUMS.json`. Nunca inclua credenciais/arquivos privados do servidor nos pacotes de jogadores. Não regenere artefatos versionados durante o onboarding de rotina.

## Correção do erro de mapas na versão 2.0.1

O bootstrap 2.0.0 passava caminhos de arquivos do Windows diretamente a `import()`, provocando `ERR_UNSUPPORTED_ESM_URL_SCHEME`. A versão 2.0.1 usa URLs de arquivo relativas ao módulo, inclusive em pastas com espaços, acentos ou `#`. Instala seu runtime em outra pasta, preserva o cache de GRFs já baixado e atualiza o atalho. No Windows, encerra apenas o executável 2.0.0 instalado na pasta do próprio usuário antes de abrir a nova versão.

Baixe e execute novamente o instalador na página de downloads. Não apague a pasta `QuestRagnarok`. Se o serviço encerrar, o cliente mostra o erro imediatamente e oferece **Ver diagnóstico do cliente**, com o trecho recente de `assets.log`. Esse log permanece em `%LOCALAPPDATA%\QuestRagnarok\assets.log` no Windows. Os detalhes são servidos somente no loopback e protegidos contra outra origem.
