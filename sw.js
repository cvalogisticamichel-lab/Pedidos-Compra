/* Service worker — permite instalar como app e abrir offline.
   Ao publicar uma nova versão, altere CACHE para forçar atualização. */
const CACHE = 'cv-compras-v2.5.0';
const ARQUIVOS = [
  './', './index.html', './css/style.css',
  './js/marca.js', './js/config.js', './js/engine.js', './js/store.js', './js/app.js', './js/pdf.js', './js/vendor/jspdf.umd.min.js', './js/vendor/jspdf.plugin.autotable.min.js',
  './assets/logo.svg', './assets/logo-branco.svg', './assets/icon.svg', './assets/icon-redondo.svg', './assets/icon-192.png', './assets/icon-512.png', './assets/carregando.gif',
  './manifest.webmanifest'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Rede primeiro (sempre pega a versão nova); cache como reserva offline.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        const copia = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copia));
      }
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
