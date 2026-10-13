// Quest UI localization. Resource names, IDs and packet data are never changed.
export const translations = {
 'OK':'Confirmar','Cancel':'Cancelar','Close':'Fechar','Save':'Salvar','Apply':'Aplicar','Reset':'Restaurar','Delete':'Excluir','Create':'Criar','Confirm':'Confirmar','Yes':'Sim','No':'Não','Exit':'Sair','Back':'Voltar','Next':'Próximo','Previous':'Anterior',
 'Login':'Entrar','Password':'Senha','Username':'Nome de usuário','User ID':'Usuário','Account':'Conta','Connect':'Conectar','Disconnect':'Desconectar','Select Server':'Escolha o servidor','Character Selection':'Seleção de personagem','Character Creation':'Criação de personagem','Create Character':'Criar personagem','Delete Character':'Excluir personagem','Select Character':'Escolha seu personagem','Name':'Nome','Gender':'Aparência','Male':'Masculino','Female':'Feminino','Hair Style':'Estilo do cabelo','Hair Color':'Cor do cabelo','Novice':'Aprendiz','Swordsman':'Espadachim','Swordman':'Espadachim','Mage':'Mago','Archer':'Arqueiro','Thief':'Gatuno','Acolyte':'Noviço','Merchant':'Mercador',
 'Inventory':'Inventário','Equipment':'Equipamentos','Items':'Itens','Item':'Item','Skills':'Habilidades','Skill':'Habilidade','Skill Tree':'Árvore de habilidades','Character':'Personagem','Status':'Atributos','Basic Info':'Informações básicas','Base Level':'Nível base','Job Level':'Nível de classe','Level':'Nível','Job':'Classe','Class':'Classe','Weight':'Peso','Experience':'Experiência','Skill Points':'Pontos de habilidade','Status Points':'Pontos de atributo','Attack':'Ataque','Defense':'Defesa','Magic Attack':'Ataque mágico','Magic Defense':'Defesa mágica','Hit':'Precisão','Flee':'Esquiva','Critical':'Crítico','Strength':'Força','Agility':'Agilidade','Vitality':'Vitalidade','Intelligence':'Inteligência','Dexterity':'Destreza','Luck':'Sorte',
 'Map':'Mapa','World Map':'Mapa do mundo','Mini Map':'Minimapa','Navigation':'Navegação','Quest':'Missão','Quests':'Missões','Quest List':'Lista de missões','Party':'Grupo','Party Setup':'Configuração do grupo','Guild':'Clã','Guild Storage':'Armazém do clã','Storage':'Armazém','Friends':'Amigos','Friend List':'Lista de amigos','Chat':'Conversa','Chat Room':'Sala de conversa','Public':'Público','General':'Geral','Battle':'Batalha','System':'Sistema','Settings':'Configurações','Options':'Opções','Game Options':'Opções do jogo','Video':'Vídeo','Audio':'Áudio','Sound':'Som','Music':'Música','Volume':'Volume','Resolution':'Resolução','Full Screen':'Tela cheia','Windowed':'Em janela','Quality':'Qualidade','Effects':'Efeitos','Shortcut':'Atalho','Shortcuts':'Atalhos','Hotkey':'Atalho','Hotkeys':'Atalhos','Menu':'Menu','Help':'Ajuda','Information':'Informações','Message':'Mensagem','Messages':'Mensagens','Warning':'Aviso','Error':'Erro',
 'Trade':'Negociar','Trade Request':'Pedido de negociação','Buy':'Comprar','Sell':'Vender','Shop':'Loja','Price':'Preço','Amount':'Quantidade','Quantity':'Quantidade','Total':'Total','Search':'Buscar','Mail':'Correio','Send':'Enviar','Reply':'Responder','Return':'Retornar','Received':'Recebidos','Sent':'Enviados','Subject':'Assunto','Attachment':'Anexo','Accept':'Aceitar','Refuse':'Recusar','Invite':'Convidar','Leave':'Sair','Leader':'Líder','Member':'Integrante','Members':'Integrantes','Recruit':'Recrutar','Recruitment':'Recrutamento','On':'Ativado','Off':'Desativado','Enabled':'Ativado','Disabled':'Desativado','Loading':'Carregando','Loading...':'Carregando...','Please wait...':'Aguarde...','Not enough skill points.':'Pontos de habilidade insuficientes.','Use':'Usar','Equip':'Equipar','Unequip':'Desequipar','Drop':'Descartar','Description':'Descrição','Requirements':'Requisitos','Target':'Alvo','Range':'Alcance','SP Cost':'Custo de SP','Max Level':'Nível máximo','Available':'Disponível','Unavailable':'Indisponível'
};
export function translateLabel(value) {
 const trimmed=value.trim();
 if(Object.hasOwn(translations,trimmed))return value.replace(trimmed,translations[trimmed]);
 return value;
}
const observed=new WeakSet();
export function localize(root) {
 if(observed.has(root))return;
 observed.add(root);
 const scan=node=>{
  if(node.nodeType===3){if(!['STYLE','SCRIPT','TEXTAREA'].includes(node.parentElement?.tagName)){const value=translateLabel(node.nodeValue);if(value!==node.nodeValue)node.nodeValue=value;}return;}
  if(node.nodeType===1){if(['STYLE','SCRIPT','TEXTAREA'].includes(node.tagName))return;for(const key of ['title','placeholder','aria-label']){const value=node.getAttribute(key);if(value!==null){const translated=translateLabel(value);if(translated!==value)node.setAttribute(key,translated);}}}
  for(const child of node.childNodes||[])scan(child);
 };
 scan(root);
 new MutationObserver(records=>{for(const record of records){if(record.type==='childList')record.addedNodes.forEach(scan);else scan(record.target);}}).observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','placeholder','aria-label']});
}
