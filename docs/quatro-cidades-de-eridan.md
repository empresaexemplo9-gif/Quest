# As quatro cidades e suas zonas externas

Os mapas são áreas nativas compartilhadas, com terreno GND, cenário RSW, modelos RSM e colisões GAT. As duas imagens fornecidas orientam a arquitetura e a paleta; as construções são modelos originais do jogo.

| Cidade | Identidade | Zona externa | Níveis recomendados |
| --- | --- | --- | --- |
| Citadela Rubra — `er_rubra` | Fortaleza industrial, estandartes vermelhos, praça dos guardiões e mercado de sucata | Vale das Brasas Verdes — `er_brasa` | 40–90 |
| Coroa Celeste — `er_celeste` | Catedral do Éter, fonte, jardins, cascatas e pedra clara | Floresta dos Condutores — `er_jardim` | 90–150 |
| Bastião da Última Forja — `er_forja` | Fornos, guindastes, tubulações, muralhas e oficinas | Deserto das Máquinas Vivas — `er_escomb` | 140–210 |
| Jardins de Nova Aurora — `er_azul` | Cristais, jardins, cascatas e terminal ferroviário | Selva das Marés de Éter — `er_selva` | 200–275 |

As cidades oferecem mercado, armazém, recuperação de HP/SP e salvamento do retorno. As áreas externas têm criaturas nativas, experiência, itens, respawn e uma patrulha repetível de 20 derrotas para experiência adicional. A patrulha registra somente criaturas daquela área; converse novamente com o acampamento para receber a recompensa. Equipamento, habilidades e tamanho do grupo influenciam a dificuldade.

## Como chegar

Em Aurea, a passagem nas coordenadas **80,64** leva à Citadela Rubra. Na Vila das Raízes, **80,60** leva a Nova Aurora. Todas as chegadas ficam afastadas do ponto de retorno para evitar viagens involuntárias em sequência.

O circuito completo tem passagens de ida e volta:

**Citadela Rubra ↔ Vale das Brasas ↔ Coroa Celeste ↔ Floresta dos Condutores ↔ Última Forja ↔ Deserto das Máquinas ↔ Nova Aurora ↔ Selva das Marés ↔ Citadela Rubra.**

Siga a avenida principal, as placas e os portões norte/sul. Os mapas continuam ligados à rede da Chama Viva, florestas, costa, vilas, desertos e masmorras existentes. As bordas possuem muralhas, falésias ou dunas e bloqueios correspondentes no servidor.

## Começar a editar

1. Copie a pasta `content/eridan/data/` como backup. Abra no BrowEdit o arquivo RSW da cidade, por exemplo **`er_rubra.rsw`**.
2. Edite prédios, vegetação, caminhos e texturas. Os novos modelos ficam em **`data/model/eridan/fc_*.rsm`**; as texturas, em **`data/texture/eridan/`**. Ao mudar obstáculos, ajuste também o **GAT**.
3. As coordenadas de serviços, monstros e passagens ficam em **`rathena/eridan-cities.txt`**. A descrição dos caminhos, chegadas e pontos acessíveis fica em **`content/eridan/world.json`**. Mantenha ambos consistentes quando mover um portão ou NPC.
4. Valide com **`node client/ragnarok/prepare-city.mjs . --validate`** e atualize os minimapas com **`python scripts/build_world_minimaps.py`**. A inicialização prepara o cache nativo com as mesmas colisões.

O gerador **`scripts/build_four_cities.mjs`** recria somente esta expansão e salva um backup em `.local/ragnarok/map-backups/`. Uma geração substitui as edições manuais destes oito mapas. Os mapas anteriores são preservados. Para manter o trabalho do BrowEdit, valide os arquivos editados e evite executar novamente o gerador.

Os GMs podem inspecionar com **`@warp er_rubra 96 86`**, **`@warp er_celeste 96 86`**, **`@warp er_forja 96 86`** e **`@warp er_azul 96 86`**.
