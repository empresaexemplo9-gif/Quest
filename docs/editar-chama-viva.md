# Editar a vila da Chama Viva

A vila é um mapa nativo original de Éridan: ruínas de Helios cobertas de musgo, árvores com troncos e copas orgânicas, estufa, oficina, muralha reaproveitada e torre de sinal. O acabamento v2 inclui 156 objetos, 21 modelos, pavimentação com transições para a vegetação, materiais pintados, portas, janelas, telhados, andaimes da torre, cisterna, bancos, jardineiras, luminárias, caixotes e sucata. Os quatro estados recebem os mesmos detalhes e mantêm a evolução da oficina, estufa e torre.

Na pasta do Quest, abra **`scripts\EditarVilaWindows.cmd`**. O comando prepara o BrowEdit 3.660 verificado, aponta para os recursos do seu servidor e abre o editor. Em **File > Open**, abra **`content\eridan\data\er_chama0.rsw`**. Os outros estados ficam na mesma pasta:

| Mapa | Estado |
|---|---|
| `er_chama0` | Ruínas ocupadas pela floresta |
| `er_chama1` | Oficina recuperada |
| `er_chama2` | Estufa reconstruída |
| `er_chama3` | Torre de Helios reativada |

Use **Object Edit** para mover, girar, duplicar ou trocar construções. Use **Texture Edit** para pisos e **Height Edit** para terreno. Em **Gat Edit**, marque as construções como bloqueadas e mantenha as ruas caminháveis. Mover um prédio não move automaticamente a colisão nem o NPC. Salve os arquivos **RSW, GND e GAT** e faça as alterações comuns nos quatro estados.

Modelos próprios: `content\eridan\data\model\eridan`. Texturas próprias: `content\eridan\data\texture\eridan`. Diálogos, entregas e posições dos NPCs: **`rathena\chama-viva.txt`**. Posições necessárias para o validador: **`content\eridan\city.json`**. Se mover NPCs ou a entrada, atualize o script e esse JSON juntos.

Para aplicar, execute **`scripts\EditarVilaWindows.cmd -Aplicar`**. O comando verifica se entrada, saída e NPCs continuam acessíveis, guarda a versão anterior em `.local\ragnarok\map-backups`, atualiza os arquivos do servidor e reinicia o serviço do jogo. Jogadores conectados precisarão entrar novamente. As contas e os personagens ficam no banco existente. O túnel continua usando a mesma porta.

O cache de colisões é reconstruído a partir do GAT salvo, preservando os demais mapas. O script **`scripts\build_eridan_city.mjs`** reproduz a versão detalhada: **não o execute depois de editar**, pois ele substitui os quatro mapas. A fonte dos materiais está em `content\eridan\sources\materiais-vila-v2.png`; `scripts\prepare_eridan_materials.py` separa o atlas em BMPs nativos e prepara as transições da pavimentação. Os caminhos dos NPCs, da entrada, da saída e dos suprimentos são validados nas quatro etapas.

No jogo, personagens novos começam na vila. Personagens antigos podem falar com **Rota da Chama Viva**, em Prontera `(148,174)`. A praça fica em `(48,34)`. Recupere suprimentos nos depósitos e entregue na oficina, na estufa e na torre. O mundo muda para o estado seguinte; cada personagem recebe a recompensa de cada entrega uma única vez.

Controles do BrowEdit: botão do meio move a câmera; Shift + botão do meio gira; roda do mouse aproxima. Em Object Edit, selecione o objeto e use Move, Rotate ou Scale. Configuração: **Edit > Configure**, RO Path aponta para `content\eridan\`, e GRFs aponta para os arquivos locais do servidor. O editor é um aplicativo local; o domínio continua sendo o acesso dos jogadores.

Referências oficiais: [BrowEdit e controles](https://github.com/Borf/BrowEdit3), [edição de objetos](https://github.com/Borf/BrowEdit3/blob/master/docs/ObjectEdit.md) e [configuração](https://github.com/Borf/BrowEdit3/blob/master/docs/Configuration.md).
