# Quest como servidor nesta máquina da nuvem

O servidor nativo está em execução nesta máquina Linux x86-64, dentro do **mesmo projeto Quest**. O stack `quest-ragnarok` contém MariaDB, rAthena, cliente WebGL/GRFs e Caddy. Os serviços usam reinício automático `unless-stopped` e o banco usa volume persistente.

## Verificação realizada

- MariaDB saudável, com 60 tabelas de jogo e 10 de logs.
- Login SQL real por HTTPS/WSS; certificado validado com a CA local do Caddy.
- Rejeição de origem indevida e de tentativa de proxy para porta de banco.
- O teste usa contas descartáveis e limpa apenas esses registros.

Os testes anteriores também verificaram Prontera real, movimento por clique/toque e persistência depois de reiniciar banco e jogo. Esses resultados internos não comprovam acesso público.

## Iniciar e verificar nesta máquina

```bash
export DOCKER_CONFIG=/workspace/.quest-env/docker
cd /workspace/Quest/.local/ragnarok/deployment
docker compose up -d --no-build
docker compose ps
```

Se as imagens não foram retidas no ambiente restaurado, use `docker compose up --build -d` com o contexto preparado. Preserve `.env`, volumes, configurações e backups. Não use `down -v`.

```bash
cd /workspace/Quest
DOCKER_CONFIG=/workspace/.quest-env/docker python3 scripts/test_ragnarok_deployment.py \
  --deployment .local/ragnarok/deployment --origin https://localhost:13443 \
  --ca /workspace/.quest-env/run/quest-ragnarok-local-ca.crt
```

Esses endereços são apenas para verificações internas. A disponibilidade depende de o ambiente estar ativo; a publicação/restauração da configuração não garante que processos e conexões sobrevivam.

## Acesso público bloqueado

Não foi criado um endereço público do servidor. A tentativa de Cloudflare Tunnel falhou ao resolver o endpoint externo; a requisição pelo proxy retornou **403 Forbidden**, com a mensagem `Your request was blocked`. A alternativa consultada também foi bloqueada pelo proxy. Não há uma ferramenta de publicação de portas disponível nesta sessão.

Os destinos necessários ao diagnóstico foram adicionados ao **rascunho** da configuração de rede. Salvar esse rascunho não aplica nem publica a rede. Revise e salve as alterações nas configurações do ambiente e publique a configuração para aplicá-las; depois é necessário testar de novo a conectividade e verificar se o transporte do túnel é suportado. A liberação dos nomes, sozinha, não comprova que um túnel funcionará.

O endereço de entrada desejado continua sendo **https://quest-game-plum.vercel.app**. Ele ainda não está conectado ao servidor nativo desta máquina. Só deve ser atualizado quando existir um backend público com HTTPS/WSS e login real verificados. Nenhum endereço de loopback ou túnel sem funcionamento deve ser apresentado como jogo hospedado na internet.

As tentativas de publicação não criaram recursos pagos nem alteraram dados dos jogadores. Foram removidas as imagens usadas apenas nesses diagnósticos; os serviços do jogo e seus dados foram preservados.
