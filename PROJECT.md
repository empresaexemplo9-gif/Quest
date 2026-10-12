# Projeto principal do jogo

**Repositório único:** https://github.com/empresaexemplo9-gif/Quest

**Jogo:** Cinzas de Éridan.

**Domínio solicitado:** https://quest-game-plum.vercel.app/

Este repositório reúne o cliente do jogo, artes, roteiro, backend, banco PostgreSQL,
adaptação rAthena, instaladores Windows/macOS e versão PWA para iPad.

O backend `server/index.js` serve a interface e a API no mesmo processo. O
`compose.yaml` inicia esse serviço junto ao PostgreSQL persistente. Na Vercel,
`api/` usa o mesmo código e precisa da conexão PostgreSQL de produção.

Endereços `temporary-*.vercel.app` são avaliações que expiram. Não representam
o projeto principal nem substituem o domínio escolhido. Nenhum outro repositório
GitHub foi criado por esta implementação.
