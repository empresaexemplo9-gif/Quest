const CACHE='eridan-portal-v2';
const ASSETS=['/ragnarok.html','/ragnarok-entry.js','/ragnarok-entry.css','/install.js','/install.css','/game/downloads.css','/index.html','/mark.svg','/manifest.webmanifest','/game/ragnarok.css','/game/projection.js','/game/isometric.js','/art/abrigo77.png','/art/cidade-livre.png','/art/regions.png','/art/characters.png','/game/tablet.css','/icons/apple-touch-icon.png','/icons/icon-192.png','/icons/icon-512.png','/game/style.css','/game/content.js','/game/core.js','/game/main.js','/game/session.js','/game/ui.js','/game/render.js','/game/lore.json'];
const STATIC_PATHS=new Set(ASSETS);
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(names=>Promise.all(names.filter(name=>name.startsWith('eridan-')&&name!==CACHE).map(name=>caches.delete(name)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
 const pathname=new URL(event.request.url).pathname;
 // Only public app assets are cached. Accounts, APIs, downloads and the remote game stay on the network.
 if(!STATIC_PATHS.has(pathname))return;
 event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return response;}).catch(()=>caches.match(event.request).then(cached=>cached||new Response('O arquivo ainda não está disponível offline.',{status:503}))));
});
