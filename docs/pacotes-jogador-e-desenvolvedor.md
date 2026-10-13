# Distribuição para jogadores e GMs

O pacote separa o aplicativo para jogar dos arquivos necessários para desenvolver e hospedar o mundo. Os arquivos são físicos e podem ser copiados para outro computador. A pasta do jogador conecta ao servidor disponível; ela não contém um servidor nem funciona como jogo offline.

## JOGADOR

Abra `Quest-Ragnarok-Setup.exe` no Windows. O instalador cria o cliente e seu atalho. Entre pelo portal indicado no `LEIA-ME.txt`, crie uma conta e escolha uma das sete classes. Não existe PIN interno adicional. O host do mundo precisa manter o computador, o Docker e o túnel ligados. O endereço temporário do Cloudflare muda quando o túnel é recriado; os atalhos usam o portal ou consultam o manifesto público atualizado.

## DESENVOLVEDOR

`Codigo-fonte` contém o código original do Quest, os fontes do rAthena, arquivos do cliente, scripts, documentação, missões e os recursos nativos editáveis. O código vem com suas licenças e referências dos componentes utilizados. `Codigo-fonte\public\downloads\Quest-Servidor-Windows.zip` contém o runtime já preparado. O pacote do BrowEdit 3.660 verificado também acompanha os arquivos.

Abra `PREPARAR SERVIDOR.cmd` para extrair o runtime local e iniciar o servidor. Docker Desktop/WSL2, acesso à internet e os downloads verificados dos dados do cliente são necessários no computador do novo host. As credenciais são geradas nesse computador. O banco de contas e personagens do servidor original não é copiado.

Abra `EDITAR MAPA.cmd` para preparar e abrir o BrowEdit. No editor, abra `Codigo-fonte\content\eridan\data\er_chama0.rsw`. Edite também GND e GAT para alinhar texturas, terreno e colisões. Aplique as alterações com `APLICAR MAPA.cmd` após ligar o servidor local. Veja `Codigo-fonte\docs\editar-chama-viva.md` para os quatro estados e as posições das missões.

As pastas não carregam senhas, tokens, `.env` real, bancos de usuários, caches privados ou os GRFs baixados no computador do host. O runtime baixa/verifica os dados necessários pelas fontes registradas em `kro.lock.json`.

`ARQUIVOS-SHA256.json` registra cada arquivo físico do pacote e permite conferir integridade. Os ZIPs são gerados a partir das mesmas pastas verificadas.
