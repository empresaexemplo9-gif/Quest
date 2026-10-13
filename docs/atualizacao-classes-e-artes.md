# Sete classes, artes e idioma

O cliente nativo permite criar Aprendiz, Espadachim, Mago, Arqueiro, Gatuno, Noviço ou Mercador. Personagens novos começam no nível base 10 e nível de classe 10, com 80 pontos de atributo disponíveis. As habilidades básicas estão no nível 9. Cada primeira classe recebe nove pontos já distribuídos em habilidades iniciais, respeitando a árvore da classe. Isso deixa ataques, cura e recursos iniciais disponíveis sem liberar habilidades avançadas. Personagens existentes mantêm sua progressão.

O visual animado muda imediatamente com a classe escolhida. São os sprites nativos da classe, com cabelo e aparência escolhidos pelo jogador. As roupas ilustradas nas artes de referência ainda precisam ser desenhadas em sprites SPR/ACT completos para substituir esses visuais: todas as direções, movimento, ataque, dano, postura sentada e morte. Uma imagem estática de referência não contém essas animações.

Artes em português: `public/art/ragnarok/login-pt.png` e `loading-pt.png`. O login do portal e o fundo do cliente usam a primeira; a transição entre mapas usa a segunda. Para substituir no futuro, atualize os dois PNGs, execute `node client/ragnarok/apply-browser-mods.mjs` e aplique os recursos no servidor.

A tradução inclui menus da interface, mensagens de conexão/criação, muitos itens, nomes e descrições de habilidades e os diálogos originais de Éridan. A origem e a revisão do pacote comunitário estão em `content/ragnarok/SOURCES.json`. Mensagens ausentes na tradução mantêm a versão original para preservar o funcionamento. NPCs antigos e conteúdos externos ainda precisam de revisão individual; a tradução integral de todo o catálogo legado não está concluída.

Os arquivos de texto da tradução usam UTF-8. Os arquivos Lua usam Windows-1252, conforme o leitor do cliente. `scripts/prepare_portuguese_client.mjs` reconstrói a tradução a partir de fontes fixadas e valida os parâmetros de formatação das mensagens. Nomes de recursos, caminhos de sprites e custos/pré-requisitos das habilidades são preservados.

A renderização usa qualidade de 150%, limitada pelos recursos da placa de vídeo e por um orçamento de pixels. É uma melhoria de nitidez; os mapas, texturas e sprites existentes não passam a ter detalhes nativos de 16K. O limite evita criar superfícies que o aparelho não suporte. A qualidade pode ser alterada em `client/ragnarok/serve.mjs`, com nova aplicação do servidor.

Para editar a vila futurista tomada pela natureza, siga [Editar Chama Viva](editar-chama-viva.md): abra `scripts\EditarVilaWindows.cmd`, depois `content\eridan\data\er_chama0.rsw` no BrowEdit. Salve RSW, GND e GAT e aplique com `scripts\EditarVilaWindows.cmd -Aplicar`.

Compilação do cliente: `python scripts/setup_ragnarok_client.py --build-web`, após preparar as dependências. O script aplica as modificações de `client/ragnarok/mods`, usa o arquivo de dependências fixado e gera o cliente publicado. O servidor de personagens foi compilado com Renewal e protocolo 20211103; a receita está em `deploy/ragnarok/build-char-server.sh` e os hashes da versão testada em `client/ragnarok/release.lock.json`.
