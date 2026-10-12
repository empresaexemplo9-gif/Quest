const form = document.querySelector('#quest-account');
const submit = document.querySelector('#account-submit');
const status = document.querySelector('#connection-status');
const message = document.querySelector('#account-message');
const check = document.querySelector('#check-connection');
const frame = document.querySelector('#quest-game');
const shell = document.querySelector('#game-shell');
let server = null, pending = null, handoffTimer = null, busy = false;
const errors = {
  INVALID_USERNAME:'Use 4 a 21 letras, números ou sublinhados, sem _M ou _F no final.',
  INVALID_PASSWORD:'A senha deve ter 8 a 23 caracteres, sem espaços ou acentos.',
  INVALID_GENDER:'Escolha o tipo de personagem.',
  USERNAME_TAKEN:'Esse nome de usuário já está em uso. Escolha outro ou entre na sua conta.',
  INVALID_CREDENTIALS:'Usuário ou senha incorretos.',
  ALREADY_ONLINE:'Essa conta já está no jogo. Feche a outra sessão e aguarde alguns instantes.',
  ACCOUNT_UNAVAILABLE:'Não foi possível entrar nessa conta. Verifique sua situação no servidor.',
  TRY_LATER:'Muitas tentativas em pouco tempo. Aguarde um minuto e tente novamente.',
  SERVER_UNAVAILABLE:'O servidor está sem conexão no momento. Tente novamente em alguns instantes.'
};
function trustedOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw Error('Invalid game origin');
  return url.origin;
}
async function refresh() {
  check.disabled = true; submit.disabled = true; server = null;
  status.textContent = 'Verificando a conexão com o mundo…';
  try {
    const response = await fetch('/api/ragnarok',{cache:'no-store',signal:AbortSignal.timeout(10000)});
    const world = await response.json();
    if (response.ok && world.connected && world.server) {
      server = trustedOrigin(world.server);
      status.textContent = 'Mundo disponível. Sua conta e seus personagens ficam salvos no servidor.';
    } else status.textContent = errors.SERVER_UNAVAILABLE;
  } catch {status.textContent = 'Não foi possível verificar a conexão. Tente novamente.';}
  finally {check.disabled = false; submit.disabled = !server || busy;}
}
function handoff() {
  if (!pending || !frame?.contentWindow) return;
  frame.contentWindow.postMessage({type:'QUEST_LOGIN',...pending},server);
  pending = null; form.elements.password.value = '';
}
function leaveGame() {
  pending = null; clearTimeout(handoffTimer); frame?.removeAttribute('src');
  if (shell) shell.hidden = true;
  document.body.classList.remove('playing'); form.reset(); message.textContent = ''; refresh();
}
window.addEventListener('message',event => {
  if (!frame || event.source !== frame.contentWindow || event.origin !== server) return;
  if (event.data?.type === 'QUEST_GAME_READY') handoff();
  if (event.data?.type === 'QUEST_LOGIN_SUBMITTED') {
    clearTimeout(handoffTimer); document.querySelector('#game-status').textContent = 'Escolha ou crie seu personagem no jogo.';
  }
  if (event.data?.type === 'QUEST_LOGIN_TIMEOUT') {
    clearTimeout(handoffTimer); document.querySelector('#game-status').textContent = 'O cliente demorou para carregar. Volte ao login e tente novamente.';
  }
});
if (frame) frame.addEventListener('load',handoff);
document.querySelector('#leave-game')?.addEventListener('click',leaveGame);
form.addEventListener('submit',async event => {
  event.preventDefault(); message.textContent = '';
  if (busy || !server) return;
  const username = form.elements.username.value.trim(), password = form.elements.password.value;
  if (!/^[A-Za-z0-9_]{4,21}$/.test(username) || /_[MF]$/i.test(username)) {message.textContent = errors.INVALID_USERNAME; return;}
  if (!/^[!-~]{8,23}$/.test(password)) {message.textContent = errors.INVALID_PASSWORD; return;}
  if (form.dataset.action === 'register' && password !== form.elements.confirmation.value) {message.textContent = 'As senhas não coincidem.'; return;}
  busy = true; submit.disabled = true; check.disabled = true; submit.textContent = 'Aguarde…';
  try {
    const response = await fetch('/api/ragnarok-account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:form.dataset.action,username,password,...(form.elements.gender ? {gender:form.elements.gender.value} : {})}),signal:AbortSignal.timeout(20000)});
    const result = await response.json();
    if (!response.ok || !result.ok) {message.textContent = errors[result.error] || 'Não foi possível concluir. Tente novamente.'; return;}
    if (form.dataset.action === 'register') {
      form.reset(); message.textContent = 'Conta criada! Você já pode entrar e criar seu personagem.';
      const next = document.querySelector('#account-next'); next.textContent = 'Entrar no jogo'; next.href = '/entrar.html?usuario=' + encodeURIComponent(username); next.focus();
    } else {
      if (trustedOrigin(result.server) !== server) throw Error('Game server changed');
      pending = {username,password}; shell.hidden = false; document.body.classList.add('playing');
      document.querySelector('#game-status').textContent = 'Carregando o jogo…'; frame.src = server + '/';
      handoffTimer = setTimeout(() => {pending = null; form.elements.password.value = ''; document.querySelector('#game-status').textContent = 'O cliente demorou para carregar. Volte ao login e tente novamente.';},90000);
    }
  } catch {message.textContent = 'Não foi possível concluir a conexão. Tente novamente.';}
  finally {busy = false; submit.disabled = !server; check.disabled = false; submit.textContent = form.dataset.action === 'register' ? 'Criar minha conta' : 'Entrar e jogar';}
});
const suggestedUser = new URL(location.href).searchParams.get('usuario');
if (suggestedUser && /^[A-Za-z0-9_]{4,21}$/.test(suggestedUser)) form.elements.username.value = suggestedUser;
check.addEventListener('click',refresh); refresh();
