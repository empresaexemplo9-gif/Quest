# Cores das roupas e botas

A correção da versão 2.0.8 está no cliente portátil e no cliente web do servidor.
Feche a tela anterior e abra **Jogar.cmd** para carregar a renderização atualizada.

O shader anterior consultava a paleta com coordenadas normalizadas. O último
índice, 255, podia repetir o primeiro índice e transformar detalhes claros em
preto. O novo shader consulta cada índice inteiro e suaviza somente as cores
já decodificadas, respeitando a transparência nas bordas do sprite.

As paletas também passam a tingir materiais neutros de armaduras e botas.
As cores de cabelo e rosto protegidas permanecem iguais à referência. Preto
mantém um acabamento escuro, e Prata recebe um acabamento mais claro.

O recorte das animações também usa os espaços reais entre as poses. A divisão
anterior em sete faixas iguais cortava a parte inferior de algumas botas.

Os arquivos PNG originais foram preservados. A geração reproduzível está em
`scripts/compile_outfit_atlas.mjs`, e o shader está em
`client/ragnarok/mods/SpritePaletteQuest.fs`.

Validação: paletas das sete classes e dos dois estilos, tintura das botas,
proteção do rosto, distinção entre Preto e Prata, leitura nativa dos 784
quadros/1456 ações e teste real de WebGL com todos os 256 índices.
Para repetir o teste na GPU, execute `node scripts/test_sprite_palette_gpu.mjs`
e abra o endereço local informado.
