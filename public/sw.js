// Service worker do H SALES CRM (app instalável, 2026-11-27).
// Só serve para o app abrir a tela "Sem conexão" em vez do erro do navegador quando cai a internet.
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
