export const VERSION = '1.0.0';
export const LEVEL_CAP = 80;
export const WORLD = { width: 9600, height: 3600, regionWidth: 2400, regionHeight: 1800 };
export const RESOURCES = { water: 'Água limpa', energy: 'Células de energia', food: 'Biomassa', materials: 'Sucata metálica', ether: 'Fragmentos de Éter', data: 'Dados antigos' };
export const ATTRIBUTE_NAMES = { strength:'Força', vitality:'Vigor', dexterity:'Destreza', perception:'Percepção', defense:'Defesa', intelligence:'Inteligência', faith:'Fé', will:'Vontade' };
export const RARITIES = ['Comum','Incomum','Raro','Épico','Lendário','Relíquia de Helios'];

export const CLASSES = {
  warrior: { name:'Guerreiro', tagline:'O aço ainda tem voz.', role:'Linha de frente · combos e dano físico', color:'#e29b70', weapon:'Lâmina de plasma', icon:'blade', hp:145, mana:75, range:112, speed:208, attack:18,
    attributes:{strength:8,vitality:7,dexterity:3,perception:3,defense:4,intelligence:2,faith:2,will:3},
    promotions:[{id:'gladiator',name:'Gladiador de Guerra',final:'Senhor da Arena',role:'Área, sangramento e fúria'},{id:'phantom',name:'Lâmina-Fantasma',final:'Sombra de Aço',role:'Mobilidade, críticos e execuções'}],
    skills:[{id:'cleave',name:'Arco de plasma',kind:'area',level:1,cost:15,cooldown:4,scale:1.7,range:150,description:'Um golpe circular que atinge todos os inimigos próximos.'},{id:'dash',name:'Investida cinzenta',kind:'dash',level:8,cost:20,cooldown:7,scale:2,range:270,description:'Avança até o alvo e rompe sua defesa.'},{id:'fury',name:'Fúria da Ruptura',kind:'buff',level:20,cost:25,cooldown:16,scale:1.5,description:'Amplifica o dano e a velocidade por 8 segundos.'},{id:'execution',name:'Último horizonte',kind:'execute',level:30,cost:32,cooldown:12,scale:3.4,range:160,description:'Ataque de promoção. Alvos feridos sofrem dano adicional.'}] },
  archer: { name:'Arqueiro',tagline:'O alvo aparece antes do horizonte.',role:'Longa distância · precisão e controle',color:'#a8c78e',weapon:'Arco de pulso',icon:'bow',hp:110,mana:90,range:440,speed:220,attack:15,
    attributes:{strength:3,vitality:4,dexterity:8,perception:7,defense:2,intelligence:3,faith:2,will:3},
    promotions:[{id:'sniper',name:'Atirador de Elite',final:'Olho do Rasgo',role:'Precisão, alcance e perfuração'},{id:'hunter',name:'Caçador de Rastros',final:'Senhor das Trilhas',role:'Armadilhas e companheiro mecânico'}],
    skills:[{id:'charged',name:'Disparo de trilho',kind:'shot',level:1,cost:14,cooldown:4,scale:2.1,range:540,description:'Disparo concentrado que atravessa a armadura.'},{id:'trap',name:'Armadilha de pulso',kind:'control',level:8,cost:20,cooldown:8,scale:1.1,range:410,description:'Imobiliza o alvo e desacelera seus movimentos.'},{id:'drone',name:'Drone de caça',kind:'summon',level:20,cost:28,cooldown:18,scale:1,description:'Um companheiro mecânico luta ao seu lado por 18 segundos.'},{id:'volley',name:'Chuva de fusão',kind:'area',level:30,cost:35,cooldown:12,scale:2.5,range:460,description:'Uma tempestade de projéteis sobre o alvo.'}] },
  tank: {name:'Tank',tagline:'A última muralha é você.',role:'Proteção · barreiras e contra-ataque',color:'#8dbac8',weapon:'Escudo de exoenergia',icon:'shield',hp:195,mana:80,range:108,speed:188,attack:12,
    attributes:{strength:5,vitality:9,dexterity:2,perception:3,defense:8,intelligence:2,faith:2,will:4},
    promotions:[{id:'guardian',name:'Guardião de Muralha',final:'Bastião Eterno',role:'Barreiras e defesa de aliados'},{id:'colossus',name:'Colosso Reativo',final:'Titã de Ferro',role:'Provocação e reflexão de dano'}],
    skills:[{id:'aegis',name:'Égide de Éter',kind:'shield',level:1,cost:15,cooldown:7,scale:1.8,description:'Protege você e os aliados próximos com um escudo.'},{id:'taunt',name:'Chamado de ferro',kind:'taunt',level:8,cost:18,cooldown:8,scale:1.2,range:260,description:'Atrai a atenção dos inimigos e reduz seu dano.'},{id:'reactor',name:'Reator de impacto',kind:'reflect',level:20,cost:25,cooldown:16,scale:1.5,description:'Converte o dano recebido em contra-ataques.'},{id:'bastion',name:'Muralha viva',kind:'area',level:30,cost:32,cooldown:13,scale:2.3,range:220,description:'Uma onda de exoenergia derruba os inimigos próximos.'}] },
  lumen: {name:'Mago de Lúmen',tagline:'Mesmo nas cinzas, a luz permanece.',role:'Cura · purificação e magia radiante',color:'#efcf86',weapon:'Prisma solar',icon:'sun',hp:100,mana:135,range:365,speed:205,attack:16,
    attributes:{strength:2,vitality:3,dexterity:3,perception:4,defense:2,intelligence:8,faith:8,will:4},
    promotions:[{id:'priest',name:'Sacerdote Solar',final:'Voz da Aurora',role:'Cura, purificação e ressurreição'},{id:'prism',name:'Arcanista Prismático',final:'Mestre do Espectro',role:'Feixes e explosões de luz'}],
    skills:[{id:'dawn',name:'Toque da aurora',kind:'heal',level:1,cost:18,cooldown:6,scale:2.2,description:'Restaura vida de todos os aliados próximos e purifica maldições.'},{id:'beam',name:'Lança de Helios',kind:'shot',level:8,cost:22,cooldown:5,scale:2.4,range:440,description:'Um feixe de Lúmen atravessa a escuridão.'},{id:'prismwall',name:'Círculo prismático',kind:'shield',level:20,cost:30,cooldown:14,scale:2,description:'Cria uma barreira radiante para a equipe.'},{id:'supernova',name:'Aurora total',kind:'area',level:30,cost:38,cooldown:12,scale:2.8,range:390,description:'Purifica o campo com uma explosão solar.'}] },
  umbra: {name:'Feiticeiro de Umbra',tagline:'O vazio também responde.',role:'Drenagem · maldições e invocações',color:'#b5a0df',weapon:'Foice de Umbra',icon:'moon',hp:105,mana:125,range:345,speed:207,attack:17,
    attributes:{strength:2,vitality:4,dexterity:3,perception:3,defense:2,intelligence:8,faith:2,will:9},
    promotions:[{id:'reaper',name:'Ceifador do Vazio',final:'Arauto da Noite',role:'Drenagem e execução'},{id:'summoner',name:'Invocador do Abismo',final:'Senhor do Abismo',role:'Criaturas sombrias e maldições'}],
    skills:[{id:'drain',name:'Sede do vazio',kind:'drain',level:1,cost:15,cooldown:5,scale:1.7,range:375,description:'Rouba vida do alvo. O poder de Umbra também cobra sua vitalidade.'},{id:'curse',name:'Marca do Rasgo',kind:'curse',level:8,cost:22,cooldown:8,scale:1.3,range:390,description:'Amaldiçoa o alvo, causando dano contínuo e reduzindo seu defesa.'},{id:'shadow',name:'Eco do abismo',kind:'summon',level:20,cost:28,cooldown:18,scale:1.2,description:'Invoca uma criatura do Éter por 18 segundos.'},{id:'voidstorm',name:'Horizonte do vazio',kind:'area',level:30,cost:36,cooldown:12,scale:3,range:370,description:'Rasga o chão com uma onda de energia sombria.'}] }
};

export const REGIONS = [
  {id:'shelter',name:'Vale do Abrigo',subtitle:'Onde a última chama ainda respira',min:1,max:15,color:'#4f625a',accent:'#c5aa75',biome:'scrub',enemies:['Rastejante de sucata','Drone corrompido','Lobo das cinzas'],boss:'Sentinela do Abrigo',faction:'Chama Viva'},
  {id:'neon',name:'Pântano Neon',subtitle:'A indústria aprendeu a respirar',min:15,max:30,color:'#345b58',accent:'#7fc6af',biome:'swamp',enemies:['Híbrido luminescente','Sentinela tóxica','Parasita de Éter'],boss:'Mãe do Pântano',faction:'Chama Viva'},
  {id:'glass',name:'Mares de Areia Vítrea',subtitle:'O deserto guarda a luz de um sol morto',min:25,max:40,color:'#766751',accent:'#deb787',biome:'desert',enemies:['Escorpião vítreo','Autômato errante','Saqueador de cristal'],boss:'Vigia-Zero',faction:'Companhia Ferrugem'},
  {id:'rust',name:'Cordilheira Ferrugem',subtitle:'Entre a montanha e o ferro, o trabalho resiste',min:35,max:50,color:'#665448',accent:'#c6906e',biome:'mountain',enemies:['Androide minerador','Colosso enferrujado','Predador de minério'],boss:'Forja-Mãe',faction:'Companhia Ferrugem'},
  {id:'forest',name:'Floresta Sussurrante',subtitle:'As raízes lembram o que os homens esqueceram',min:40,max:55,color:'#3c5148',accent:'#9dbe8b',biome:'forest',enemies:['Raiz parasitária','Guardião híbrido','Cultista da estufa'],boss:'Coração da Estufa',faction:'Irmandade do Vazio'},
  {id:'thalassa',name:'Cidade Submersa de Thalassa',subtitle:'Uma civilização sob a maré',min:50,max:65,color:'#355263',accent:'#91c6d5',biome:'water',enemies:['Androide de maré','Predador abissal','Guarda afogado'],boss:'Leviatã de Thalassa',faction:'Sentinelas de Thalassa'},
  {id:'rift',name:'Terras Cinzentas do Rasgo',subtitle:'O céu já não sabe onde termina',min:60,max:75,color:'#50455e',accent:'#b9a4da',biome:'rift',enemies:['Eco do vazio','Fera de gravidade','Desperto corrompido'],boss:'Devorador do Horizonte',faction:'Ordem do Amanhecer'},
  {id:'aurea',name:'Aurea Prime',subtitle:'Sete coroas. Um último destino.',min:70,max:80,color:'#645d52',accent:'#e5c77d',biome:'city',enemies:['Guarda do Dominion','Executor da Coroa','Exoesqueleto imperial'],boss:'Imperatriz Kaelith Drax',faction:'Dominion'}
].map((region,index)=>({...region,index,x:(index%4)*2400,y:Math.floor(index/4)*1800}));

export const NPCS = [
 {id:'mara',name:'Mara Voss',title:'Fundadora da Chama Viva',region:0,x:430,y:430,color:'#e1ac75',role:'story',dialogue:'Você acordou. Abrigo 77, se ainda consegue ler o número. O mundo que conhecia se foi, Desperto. Água e energia: encontre isso e eu lhe ensino a sobreviver.'},
 {id:'workshop',name:'Iria, a Forjadora',title:'Oficina da Chama Viva',region:0,x:615,y:350,color:'#a7bdba',role:'craft',dialogue:'Os velhos chamavam isto de sucata. Eu chamo de amanhã. Traga materiais e células; sua guilda vai precisar de ferramentas, não apenas de armas.'},
 {id:'orin',name:'Orin Kael',title:'Ordem do Amanhecer',region:1,x:450,y:430,color:'#ead49e',role:'lore',dialogue:'A luz tem um preço: disciplina. Mara escolheu esquecer o seu dever. Quando o Rasgo vier, entenderá por que precisamos de ordem.'},
 {id:'tobias',name:'Tobias Ferrugem',title:'Companhia Ferrugem · Oásis Cobre',region:2,x:425,y:430,color:'#d4a981',role:'market',dialogue:'Água, notícias ou munição? Informação boa não enferruja. Há um androide dentro daquela torre que não distingue mais amigo de inimigo.'},
 {id:'engineer',name:'Sena, Engenheira de Porto Ferro',title:'Companhia Ferrugem',region:3,x:430,y:430,color:'#c39880',role:'craft',dialogue:'A Coroa de Ferro controla a água porque ninguém controla as oficinas. Uma forja livre pode mudar isso.'},
 {id:'nyx',name:'Nyx',title:'Desperta de Umbra',region:4,x:445,y:430,color:'#b49bd8',role:'lore',dialogue:'A escuridão não quer ser sua inimiga. Quer ser sua escolha. A estufa está alimentando Umbra: destrua, domine, ou encontre um terceiro caminho.'},
 {id:'thalassa-keeper',name:'Lys de Thalassa',title:'Sentinelas de Thalassa · Cais Aurora',region:5,x:450,y:430,color:'#8fbdcf',role:'lore',dialogue:'Quando o Farol acender, nosso velho guardião acordará. Ele não conhece mais nossos nomes. Leve aliados; a maré não poupa ninguém.'},
 {id:'helios',name:'HELIOS-IA',title:'Fragmento consciente do sol',region:6,x:435,y:430,color:'#e8c988',role:'story',dialogue:'Sete Cacos Maiores. Um Núcleo intacto. O Rasgo cresce, mas vocês ainda podem escolher. Mara construiu a máquina; Kaelith quer ser sua dona.'},
 {id:'kaelith',name:'Kaelith Drax',title:'Imperatriz do Dominion',region:7,x:440,y:430,color:'#c19d92',role:'lore',dialogue:'Liberdade sem ordem foi o que destruiu Helios. Se quiserem decidir o futuro, primeiro atravessem minhas muralhas.'}
].map(npc=>({...npc,x:npc.x+REGIONS[npc.region].x,y:npc.y+REGIONS[npc.region].y}));

export const CAMPAIGN = [
 {id:'wake',title:'O Despertar',act:'Ato I · A última chama',npc:'mara',description:'Mara Voss precisa de água limpa e células de energia para a vila.',objectives:[{type:'gather',key:'water',count:3,label:'Coletar água limpa'},{type:'gather',key:'energy',count:3,label:'Coletar células de energia'}],xp:180,credits:70,reward:'potion'},
 {id:'clear',title:'Nas ruínas do Abrigo 77',act:'Ato I · A última chama',npc:'mara',description:'Proteja as rotas do abrigo. Cada Desperto próximo à luta recebe sua recompensa.',objectives:[{type:'kill',region:0,count:5,label:'Derrotar criaturas no Vale'}],xp:360,credits:110,reward:'starter'},
 {id:'community',title:'Construir juntos',act:'Ato I · A última chama',npc:'mara',description:'Una-se à Chama Viva ou a uma guilda de Despertos. Contribua para a sobrevivência da comunidade.',objectives:[{type:'guild',count:1,label:'Entrar em uma guilda'},{type:'donate',count:10,label:'Doar recursos comunitários'}],xp:650,credits:180,reward:'seal'},
 {id:'signal',title:'Uma voz entre as cinzas',act:'Ato II · Cacos de um sol',npc:'mara',description:'Reative a Torre do Vale e descubra o que aconteceu com Helios.',objectives:[{type:'tower',region:0,count:1,label:'Reativar a Torre de Sinal'},{type:'lore',key:'rupture',count:1,label:'Ler o registro da Ruptura'}],xp:900,credits:240,reward:'ether'},
 {id:'neon-caco',title:'O preço da luz',act:'Ato II · Cacos de um sol',npc:'orin',description:'A Ordem do Amanhecer não é dona de Lúmen. Encontre o Caco do Pântano e escolha sua própria disciplina.',objectives:[{type:'shard',region:1,count:1,label:'Obter o Caco Maior do Pântano'},{type:'talk',key:'orin',count:1,label:'Conversar com Orin Kael'}],xp:2200,credits:500,reward:'token'},
 {id:'glass-heart',title:'Coração de Vidro',act:'Ato III · A verdade do Zênite',npc:'tobias',description:'Cruze a tempestade, reconecte os circuitos e enfrente as três fases do Vigia-Zero.',objectives:[{type:'operation',key:'glass',count:1,label:'Concluir Coração de Vidro'}],xp:4200,credits:950,reward:'glass'},
 {id:'rust-caco',title:'A Coroa e a Forja',act:'Ato III · A verdade do Zênite',npc:'engineer',description:'As minas de Ferrugem escondem um Caco Maior. Tire-o das mãos do Dominion.',objectives:[{type:'shard',region:3,count:1,label:'Obter o Caco da Cordilheira'},{type:'build',count:1,label:'Construir uma oficina comunitária'}],xp:6200,credits:1200,reward:'token'},
 {id:'black-harvest',title:'A Colheita Negra',act:'Ato IV · Lúmen e Umbra',npc:'nyx',description:'A estufa pode ser destruída, dominada ou parcialmente purificada. Sua escolha terá consequências.',objectives:[{type:'operation',key:'harvest',count:1,label:'Resolver A Colheita Negra'}],xp:8400,credits:1600,reward:'seed'},
 {id:'deep-tide',title:'O Leviatã de Thalassa',act:'Ato IV · Lúmen e Umbra',npc:'thalassa-keeper',description:'Acenda o Farol, sobreviva às quatro fases do Leviatã e recupere a memória da cidade.',objectives:[{type:'operation',key:'leviathan',count:1,label:'Concluir a raid de Thalassa'}],xp:12000,credits:2400,reward:'scale'},
 {id:'rift-truth',title:'O segredo dos Cacos',act:'Ato V · O último horizonte',npc:'helios',description:'HELIOS-IA revela o segredo de Mara. Reúna os sete Cacos Maiores e encontre o Núcleo sob Aurea Prime.',objectives:[{type:'shards',count:7,label:'Reunir os sete Cacos Maiores'},{type:'talk',key:'helios',count:1,label:'Ouvir HELIOS-IA'}],xp:18000,credits:3500,reward:'token'},
 {id:'aurea-fall',title:'A Queda de Aurea Prime',act:'Ato V · O último horizonte',npc:'helios',description:'Muralhas, Subsolo e Torre Central. Desafie a Coroa de Ferro e decida o destino do Núcleo.',objectives:[{type:'operation',key:'aurea',count:1,label:'Concluir o cerco final'},{type:'vote',count:1,label:'Escolher o destino de Éridan'}],xp:26000,credits:6000,reward:'insignia'}
];

export const OPERATIONS = [
 {id:'glass',name:'Coração de Vidro',min:25,max:30,region:2,players:'4–6',boss:'Vigia-Zero',phases:['Tempestade de vidro','Circuitos do reator','Armadura do Vigia','Núcleo exposto'],mechanics:['Abrigar','Reconectar','Romper armadura','Purificar núcleo'],material:'glassFragment',set:'crystal',rare:'watcherEye',xp:4000,credits:650},
 {id:'harvest',name:'A Colheita Negra',min:40,max:45,region:4,players:'8–10',boss:'Coração da Estufa',phases:['Raízes de Umbra','Estufa automatizada','O destino da colheita'],mechanics:['Drenar barreiras','Cortar raízes','Escolher destino'],material:'etherSeed',set:'foliage',rare:'rootHeart',xp:7500,credits:1200},
 {id:'leviathan',name:'O Leviatã de Thalassa',min:55,max:60,region:5,players:'15–20',boss:'Leviatã de Thalassa',phases:['O Farol desperta','Ondas de pressão','Autômatos da maré','O coração biomecânico'],mechanics:['Acender farol','Estabilizar pressão','Destruir sensores','Romper núcleo'],material:'leviathanScale',set:'tide',rare:'tideCrown',xp:11000,credits:1800},
 {id:'aurea',name:'A Queda de Aurea Prime',min:75,max:80,region:7,players:'Múltiplas guildas',boss:'Kaelith Drax',phases:['Muralhas de Aurea','Subsolo do Núcleo','Torre Central'],mechanics:['Abrir muralhas','Unir os Cacos','Desativar o trono'],material:'eraInsignia',set:'helios',rare:'heliosRelic',xp:22000,credits:4500}
];

export const ITEMS = {
 potion:{name:'Ampola de recuperação',rarity:1,type:'consumable',description:'Restaura 55% da vida.',tradable:true},
 focus:{name:'Célula de foco',rarity:1,type:'consumable',description:'Restaura toda a energia.',tradable:true},
 glassFragment:{name:'Fragmento de Vidro Solar',rarity:2,type:'material',tradable:true},
 etherSeed:{name:'Semente de Éter',rarity:3,type:'material',tradable:true},
 leviathanScale:{name:'Escama do Leviatã',rarity:3,type:'material',tradable:true},
 eraInsignia:{name:'Insígnia da Era Nova',rarity:4,type:'relic',tradable:false},
 watcherEye:{name:'Olho do Vigia',rarity:3,type:'accessory',power:12,tradable:false},
 rootHeart:{name:'Coração da Raiz',rarity:3,type:'accessory',power:20,tradable:false},
 tideCrown:{name:'Coroa da Maré',rarity:4,type:'accessory',power:30,tradable:false},
 heliosRelic:{name:'Relíquia de Helios',rarity:5,type:'accessory',power:50,tradable:false},
 bike:{name:'Moto antigravitacional',rarity:2,type:'mount',tradable:true,description:'Aumenta em 75% sua velocidade fora de combate.'},
 beast:{name:'Montaria mutante',rarity:3,type:'mount',tradable:false,description:'Domada com biomassa e fragmentos de Éter.'},
 convoy:{name:'Caminhão blindado',rarity:3,type:'mount',tradable:true,description:'Transporte da guilda. Velocidade e armadura adicional.'},
 cosmetic:{name:'Manto da Honra',rarity:3,type:'cosmetic',tradable:false},
 solarTitle:{name:'Guardião da Aurora',rarity:4,type:'title',tradable:false},
 ticket:{name:'Ficha de recompensa compartilhada',rarity:3,type:'ticket',tradable:false}
};

for (const [classId,definition] of Object.entries(CLASSES)) {
 for (const [set,index,title] of [['starter',0,'da Chama Viva'],['forged',1,'de Ferrugem'],['crystal',2,'Cristal Vítreo'],['foliage',3,'Folhagem Radiante'],['umbrafoliage',3,'Folhagem Sombria'],['tide',4,'Maré Profunda'],['helios',5,'Helios Renascido']]) {
  ITEMS[`${set}_${classId}`]={name:`${definition.weapon} · ${title}`,rarity:index,type:'weapon',classId,power:8+index*13,level:[1,12,25,40,55,75][index],tradable:set==='forged',description:'Equipamento vinculado à sua jornada de Desperto.'};
 }
}

export const RECIPES = [
 {id:'potion',item:'potion',name:'Ampola de recuperação',cost:{water:2,food:1},credits:8},
 {id:'focus',item:'focus',name:'Célula de foco',cost:{energy:2,ether:1},credits:12},
 {id:'forged',item:'forged',name:'Arma de Ferrugem da sua classe',cost:{materials:12,energy:8},credits:80,level:12},
 {id:'bike',item:'bike',name:'Moto antigravitacional',cost:{materials:18,energy:12,data:3},credits:180,level:15},
 {id:'beast',item:'beast',name:'Domar criatura mutante',cost:{food:25,ether:8},credits:240,level:25},
 {id:'convoy',item:'convoy',name:'Caminhão blindado',cost:{materials:35,energy:25,data:10},credits:450,level:35}
];

export const BUILDINGS = [
 {id:'workshop',name:'Oficina',description:'Desbloqueia forjas avançadas e melhora o dano da comunidade.',cost:{water:8,energy:18,food:5,materials:25},bonus:'attack'},
 {id:'hospital',name:'Hospital',description:'Mais vida e recuperação nos abrigos.',cost:{water:20,energy:15,food:8,materials:20},bonus:'health'},
 {id:'greenhouse',name:'Estufa',description:'Produz alimento para a comunidade.',cost:{water:25,energy:10,food:10,materials:18},bonus:'food'},
 {id:'defense',name:'Torre de defesa',description:'Reduz o dano recebido e protege a base.',cost:{water:5,energy:30,food:5,materials:35},bonus:'defense'},
 {id:'market',name:'Mercado',description:'Aumenta os créditos obtidos e reduz taxas.',cost:{water:10,energy:15,food:12,materials:20},bonus:'credits'},
 {id:'lab',name:'Laboratório',description:'Melhora a energia e o ganho de experiência.',cost:{water:15,energy:35,food:10,materials:30},bonus:'xp'},
 {id:'arena',name:'Arena de treino',description:'Desbloqueia o treino normalizado da guilda.',cost:{water:10,energy:15,food:15,materials:25},bonus:'honor'}
];
export const SPECIALIZATIONS = { mercantile:'Mercantil', war:'Guerra', explorers:'Exploradores', artisans:'Artesãos', science:'Científica' };
export const ROLES = { leader:'Líder', officer:'Oficial', veteran:'Veterano', recruit:'Recruta' };
export const WEATHER = [
 {id:'clear',name:'Céu de cinzas',color:'#d0b996',description:'Uma trégua entre as tempestades.'},
 {id:'ether',name:'Tempestade de Éter',color:'#a9a0d9',description:'Magia ampliada; gravidade instável.'},
 {id:'acid',name:'Chuva ácida',color:'#a6bd8d',description:'Abrigos protegem do desgaste da chuva.'},
 {id:'aurora',name:'Aurora de Lúmen',color:'#efd293',description:'Cura e regeneração fortalecidas.'},
 {id:'eclipse',name:'Eclipse de Umbra',color:'#b399d0',description:'A drenagem de Umbra se fortalece.'}
];
export const ENDINGS = {
 reconstruction:{name:'Reconstrução',title:'A Federação das Cinzas',text:'As guildas reuniram os Cacos e fecharam o Rasgo. Éridan pertence novamente às suas comunidades.',color:'#a7c990'},
 dominion:{name:'Domínio',title:'A Última Coroa',text:'O Núcleo alimenta a Coroa de Ferro. A ordem retorna, e a resistência se prepara para uma nova era.',color:'#d39a89'},
 balance:{name:'Equilíbrio',title:'A Era do Éter',text:'Lúmen e Umbra se fundem. O continente renasce, e os Despertos descobrem um novo equilíbrio.',color:'#bbabdf'}
};
export const CONTRACTS = [
 {id:'hunt',name:'Rota segura',text:'Derrote 8 criaturas da região atual.',type:'kill',count:8,xp:260,credits:95},
 {id:'supply',name:'Suprimentos da comunidade',text:'Colete 12 recursos de qualquer tipo.',type:'gather',count:12,xp:200,credits:75},
 {id:'convoy',name:'Escolta do comboio',text:'Acompanhe o comboio entre o abrigo e a Torre de Sinal.',type:'escort',count:1,xp:350,credits:150}
];
