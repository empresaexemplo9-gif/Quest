export function tabletPlatform(navigator) {
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ipad';
  return /Android/i.test(ua) ? 'android' : 'other';
}

export function setupInstaller(win, doc) {
  const dialog = doc.querySelector('#install-dialog');
  if (!dialog) return;
  const platform = tabletPlatform(win.navigator);
  const confirm = doc.querySelector('#install-confirm');
  const feedback = doc.querySelector('#install-feedback');
  const state = doc.querySelector('#install-state');
  const url = doc.querySelector('#install-url');
  const display = win.matchMedia('(display-mode: standalone)');
  let installed = display.matches || win.navigator.standalone === true;
  let pending = null, prompting = false, selected = null;
  url.value = new URL('/ragnarok.html', win.location.href).href;

  function update() {
    confirm.hidden = installed || platform !== 'android' || selected !== 'android' || !pending;
    confirm.disabled = prompting;
    if (installed) state.textContent = 'Éridan já está instalado neste aparelho. Entre com sua conta para jogar online.';
  }
  function openGuide(device) {
    selected = device;
    doc.querySelector('#install-title').textContent = device === 'ipad' ? 'Instalar no iPad' : 'Instalar no tablet Android';
    doc.querySelectorAll('[data-install-guide]').forEach(guide => { guide.hidden = guide.dataset.installGuide !== device; });
    feedback.textContent = installed ? 'O aplicativo já está instalado neste aparelho.' : '';
    update();
    if (!dialog.open) dialog.showModal();
  }
  async function promptInstall() {
    if (!pending || installed || prompting || platform !== 'android') return;
    const event = pending;
    pending = null;
    prompting = true;
    update();
    try {
      await event.prompt();
      const result = await event.userChoice;
      if (!installed) feedback.textContent = result.outcome === 'accepted'
        ? 'Instalação solicitada. Aguarde a confirmação do Android e procure o ícone Éridan.'
        : 'Instalação cancelada. Você pode tentar novamente pelo menu ⋮ do Chrome, seguindo os passos acima.';
    } catch {
      if (!installed) feedback.textContent = 'Use o menu ⋮ do Chrome e siga os passos acima para instalar.';
    } finally { prompting = false; update(); }
  }
  win.addEventListener('beforeinstallprompt', event => {
    // Preserve the browser's normal installation UI on desktop.
    if (platform !== 'android') return;
    event.preventDefault();
    pending = event;
    update();
  });
  win.addEventListener('appinstalled', () => {
    installed = true; pending = null;
    feedback.textContent = 'Éridan instalado. Abra pelo ícone na tela inicial para jogar.';
    update();
  });
  display.addEventListener('change', event => { if (event.matches) { installed = true; update(); } });
  doc.querySelectorAll('[data-install]').forEach(button => button.addEventListener('click', () => {
    openGuide(button.dataset.install);
    if (selected === 'android') void promptInstall();
  }));
  confirm.addEventListener('click', promptInstall);
  doc.querySelector('#install-close').addEventListener('click', () => dialog.close());
  doc.querySelector('#install-copy').addEventListener('click', async () => {
    try {
      await win.navigator.clipboard.writeText(url.value);
      feedback.textContent = 'Endereço copiado. Abra no Safari do iPad ou no Chrome do tablet Android.';
    } catch {
      url.focus(); url.select();
      feedback.textContent = 'Selecione e copie o endereço acima para abrir no seu tablet.';
    }
  });
  update();
  if ('serviceWorker' in win.navigator) win.navigator.serviceWorker.register('/sw.js').catch(() => {});
  const requested = new URL(win.location.href).searchParams.get('instalar');
  if (requested === 'ipad' || requested === 'android') openGuide(requested);
}

if (typeof window !== 'undefined') setupInstaller(window, document);
