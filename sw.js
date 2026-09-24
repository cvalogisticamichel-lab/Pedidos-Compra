/* Service worker — deixa o site rápido e permite instalar como app.
   - Arquivos com versão (?v=...), imagens e bibliotecas: servidos do cache
     na hora (cache-first). Uma versão nova tem outro ?v=, então nunca fica velho.
   - Página principal: busca na rede primeiro (pega atualizações), cache se offline.
   - Chamadas ao Google (API) nunca passam pelo cache. */
const CACHE = 'cv-compras-v2.8.0';
const V = '?v=2.8.0';
const ARQUIVOS = [
  './', './index.html', './manifest.webmanifest',
  './css/style.css' + V, './js/marca.js' + V, './js/config.js' + V, './js/engine.js' + V,
  './js/store.js' + V, './js/pdf.js' + V, './js/app.js' + V,
  './js/vendor/jspdf.umd.min.js', './js/vendor/jspdf.plugin.autotable.min.js',
  './assets/logo.svg', './assets/logo-branco.svg', './assets/icon.svg', './assets/icon-redondo.svg', './assets/icon-192.png', './assets/icon-512.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;                      // Google, fontes, APIs: direto na rede
  const estatico = url.search.includes('v=') || /\/(assets|vendor)\//.test(url.pathname);
  if (estatico) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
      if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
      return res;
    })));
    return;
  }
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
    return res;
  }).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
});
