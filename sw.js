/**
 * Service Worker do catálogo ArznStoreSP
 * Estratégia:
 *  - HTML e dados: NETWORK-FIRST (sempre tenta buscar a versão nova; usa cache só offline)
 *  - Imagens/ícones locais: cache-first (rápido, funciona offline)
 *  - Imagens do Supabase e chamadas de API: sempre da rede (nunca cacheia)
 */
const CACHE_NAME = 'arznstoresp-v4';
const CASCA = [
  './manifest.json',
  './imagens/caneca-porcelana.svg',
  './imagens/caneca-magica.svg',
  './imagens/camiseta.svg',
  './imagens/chaveiro.svg',
  './imagens/adesivo-vinil.svg',
  './imagens/placa-pvc.svg',
  './imagens/almofada.svg',
  './imagens/squeeze.svg',
  './imagens/og-capa.svg',
  './imagens/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CASCA)));
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

  // Nunca cacheia: Supabase (banco + storage) e qualquer API externa
  if (url.includes('supabase.co') || url.includes('supabase.in')) {
    return; // deixa o navegador buscar direto, sempre atualizado
  }

  // HTML (a página): network-first — sempre pega a versão nova quando há internet
  const ehHTML = event.request.mode === 'navigate' || url.endsWith('.html');
  if (ehHTML) {
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

  // Recursos locais (imagens, ícones): cache-first
  event.respondWith(
    caches.match(event.request).then((cacheResp) => {
      return (
        cacheResp ||
        fetch(event.request).then((resp) => {
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
