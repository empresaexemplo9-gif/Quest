# rAthena incluído no projeto Quest

O código-fonte original de rAthena está em `engine/rathena`, importado do
repositório oficial https://github.com/rathena/rathena no commit
`d4b8e7b8f16061cc2496d377ac8f777ce72a4f39`.

A licença GPLv3 e os avisos originais foram preservados em
`engine/rathena/LICENSE`. O import inclui somente arquivos versionados do upstream,
sem credenciais, bancos de dados, logs ou executáveis versionados. A inscrição
dos dois NPCs de Éridan foi acrescentada de forma relativa ao projeto.

Os scripts de Éridan ficam em `rathena/`; para registrar na engine incluída:

```bash
python3 scripts/install_rathena.py --repository engine/rathena
```

Esta dependência faz parte do repositório principal Quest. O cliente original de
Éridan usa seu backend em `server/`; rAthena permanece como adaptação nativa do
roteiro fornecido, com compilação/configuração próprias documentadas pelo upstream.
