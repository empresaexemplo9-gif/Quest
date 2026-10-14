// Native click also covers Safari's touch activation and keyboard activation.
// Empty slots need one tap; occupied slots select, then a real HTML button enters.
export function bindCharacterSlots(root, actions) {
 const cells=[...root.querySelectorAll('.char_canvas')];
 const toolbar=document.createElement('div');toolbar.className='quest-character-actions';
 const enter=document.createElement('button');
 enter.type='button';enter.className='quest-enter-game';enter.textContent='Entrar no jogo';
 const refresh=()=>{
  const index=actions.current();
  enter.disabled=actions.blocked()||!actions.available(index)||!actions.occupied(index)||actions.deleting(index);
  cells.forEach((cell,i)=>cell.setAttribute('aria-pressed',String(i===index)));
 };
 const activate=index=>{
  if(actions.blocked()||!actions.available(index))return;
  actions.select(index);
  refresh();
  if(!actions.occupied(index))actions.create();
 };
 cells.forEach((cell,index)=>{
  cell.setAttribute('role','button');cell.tabIndex=0;
  cell.setAttribute('aria-label',`Espaço de personagem ${index+1}: toque para selecionar ou criar`);
  cell.addEventListener('click',()=>activate(index));
  cell.addEventListener('keydown',event=>{
   if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();activate(index);}
  });
 });
 const button=document.createElement('button');
 button.type='button';button.className='quest-new-character';button.textContent='Criar personagem';
 button.addEventListener('click',()=>{
  if(actions.blocked())return;
  const empty=cells.findIndex((_,index)=>actions.available(index)&&!actions.occupied(index));
  if(empty>=0)activate(empty);
 });
 enter.addEventListener('click',()=>{
  refresh();if(!enter.disabled)actions.connect();
 });
 toolbar.append(enter,button);root.querySelector('.char_list').after(toolbar);
 refresh();return {refresh};
}
