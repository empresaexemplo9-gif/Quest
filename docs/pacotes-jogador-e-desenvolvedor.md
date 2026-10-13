# Distribuição para jogadores e GMs

O pacote separa o aplicativo para jogar dos arquivos necessários para desenvolver e hospedar o mundo. Os arquivos são físicos e podem ser copiados para outro computador. A pasta do jogador conecta ao servidor disponível; ela não contém um servidor nem funciona como jogo offline.

## JOGADOR

Abra `Quest-Ragnarok-Setup.exe` no Windows. O instalador cria o cliente e seu atalho. Entre pelo portal indicado no `LEIA-ME.txt`, crie uma conta e escolha uma das sete classes. Não existe PIN interno adicional. O host do mundo precisa manter o computador, o Docker e o túnel ligados. O endereço temporário do Cloudflare muda quando o túnel é recriado; os atalhos usam o portal ou consultam o manifesto público atualizado.

## DESENVOLVEDOR

`Codigo-fonte` contém o código original do Quest, os fontes do rAthena, arquivos do cliente, scripts, documentação, missões e os recursos nativos editáveis. O código vem com suas licenças e referências dos componentes utilizados. `Codigo-fonte\public\downloads\Quest-Servidor-Windows.zip` contém o runtime já preparado. O pacote do BrowEdit 3.660 verificado também acompanha os arquivos.

Abra `PREPARAR SERVIDOR.cmd` para extrair o runtime local e iniciar o servidor. `Dados-do-cliente` acompanha os quatro arquivos base verificados: os GRFs, música e pacote de executáveis/DLLs. O atalho verifica e copia esses dados antes de iniciar, evitando baixar novamente os aproximadamente 4 GB. Docker Desktop/WSL2 e internet continuam necessários para preparar dependências, imagens Docker e o túnel. As credenciais são geradas nesse computador. O banco de contas e personagens do servidor original não é copiado. Este novo servidor usa seu próprio endereço temporário e não substitui o mundo principal do portal.

Abra `EDITAR MAPA.cmd` para preparar e abrir o BrowEdit. No editor, abra `Codigo-fonte\content\eridan\data\er_chama0.rsw`. Edite também GND e GAT para alinhar texturas, terreno e colisões. Aplique as alterações com `APLICAR MAPA.cmd` após ligar o servidor local. Veja `Codigo-fonte\docs\editar-chama-viva.md` para os quatro estados e as posições das missões.

As pastas não carregam senhas, tokens, `.env` real, bancos de usuários ou caches privados. Os dados base incluídos correspondem aos hashes e fontes registrados em `kro.lock.json`.

`ARQUIVOS-SHA256.json` registra cada arquivo físico do pacote e permite conferir integridade. Os ZIPs são gerados a partir das mesmas pastas verificadas.
