/* Mantém o app abrindo mesmo sem internet. Ao publicar uma versão nova, troque o número abaixo. */
var V = 'sot-v1';
var ARQ = ['./', 'index.html', 'evo.html', 'sync.js', 'config.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(V).then(function (c) { return Promise.all(ARQ.map(function (u) { return c.add(u).catch(function () {}); })); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (k) { return Promise.all(k.filter(function (x) { return x !== V; }).map(function (x) { return caches.delete(x); })); }).then(function () { return self.clients.claim(); })); });
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || /googleapis\.com|accounts\.google\.com|gstatic\.com/.test(u.host)) return;   // Google: sempre rede
  // app: rede primeiro (pega atualizações), cai para o cache se estiver offline
  e.respondWith(fetch(e.request).then(function (r) { if (r.ok && (u.origin === location.origin || /cdnjs/.test(u.host))) { var c = r.clone(); caches.open(V).then(function (ca) { ca.put(e.request, c); }); } return r; })
    .catch(function () { return caches.match(e.request, { ignoreSearch: true }).then(function (r) { return r || caches.match('index.html'); }); }));
});
