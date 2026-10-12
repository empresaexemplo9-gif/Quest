(() => {
  if (window.parent === window) return;
  const origins = new Set(window.QUEST_PORTAL_ORIGINS || []);
  let pending = null, interval = null, deadline = 0, portal = null;
  function send(type) {if (portal) window.parent.postMessage({type},portal);}
  function find(selector,root = document) {
    const found = root.querySelector(selector);
    if (found) return found;
    for (const element of root.querySelectorAll('*')) {
      if (element.shadowRoot) {const nested = find(selector,element.shadowRoot); if (nested) return nested;}
    }
    return null;
  }
  function submit() {
    if (!pending) return;
    if (Date.now() > deadline) {pending = null; clearInterval(interval); send('QUEST_LOGIN_TIMEOUT'); return;}
    const login = find('#WinLogin,#WinLoginV2,#WinLoginV3');
    const user = login?.querySelector('input.user,#user') || find('#user');
    const pass = login?.querySelector('input.pass,#pass') || find('#pass');
    const button = login?.querySelector('.connect') || find('#WinLogin .connect');
    if (!user || !pass || !button) return;
    user.value = pending.username; pass.value = pending.password;
    user.dispatchEvent(new Event('input',{bubbles:true})); pass.dispatchEvent(new Event('input',{bubbles:true}));
    pending = null; clearInterval(interval); button.click(); send('QUEST_LOGIN_SUBMITTED');
  }
  window.addEventListener('message',event => {
    if (event.source !== window.parent || !origins.has(event.origin) || event.data?.type !== 'QUEST_LOGIN') return;
    const {username,password} = event.data;
    if (typeof username !== 'string' || !/^[A-Za-z0-9_]{4,21}$/.test(username) || /_[MF]$/i.test(username) || typeof password !== 'string' || !/^[!-~]{8,23}$/.test(password)) return;
    portal = event.origin; pending = {username,password}; deadline = Date.now() + 90000;
    clearInterval(interval); interval = setInterval(submit,300); submit();
  });
  for (const origin of origins) window.parent.postMessage({type:'QUEST_GAME_READY'},origin);
})();
