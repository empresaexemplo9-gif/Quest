# Hospedagem do Ragnarok de Quest

O projeto continua em `empresaexemplo9-gif/Quest`, branch `main`. O endereço de entrada solicitado é **https://quest-game-plum.vercel.app**. A Vercel hospeda a entrada e os arquivos estáticos; rAthena, MariaDB, GRFs e WebSocket precisam de um servidor persistente. O pacote abaixo foi testado neste ambiente e ainda não está publicado em uma VPS.

## VPS e acesso que faltam

Use uma VPS **Linux x86-64**, com Docker Engine e Compose, inicialmente com **2 vCPUs, 4 GB de RAM e 40 GB de disco**. Os binários exportados são x86-64. Não selecione ARM. A capacidade para jogadores simultâneos precisa de teste de carga; esses recursos são uma configuração inicial.

Opção padrão: [Hetzner Cloud](https://www.hetzner.com/cloud/). Crie uma conta com faturamento, um projeto e um token de API com leitura/escrita. Insira **HCLOUD_TOKEN nas configurações seguras deste ambiente**, destinado somente a `api.hetzner.cloud`. Nunca envie o token no chat ou no Git. A alternativa é disponibilizar uma VPS existente com autenticação SSH por chave.

```bash
cd /workspace/Quest
python3 scripts/plan_ragnarok_vps.py --location ash
```

Esse comando apenas consulta planos x86-64 e preços reais da API; não cria nem cobra recursos. A localização e o custo total, incluindo IPv4 e backups, devem ser definidos antes da criação. Nenhuma VPS paga foi criada por estes scripts.

## Preparar o pacote para o endereço real do servidor

Use os componentes já preparados em [ragnarok-client.md](ragnarok-client.md). O exportador exige os quatro binários rAthena compilados, os GRFs verificados, a tradução e os clientes WebGL/RemoteClient instalados. Ele não compila nem baixa arquivos durante a exportação.

```bash
cd /workspace/Quest
python3 scripts/prepare_ragnarok_deployment.py \
  --backend-url https://SEU-ENDERECO-DO-SERVIDOR \
  --output .local/ragnarok/deployment-production
```

O diretório gerado contém Compose, Caddy e `context/`. O `.env` fica separado da imagem, com permissão 0600 e credenciais aleatórias. Arquivos privados de `conf/import` não entram no pacote da imagem. O exportador preserva um destino já existente e recusa substituí-lo. GRFs compartilham armazenamento local com os originais; a transferência para a VPS deve incluir os bytes completos.

Transfira esse diretório por SSH/SFTP para uma pasta privada da VPS e mantenha `.env` em 0600. Não envie o pacote para GitHub ou Vercel. No primeiro deploy, abra 80/443 para HTTP/HTTPS/WSS e restrinja SSH à administração. MariaDB e os servidores nativos não têm portas publicadas; a conexão WebSocket aceita somente login, char e map em loopback.

```bash
# Na VPS, dentro do diretório transferido:
docker compose up --build -d
docker compose ps
```

O DNS do endereço de backend deve apontar para a VPS antes da emissão automática de TLS pelo Caddy. Não tente apontar `quest-game-plum.vercel.app` por DNS para a VPS: esse subdomínio pertence à Vercel. A entrada da Vercel será conectada ao endereço HTTPS/WSS do backend depois da validação pública.

## Validação realizada

O stack `quest-ragnarok` é separado do stack anterior, dentro do mesmo projeto. Foram verificados:

- Importação limpa de 60 tabelas de jogo e 10 de logs, com credenciais do interserver compatíveis com o protocolo.
- Login SQL, PIN, entrada no mapa 3D real de Prontera e movimento com posição salva, por mouse e toque em emulação de iPad.
- HTTPS com certificado validado pela CA local do Caddy, WSS autenticado e rejeição de origem/porta indevidas.
- Persistência de conta, personagem, posição e inventário após reiniciar o banco e o jogo.
- Arquivos padrão de configuração e conexão de login/char/map sem erros de inicialização. O health check exige recursos reais do mapa e as conexões entre os servidores.

```bash
# Teste gráfico de um stack de teste com origem HTTP de loopback:
DOCKER_CONFIG=/workspace/.quest-env/docker python3 scripts/test_ragnarok_browser.py \
  --site http://127.0.0.1:13005 --deployment .local/ragnarok/deployment

# Stack local atual com HTTPS; a CA foi copiada do container Caddy:
DOCKER_CONFIG=/workspace/.quest-env/docker python3 scripts/test_ragnarok_deployment.py \
  --deployment .local/ragnarok/deployment --origin https://localhost:13443 \
  --ca /workspace/.quest-env/run/quest-ragnarok-local-ca.crt --restart
```

O primeiro comando exige que o stack de teste use essa origem HTTP em seu `.env`; o stack retido está configurado para HTTPS após a validação gráfica. No backend público, omita `--ca` e use a cadeia de certificados pública. Use `--restart` somente no stack de teste ou durante manutenção planejada. Os testes criam e removem apenas contas descartáveis. O toque foi emulado no Chromium; o aparelho iPad físico não foi validado.

## Dados e manutenção

MariaDB usa um volume persistente. **Não execute `docker compose down -v` para atualizar o servidor.** Preserve `.env`, volumes, backups e configurações de acesso. Para atualizar a imagem, mantenha os mesmos valores de credenciais e use `docker compose up --build -d`. O esquema SQL é importado apenas na primeira inicialização de um banco vazio; migrações posteriores exigem backup e procedimento específico.

Crie backups privados com `mariadb-dump` dentro do container e teste a restauração em outro banco vazio. A VPS e backups fora dela são necessários para hospedagem durável; os serviços deste ambiente de desenvolvimento não substituem essa VPS.

A ativação pública também exige atualizar a entrada da Vercel e os instaladores para o cliente nativo. Os instaladores antigos e o site atual ainda usam a versão anterior. Este pacote não transforma os executáveis oficiais de 2020 em clientes Windows modificados de 20211103 e não implementa automaticamente todos os mapas e conteúdos novos do documento de história.
