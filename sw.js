/**
 * Service Worker do catálogo ArznStoreSP
 * Estratégia: cache-first para a casca do app (funciona offline),
 * network-first para dados da API (produtos sempre atualizados quando há rede).
 *
 * IMPORTANTE: ao publicar uma versão nova do catálogo, mude o número
 * de CACHE_NAME (v1 -> v2 ...) para forçar a atualização nos aparelhos.
 */
const CACHE_NAME = 'arznstoresp-v2';
const CASCA = [
  './catalogo.html',
  './manifest.json',
  './imagens/caneca-porcelana.svg',
  './imagens/caneca-magica.svg',
  './imagens/camiseta.svg',
  './imagens/chaveiro.svg',
  './imagens/adesivo-vinil.svg',
  './imagens/placa-pvc.svg',
  './imagens/almofada.svg',
  './imagens/squeeze.svg',
  './imagens/banner-canecas.svg',
  './imagens/banner-camisetas.svg',
  './imagens/banner-adesivos.svg',
  './imagens/og-capa.svg',
  './imagens/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CASCA))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(chaves.filter((c) => c !== CACHE_NAME).map((c) => caches.delete(c)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Dados dinâmicos (Apps Script / API): network-first, cai pro cache se offline
  if (url.includes('script.google.com') || url.includes('/exec')) {
    event.respondWith(
      fetch(event.request)
        .then((resp) => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return resp;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Casca e demais recursos: cache-first
  event.respondWith(
    caches.match(event.request).then((cacheResp) => {
      return (
        cacheResp ||
        fetch(event.request).then((resp) => {
          // Guarda uma cópia dos recursos GET bem-sucedidos
          if (event.request.method === 'GET' && resp.status === 200) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return resp;
        }).catch(() => cacheResp)
      );
    })
  );
});
