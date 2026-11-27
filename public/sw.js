// Service worker do H SALES CRM (app instalável, 2026-11-27).
// Serve para o app abrir a tela "Sem conexão" em vez do erro do navegador quando cai a internet
// e para mostrar os avisos de call no celular (fim do arquivo).
// Não guarda páginas nem dados: tudo continua vindo do servidor a cada acesso, então nenhum deploy fica preso em cache.
const CACHE = 'hsales-offline-v1';
const OFFLINE_URL = '/offline.html';
const ARQUIVOS_OFFLINE = [OFFLINE_URL, '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ARQUIVOS_OFFLINE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Pré-carregamento da navegação: a página já vai sendo buscada enquanto o service worker acorda
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
    const nomes = await caches.keys();
    await Promise.all(nomes.filter((nome) => nome !== CACHE).map((nome) => caches.delete(nome)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Abrir uma tela do CRM: sempre do servidor; sem internet, a tela "Sem conexão"
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const preCarregada = await event.preloadResponse;
        if (preCarregada) return preCarregada;
        return await fetch(request);
      } catch {
        const cache = await caches.open(CACHE);
        return (await cache.match(OFFLINE_URL)) || Response.error();
      }
    })());
    return;
  }

  // Ícone usado pela tela "Sem conexão": do servidor quando der, do cache quando não
  const url = new URL(request.url);
  if (url.origin === self.location.origin && ARQUIVOS_OFFLINE.includes(url.pathname)) {
    event.respondWith(fetch(request).catch(() => caches.match(url.pathname)));
  }
});

// Avisos de call (2026-11-27): o servidor manda { titulo, corpo, url, tag } e o celular mostra a notificação.
// O iPhone exige que todo aviso recebido vire notificação, então sempre mostra algo.
self.addEventListener('push', (event) => {
  let aviso = {};
  try {
    aviso = event.data ? event.data.json() : {};
  } catch {
    aviso = { corpo: event.data ? event.data.text() : '' };
  }
  event.waitUntil(self.registration.showNotification(aviso.titulo || 'H SALES CRM', {
    body: aviso.corpo || '',
    icon: '/icons/icon-192.png',
    tag: aviso.tag,
    lang: 'pt-BR',
    data: { url: aviso.url || '/' },
  }));
});

// Tocar no aviso abre o CRM na tela certa (ou traz para frente o que já estava aberto)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const janela of janelas) {
      if (new URL(janela.url).origin !== self.location.origin) continue;
      await janela.focus();
      if (janela.url !== destino && 'navigate' in janela) await janela.navigate(destino).catch(() => {});
      return;
    }
    await self.clients.openWindow(destino);
  })());
});
