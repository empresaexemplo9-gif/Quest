// Native click also covers Safari's touch activation and keyboard activation.
// Empty slots need one tap; occupied slots select, then the player taps Iniciar.
export function bindCharacterSlots(root, actions) {
 const cells=[...root.querySelectorAll('.char_canvas')];
 const activate=index=>{
  if(actions.blocked()||!actions.available(index))return;
  actions.select(index);
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
 root.querySelector('.char_list').after(button);
}
