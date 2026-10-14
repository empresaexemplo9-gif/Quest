# Personagens GM e roupas

As contas GM do servidor principal recebem o grupo nativo 98. Esse grupo permite todos os comandos de administração, habilidades e equipamentos. As credenciais e o banco de jogadores são privados e não acompanham os pacotes públicos.

Na criação, escolha uma das sete classes, o nível de 1 a 275 e a cor do traje. O servidor valida a conta GM antes de aceitar o nível personalizado. Jogadores comuns continuam começando no nível base/classe 10, com as habilidades iniciais da classe.

Até o nível 99, a classe inicial é mantida. Acima dele, o caminho evolui para a terceira classe; acima de 200, para a quarta classe correspondente. O nível 275 aplica automaticamente a roupa épica. Outros níveis usam a primeira referência. Os trajes possuem aparência própria: rosto e cabelo da arte fazem parte do sprite. Para usar a aparência clássica com cabelo e equipamentos separados, escolha esse visual no atelier.

Ao entrar pela primeira vez, o personagem GM recebe todas as habilidades, atributos de laboratório, recursos e o arsenal da sua família. O conjunto equipado atende ao nível escolhido; o inventário também recebe os equipamentos superiores selecionados da classe. Itens refináveis são entregues em +20; os que aceitam graduação recebem grau A. O inventário tem o limite nativo de 100 espaços. Se estiver cheio, guarde itens e peça a reposição.

Use **@gmquest** no chat ou converse com o **Atelier GM**, na Chama Viva, coordenadas 51,28, para mudar nível, repor o arsenal, manter ou trocar roupas e escolher Natural, Vermelho, Azul, Verde, Violeta, Dourado, Prata ou Preto.

O catálogo usa o banco Renewal fixado no projeto. A seleção considera nível da arma/armadura, ataque, ataque mágico, defesa e espaços para cartas. Bônus de scripts e combinações específicos podem favorecer outros equipamentos; todos os comandos GM continuam disponíveis para ajustar esses testes.

Para editar:

- Roupas originais: `content/gm/atlases/` (sete classes, padrão e épica).
- Animações jogáveis SPR/ACT e paletas: `content/ragnarok/data/sprite/quest/`.
- Recompilação de um atlas: `node scripts/compile_outfit_atlas.mjs sword-standard content/gm/atlases/sword-standard.png` (requer pngjs).
- Seleção do arsenal: `scripts/build_gm_arsenal.mjs` e `content/gm/arsenal.json`.
- Regras GM: `rathena/quest-gm.txt`, `quest-gm-arsenal.txt` e `quest-groups.yml`.

Em um servidor independente, provisione contas usando `scripts/provisionar_gms.py --help` e um JSON privado fora das pastas compartilhadas. Não publique esse JSON.
