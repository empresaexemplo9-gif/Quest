# Central compartilhada do Quest

Endereço: **https://quest-game-plum.vercel.app/arquivos.html**.

A central é pública e permite baixar os arquivos do jogador e do desenvolvedor de qualquer computador, tablet ou celular. A hospedagem dos arquivos fica no GitHub Releases e a plataforma na Vercel. Nenhum download depende do PC que hospeda o servidor do jogo. Jogar online continua exigindo o servidor ligado.

- **Jogador:** instalador Windows e acesso ao portal; os instaladores macOS permanecem na página de downloads.
- **Projeto completo:** código, servidor, editor, mapas, artes e os quatro arquivos base do cliente. No Windows, abra `Baixar-Quest-GM.cmd`: ele baixa três partes, verifica todos os SHA-256 e monta `DESENVOLVEDOR.zip` na pasta `Quest - Arquivos Compartilhados` da Área de Trabalho.
- **Desenvolvimento compacto:** todos os arquivos de desenvolvimento, incluindo BrowEdit e runtime, sem os quatro arquivos grandes de dados base. O preparador do servidor baixa e confere os dados base quando necessário.
- **Arquivos individuais:** navegue por pastas, pesquise por nome e filtre mapas, artes, história, cliente, servidor ou ferramentas. Cada link corresponde à revisão indicada no rodapé do explorador.

No macOS/Linux, baixe as três partes completas e `Montar-Quest-GM.py` na mesma pasta. Execute `python3 Montar-Quest-GM.py` com Python 3.11 ou superior. O montador preserva ZIPs existentes que tenham conteúdo diferente.

O acervo permite leitura e download. Para compartilhar alterações de desenvolvimento, use o repositório `empresaexemplo9-gif/Quest`, com commits e revisão. Não há upload anônimo de arquivos, nem exposição das contas dos jogadores, credenciais, `.env` real, bancos ou diretórios privados de runtime.

O catálogo é gerado no checkout completo pelo script `scripts/build_file_central.mjs`, usando somente arquivos acompanhados pelo Git e uma revisão confirmada. Depois de salvar os fontes em um commit, execute o build e salve o catálogo gerado em um segundo commit. A Vercel valida esse catálogo publicado: não precisa receber os milhares de arquivos do engine para montar a página. Os links do catálogo ficam presos à revisão indicada, evitando misturar versões.

`scripts/preparar_central_arquivos.py` prepara a distribuição a partir de uma pasta física já validada. `scripts/publicar_arquivos_github.py` publica em rascunho, confere os tamanhos e SHA-256 retornados pelo GitHub, e só então libera a versão.
