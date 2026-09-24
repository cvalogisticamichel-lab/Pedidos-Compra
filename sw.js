/* Service worker — deixa o site rápido e permite instalar como app.
   - Arquivos com versão (?v=...), imagens e bibliotecas: servidos do cache
     na hora (cache-first). Uma versão nova tem outro ?v=, então nunca fica velho.
   - Página principal: busca na rede primeiro (pega atualizações), cache se offline.
   - Chamadas ao Google (API) nunca passam pelo cache. */
const CACHE = 'cv-compras-v2.12.0';
const V = '?v=2.12.0';
const ARQUIVOS = [
  './', './index.html', './manifest.webmanifest',
  './style.css' + V, './marca.js' + V, './config.js' + V, './engine.js' + V,
  './store.js' + V, './pdf.js' + V, './app.js' + V,
  './jspdf.umd.min.js', './jspdf.plugin.autotable.min.js',
  './logo.svg', './logo-branco.svg', './icon.svg', './icon-redondo.svg', './icon-192.png', './icon-512.png'
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
  const estatico = url.search.includes('v=') || /\.(png|svg|gif|min\.js)$/.test(url.pathname);
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
