# Quest — Cinzas de Éridan

**Este é o projeto principal do jogo:** [empresaexemplo9-gif/Quest](https://github.com/empresaexemplo9-gif/Quest).

Cliente, artes, roteiro, backend, PostgreSQL, engine rAthena, instaladores e versão iPad estão reunidos neste repositório. O endereço solicitado é **https://quest-game-plum.vercel.app/**. Publicações `temporary-*.vercel.app` são testes com expiração, não o projeto principal.

## Iniciar o jogo completo

Requisitos para hospedar/desenvolver: Node.js 24 e Docker Compose. Jogadores usam o navegador, PWA do iPad ou os instaladores; não precisam instalar um banco.

```bash
npm run stack:start
```

Esse comando verifica as dependências pelo lockfile, gera credenciais locais aleatórias sem exibi-las e inicia o jogo e o PostgreSQL. A interface e a API são servidas juntas. Por padrão, o jogo usa a porta 3004 no computador e o PostgreSQL aceita conexões apenas em loopback na porta 15432.

O banco usa volume persistente `quest_quest-postgres`; `npm run stack:stop` preserva os dados. **Não use `docker compose down -v` para parar o jogo**, pois isso apagaria o volume do banco. Credenciais e backups ficam em `.local/`, fora do Git.

Para publicar o contêiner em um servidor seu, configure `QUEST_BIND_ADDRESS`/`QUEST_PORT` e um proxy HTTPS. Na Vercel, use este mesmo repositório e forneça a conexão PostgreSQL de produção em `DATABASE_URL`. A Vercel não hospeda o contêiner PostgreSQL nem as portas nativas de rAthena. O domínio principal já foi atualizado pela integração Git existente da Vercel: pushes em `main` publicam este mesmo projeto. A API pública ainda informa `DATABASE_NOT_CONFIGURED`; configure `DATABASE_URL` ou uma integração que forneça `POSTGRES_URL` nas variáveis seguras do projeto Vercel para liberar multiplayer. A autenticação da CLI não é necessária para o fluxo de publicação por Git.

## Backend e banco reais

O backend em `server/` utiliza PostgreSQL com migrações e tabelas de contas, sessões, personagens, inventário, guildas, membros, mercado, recibos de ações, auditoria e limites de requisição. A API é compartilhada pelo navegador, iPad e clientes de computador.

- Senhas usam scrypt com salt individual; sessões usam tokens aleatórios, armazenados apenas como hash, em cookies HttpOnly.
- Cadastro, login, logout, perfil e troca de senha estão implementados. Trocar a senha encerra as outras sessões.
- O servidor decide movimento, combate, recompensas e saldos. Não aceita a importação de saves locais como personagens online.
- Compras e recompensas são transações; recibos persistentes evitam repetir ações após reconexão ou reinício.
- Saúde da API consulta o banco real. Sem uma conexão funcional, o mundo online não é anunciado como disponível.
- SQLite é apenas a alternativa de desenvolvimento/migração. Não é usado como banco efêmero na Vercel.

### Desenvolvimento fora do contêiner

```bash
npm ci
npm run db:init
docker compose up -d postgres
node --env-file=.local/backend-local.env server/index.js
```

Esse modo usa o mesmo PostgreSQL, na porta 3003 para a API/interface. A configuração local é protegida e não deve ser publicada. Para rodar exclusivamente com SQLite, use `ERIDAN_DB_FILE` em um processo sem `DATABASE_URL`.

### Preservar dados anteriores

```bash
node --env-file=.local/backend-local.env scripts/migrate_sqlite.js --source CAMINHO_DO_BANCO_ANTERIOR.sqlite
npm run db:backup
```

A migração preserva contas, personagens e sessões existentes, mantém o SQLite original e recusa sobrescrever um PostgreSQL que já contém jogadores. O backup usa `pg_dump`, fica protegido em `.local/backups/` e deve ser copiado para seu armazenamento seguro. Volume Docker persiste no host; transferir o projeto para outro host exige restaurar o backup. Em um banco vazio, use `npm run db:restore -- --file .local/backups/SEU_BACKUP.dump` antes de iniciar o jogo. A restauração é transacional e recusa sobrescrever um banco existente.

## Jogar

Converse com Mara no Abrigo 77 e receba **O Despertar**. Use WASD/setas ou clique no chão, Espaço para atacar, Q/E/R/F para habilidades e G para interagir. Missões, mapa, inventário, habilidades, guilda e grupos também têm botões.

A jornada solo salva neste dispositivo e funciona offline depois do primeiro acesso. O mundo online utiliza contas e progresso no PostgreSQL. No iPad Air, abra pelo Safari e use **Compartilhar → Adicionar à Tela de Início**. Há controles por toque em retrato e paisagem. Foram feitas simulações de toque; o iPadOS 26.6.1 em aparelho físico ainda não foi testado.

A direção visual usa as imagens enviadas como referência: cenários isométricos, sprites e janelas inspiradas em Ragnarok, com ruínas futuristas, deserto, floresta, cidade submersa e áreas frias. O cenário é uma camada de arte; personagens, monstros, coleta e combate são entidades jogáveis.

### Conteúdo atual

Cinco classes, quatro habilidades por classe, dois caminhos de promoção no nível 30, forma final no 60 e limite 80; oito regiões; 11 missões; sete Cacos; quatro operações; guildas, sete edifícios, cinco especializações, recursos, crises, mercado, receitas e montarias.

PvP é voluntário, protege personagens até o nível 15, usa faixas de dez níveis e preserva o inventário. Arenas 1v1/3v3/5v5 precisam de jogadores reais. Cerco às Torres ocorre sábado 18h–20h UTC, exige guerra aceita pelas duas guildas e adesão individual; controle dura 24 horas.

Operações solo usam apoio identificado como NPC. Online, os grupos precisam cumprir as quantidades de participantes; Aurea exige duas guildas e três frentes coordenadas. Recompensas são individuais. As decisões de temporada mudam o clima da temporada seguinte.

É uma versão jogável em desenvolvimento, não uma operação MMO dimensionada para milhares de pessoas. IA, animação, dungeons e veículos ainda são simplificados. Conteúdo futuro, moderação, recuperação de senha por e-mail e testes de carga não estão concluídos.

## rAthena dentro do mesmo projeto

O cliente kRO completo, tradução e ferramentas estão preparados nesta nuvem
em `.local/ragnarok`. O kit e o cliente web que lê mapas/sprites reais estão
documentados em [docs/ragnarok-client.md](docs/ragnarok-client.md). Essa integração
nativa ainda precisa de hospedagem própria para substituir o cliente publicado.

O código oficial está em `engine/rathena`, no commit `d4b8e7b8f16061cc2496d377ac8f777ce72a4f39`, com licença original preservada. O roteiro do usuário e suas correções estão em `docs/rathena-original-enviado.txt` e `rathena/`.

```bash
python3 scripts/install_rathena.py --repository engine/rathena
```

A adaptação usa classes RO equivalentes, corrige a proteção no nível 15, faixas de PvP, consentimento e entrega cooperativa de Rhea com recompensa uma vez por personagem. É uma integração nativa separada do protocolo do cliente web anterior. O protocolo usa PACKETVER 20211103. Os GRFs kRO foram baixados e verificados nesta nuvem, fora do Git; executáveis Windows precisam de versão e modificações compatíveis com esse protocolo.

O pacote Docker para VPS, o banco nativo persistente e a configuração HTTPS/WSS estão documentados em [Hospedagem do Ragnarok](docs/ragnarok-hosting.md). A implantação pública ainda depende de criar a VPS e configurar o acesso seguro ao provedor.

## Instaladores Windows e macOS

```bash
npm run build
python3 scripts/build_clients.py --go CAMINHO_DO_COMPILADOR_GO --linux
```

`desktop/` embute o cliente, artes e salvamento local em um executável Go. O Windows instala por usuário e cria atalho; o macOS inclui Intel e Apple Silicon. O navegador padrão desenha o jogo, e o mundo online consulta o domínio principal por HTTPS.

Os pacotes e SHA-256 ficam em `public/downloads/`. São gerados pelo workflow de CI e não duplicam um segundo projeto. Ainda estão sem assinatura digital/notarização; a execução foi verificada no Linux, sem execução em Windows/macOS físicos. O código antigo do downloader Ragnarok foi preservado como referência histórica em `legacy/` e não é a entrega atual.

## Testes

```bash
npm test
node --env-file=.local/backend-local.env --test tests/postgres.integration.js
npm run build
```

Os testes PostgreSQL criam e removem um schema isolado, sem alterar os jogadores existentes. Verificam tabelas reais, concorrência no mercado, replay persistente, reinício, senhas e sessões. Testes de navegador usam Python Playwright e Chromium:

```bash
python3 scripts/test_browser.py --site http://127.0.0.1:3004 --desktop-client http://127.0.0.1:38479
```

Ative o cliente embutido de verificação antes, com `ERIDAN_PORT=38479`, `ERIDAN_NO_BROWSER=1` e um diretório de configuração gravável. Os testes exercitam missão, movimento, toque, offline, duas contas com chat/grupo e backup nativo. As instruções locais completas da nuvem ficam no rascunho do ambiente.
