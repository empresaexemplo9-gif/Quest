# Servidor Ragnarok de Quest no Windows 10/11

Este pacote inicia **o servidor**, o banco MariaDB persistente e o cliente gráfico WebGL com mapas, sprites e movimento reais do Ragnarok. Ele pertence ao mesmo repositório `empresaexemplo9-gif/Quest`; não é outro jogo. Os dados do kRO são baixados e verificados no computador que será o servidor.

## Iniciar no seu computador

1. Instale [Docker Desktop para Windows](https://docs.docker.com/desktop/setup/install/windows-install/) com **WSL2**, virtualização habilitada e containers **Linux**. Reinicie se a instalação solicitar. Abra o Docker Desktop.
2. Use **a pasta do repositório Quest que já está no seu Windows**, atualize `main` com `git pull` e abra **scripts\IniciarServidorWindows.cmd**. Ele baixa e verifica este pacote dentro de `.local\ragnarok\windows-server` do mesmo repositório. Reserve pelo menos 20 GB livres e 4 GB de RAM para o Docker. Prefira Windows x64; o runtime Linux incluído é amd64. Não é preciso criar outro projeto.
3. O primeiro início baixa aproximadamente 4 GB de arquivos do cliente, valida SHA-256, cria credenciais privadas e sobe o banco e o servidor. Aguarde a mensagem de prontidão. Se você recebeu apenas o ZIP, extraia-o dentro de `.local\ragnarok\windows-server` do repositório existente e abra **IniciarServidor.cmd** na pasta extraída.
4. O navegador abrirá o jogo. Por padrão, o acesso é **http://localhost:8080**, somente nesse computador. Crie uma conta pelo mecanismo nativo de login (`nome_M` ou `nome_F` na primeira entrada; depois use `nome`), com senha de pelo menos 8 caracteres. Não use uma senha de outro serviço.

O arquivo privado `.env` é gerado no computador, preservado nos próximos inícios e protegido por ACL no Windows. Não o compartilhe. O ZIP não contém credenciais nem contas. Guarde a pasta e os volumes Docker; atualizar o pacote não autoriza apagar jogadores.

## Jogar no iPad pela mesma rede

Descubra o IPv4 do adaptador Wi-Fi/Ethernet do PC com `ipconfig`. No Prompt de Comando, dentro da pasta do repositório, execute (substitua o exemplo pelo IP real):

```bat
scripts\IniciarServidorWindows.cmd -Origin http://192.168.1.50:8080
```

Permita a porta TCP 8080 no Firewall do Windows **para a rede privada**. Com o iPad e o PC na mesma rede, abra esse endereço no Safari. Reserve o IP do PC no DHCP do roteador. O toque foi validado em emulação de iPad; a execução no aparelho físico depende da validação no seu dispositivo. HTTP na LAN permite jogar, mas recursos de instalação/offline que exigem HTTPS não são garantidos.

## Hospedar para jogadores pela internet

O PC precisa permanecer ligado, conectado e com Docker em execução. A sessão do Codex na nuvem não acessa automaticamente esse computador e não altera seu roteador. Para implantação automática na máquina, abra este mesmo projeto em uma sessão **local do Codex**.

Para acesso público direto, são necessários um hostname de backend apontando para seu IP público, portas TCP **80 e 443** encaminhadas ao PC e liberadas no firewall, e conectividade de entrada disponível. Se a conexão usa **CGNAT**, o encaminhamento no seu roteador não basta; será necessário obter IP público do provedor ou configurar um túnel estável com hostname próprio. Não foi configurado um túnel neste pacote.

Depois de configurar DNS, roteador e firewall:

```bat
scripts\IniciarServidorWindows.cmd -Origin https://SEU-HOSTNAME-DE-BACKEND
```

O Caddy emitirá o certificado e atenderá HTTPS/WSS. Não publique MariaDB nem as portas nativas 6900/6121/5121. O endereço **https://quest-game-plum.vercel.app** continua sendo a entrada desejada; esse subdomínio pertence à Vercel. A entrada só será conectada ao backend local depois que seu endereço HTTPS público responder com `assetsReady:true` e `nativeReady:true` em `/api/readiness`.

Este pacote ainda não torna o backend acessível publicamente por si só e não substitui os instaladores antigos dos jogadores. Uma VPS paga deixa de ser necessária se o PC e sua conexão atenderem esses requisitos.

## Parar e manter dados

No Prompt de Comando, dentro da pasta extraída:

```bat
docker compose ps
docker compose logs --tail 40
docker compose stop
```

Para iniciar novamente, execute `IniciarServidor.cmd`. Nunca use `docker compose down -v` para atualizar. Preserve os volumes, `.env` e backups privados; faça backups do banco fora desse PC.

O runtime, login SQL, mapas, movimento por clique/toque e persistência após reinício foram testados em Linux/Docker. O iniciador PowerShell e o Docker Desktop no Windows físico ainda precisam ser executados e validados no seu PC.
