# Gráficos do jogo

O cliente nativo do Quest tem o painel **Gráficos**, no canto superior direito do cenário. **Ultra 8K** solicita um cenário de até 7680 × 4320 pixels, preservando o formato da janela. A interface mantém seu tamanho legível. Em telas menores, a imagem é renderizada em resolução maior e reduzida para suavizar as bordas (supersampling).

O painel mostra **Resolução em uso**, lida do buffer real do WebGL. Não significa que o monitor virou 8K nem que os sprites clássicos foram recriados com detalhes nativos de 8K. Os materiais do mundo usam filtragem trilinear, mipmaps e filtragem anisotrópica de até 16×, respeitando o suporte do dispositivo.

O modo Ultra 8K é o padrão para computadores; dispositivos móveis começam em 4K e têm limite de pixels menor. As preferências ficam apenas no navegador do jogador. Em hardware lento, **Ajustar para manter fluidez** reduz gradualmente a resolução após medir a renderização. Desmarque essa opção para manter a resolução solicitada, dentro dos limites da GPU. **Alta 4K**, **Alta — 150%** e **Leve — 100%** permitem reduzir o custo imediatamente.

O renderer respeita `MAX_TEXTURE_SIZE`, `MAX_RENDERBUFFER_SIZE` e `MAX_VIEWPORT_DIMS`. Em caso de perda do contexto gráfico, a restauração utiliza resolução menor. Isso protege o funcionamento sem alterar contas, personagens, mapas ou colisões.

Implementação: `client/ragnarok/mods/GraphicsQuest.js`, aplicada ao cliente upstream verificado por `client/ragnarok/apply-browser-mods.mjs`. Verificação: `node --test client/ragnarok/tests/graphics.test.mjs`. Reconstrua o cliente; não altere o runtime verificado manualmente sem atualizar seu hash em `client/ragnarok/release.lock.json`.

Referências oficiais: [especificação WebGL](https://registry.khronos.org/webgl/specs/latest/1.0/) e [filtragem anisotrópica](https://registry.khronos.org/webgl/extensions/EXT_texture_filter_anisotropic/).
