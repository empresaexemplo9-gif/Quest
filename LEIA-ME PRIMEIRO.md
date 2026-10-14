# Éridan

Este é o único projeto do jogo. No computador principal, ele fica em **C:\Eridan**, com o acesso **Éridan** na área de trabalho.

- **Jogar.cmd** abre o cliente portátil. Ele usa somente as pastas `Cliente` e `Dados` deste projeto.
- **Ligar Servidor.cmd** liga o mundo e informa quando está pronto. Contas e personagens existentes são preservados.
- **Editar Mapas.cmd** abre o BrowEdit. Os mapas editáveis ficam em **content/eridan/data**.
- **Arquivos.url** abre a central pública para compartilhar o jogo e os arquivos de desenvolvimento.

`Dados` contém uma única cópia dos dados Ragnarok, compartilhada pelo cliente e pelo servidor. `Servidor` contém o serviço nativo preparado. `Distribuicao` contém os ZIPs para enviar. O restante desta pasta é o código e o conteúdo editável. `.local` e `.git` guardam cache, diagnóstico privado, arquivos recuperados e histórico de desenvolvimento.

O pacote Jogador contém uma pasta **Eridan** com o acesso ao jogo. O pacote Desenvolvedor também contém uma única pasta **Eridan**, com o jogo, dados, servidor e código, sem pastas de projeto dentro de outras cópias do projeto. As atualizações mantêm esses mesmos caminhos.

Guias: [Quatro cidades e caça](docs/quatro-cidades-de-eridan.md), [contas e roupas GM](docs/contas-gm-e-roupas.md), [controles de toque](docs/controles-ipad.md).
