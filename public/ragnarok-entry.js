const status = document.querySelector('#connection-status');
const enter = document.querySelector('#enter-world');
const address = document.querySelector('#server-address');
const check = document.querySelector('#check-connection');
async function refresh() {
  check.disabled = true;
  enter.hidden = true;
  address.hidden = true;
  status.textContent = 'Verificando a conexão com o mundo…';
  try {
    const response = await fetch('/api/ragnarok', {cache:'no-store', signal:AbortSignal.timeout(8000)});
    const world = await response.json();
    if (response.ok && world.connected && world.server) {
      const server = new URL(world.server);
      if (server.protocol !== 'https:' || server.username || server.password) throw new Error('Invalid game address');
      status.textContent = 'Mundo compartilhado disponível. Entre para jogar.';
      enter.href = server.origin + '/';
      enter.hidden = false;
      address.textContent = 'Endereço para o instalador: ' + server.origin;
      address.hidden = false;
    } else {
      status.textContent = world.reason === 'PUBLIC_ENDPOINT_PENDING' ? 'O servidor está instalado, mas a conexão pública ainda está pendente.' : 'O servidor está sem conexão no momento. Tente novamente em alguns instantes.';
    }
  } catch {status.textContent = 'Não foi possível verificar a conexão. Tente novamente.';}
  finally {check.disabled = false;}
}
check.addEventListener('click', refresh);
refresh();
