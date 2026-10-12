# Cliente Ragnarok no Quest

O servidor, o kit e os downloads pertencem ao mesmo projeto
`empresaexemplo9-gif/Quest`. O rAthena fica em `engine/rathena`; o kit reproduzível
fica em `client/ragnarok`; programas e arquivos grandes ficam em
`.local/ragnarok`, dentro do projeto e fora do Git.

## Preparado nesta nuvem

- rAthena Renewal, `PACKETVER=20211103`, compilado com GCC/C++.
- MariaDB: 60 tabelas no schema principal e 10 no schema de logs. Os SQLs de
  main, web, roulette e logs foram importados; dados e credenciais existentes
  foram preservados.
- Cliente kRO **2020-06-03**, oferecido pelo RateMyServer: `data.grf`
  (2.616.036.528 bytes), `rdata.grf` (976.092.259 bytes), `BGM.zip`
  (321.114.392 bytes) e `dll_exe.zip` (63.610.414 bytes). Tamanhos e SHA-256 foram
  comparados com os metadados HTTPS do espelho MediaFire antes da extração.
- ROenglishRE Renewal: original preservado e overlay em
  `.local/ragnarok/overlays/english/data`. É inglês; a tradução portuguesa ainda
  depende de trabalho editorial.
- WARP e NEMO, incluindo executáveis Windows dos repositórios oficiais.
- GRF Editor **1.9.1.1**, Act Editor **1.3.4** e BrowEdit3 **3.660**: pacotes
  Windows baixados e verificados. O download GRF Editor 1.9.1.2 respondeu HTTP
  500; foi utilizada a versão anterior oficial. Fontes do BrowEdit 2 também
  estão preservadas. Programas Windows não foram executados no Linux.
- roBrowserLegacy e RemoteClient-JS: fontes fixadas por commit, dependências
  por lockfile, build WebGL e serviço que lê os recursos diretamente dos GRFs.

O `data.grf` contém 854 conjuntos `.rsw`/`.gnd`/`.gat`, 25.238 `.spr` e
26.841 `.act`. O `rdata.grf` inclui versões Renewal; os arquivos podem se repetir
entre os dois. O cliente web lê terreno, modelos, colisões e sequências de
animação desses arquivos.

## Reproduzir

Python 3.12+, Node 24 e acesso HTTPS às fontes dos lockfiles são necessários.
Na raiz do Quest:

```bash
python3 scripts/setup_ragnarok_client.py --build-web
python3 scripts/download_kro.py
```

O primeiro comando verifica os programas e prepara o overlay e o cliente web.
O segundo baixa e verifica os quatro arquivos do cliente, e extrai músicas e
DLLs/executáveis sem sobrescrever arquivos presentes. As fontes e licenças das
ferramentas são preservadas em `.local/ragnarok/vendor`.

Na nuvem, o cache npm existente pode ser utilizado:

```bash
QUEST_NPM_CACHE=/workspace/.quest-env/npm-cache python3 scripts/setup_ragnarok_client.py --build-web
source /workspace/.quest-env/env.sh
python3 /workspace/.quest-env/manage.py check
```

O helper inicia MariaDB, login, char, map e web e testa o login real. Fora desta
nuvem, prepare MySQL/MariaDB e compile conforme a documentação do rAthena.
Não copie credenciais locais para o repositório.

## Cliente web nativo de desenvolvimento

Com o rAthena ativo, execute em terminais separados, na raiz:

```bash
node client/ragnarok/assets.mjs
node client/ragnarok/serve.mjs
```

Recursos usam a porta local 3338; cliente e ponte WebSocket usam 3005. Ambos
escutam somente em loopback. A ponte encaminha o protocolo real para login
6900, char 6121 e map 5121, recusando outros destinos e origens.
`/api/readiness` lê as colisões reais de Prontera antes de indicar recursos
disponíveis. O build gerado usa Quest, sem servidor de demonstração externo.

`PACKET_OBFUSCATION` foi desativado em `src/custom/defines_post.hpp` para o
roBrowser. Um cliente executável também precisa da configuração correspondente
no WARP/NEMO. Os executáveis oficiais do pacote têm datas 2020-05-27 e
2020-03-02; **não são executáveis já modificados e compatíveis com 20211103**.
O teste gráfico usou roBrowser com o protocolo 20211103, sem executar esses EXEs.

## Validação e publicação

O rAthena autenticou no MariaDB, apresentou o servidor de personagens e
conectou login/char/map sem erros. A ponte repetiu o login real. Prontera
`.gat`, `.gnd` e `.rsw` foram servidos dos GRFs e suas assinaturas conferidas.

Um teste Chromium fez login, confirmou PIN, selecionou um personagem e entrou
em Prontera renderizada em WebGL. Um clique no chão moveu o personagem de
`150,150` para `153,149`; a posição foi persistida pelo servidor no MariaDB
após desconectar. As contas e personagens de teste foram removidos.
O teste por toque também passou em uma emulação de iPad, com login, PIN,
entrada no mapa e persistência do movimento. Para repetir esses testes na
nuvem, execute `python3 scripts/test_ragnarok_browser.py` com os serviços ativos.

Os testes existentes do roBrowser passaram em 36 casos de caminhos, colisões e
personagens e 14 casos de ACT/SPR. O serviço de recursos passou em 156 casos.
Isso não equivale a testes em Windows/macOS ou em um iPad Air físico.

O domínio principal continua `https://quest-game-plum.vercel.app`. A Vercel
pode servir o portal e o build estático. rAthena, MariaDB, WebSocket e GRFs
precisam de um servidor persistente com HTTPS/WSS; esta nuvem de desenvolvimento
não é uma hospedagem pública permanente.

O site e seus instaladores publicados ainda usam o cliente anterior. A
substituição pública depende de hospedar os serviços nativos e configurar seus
endereços reais. O cliente web é a base de acesso pelo macOS/iPad; o EXE do
Windows não roda diretamente no iPad. O roteiro nativo de Éridan está em
`rathena/`; a preparação do cliente não implementa automaticamente todo o
conteúdo adicional do cliente anterior.
