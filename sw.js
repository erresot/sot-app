/* SOT APP — funcionamento offline. O número da versão é carimbado pelo build (python3 build.py N). */
var V = 'sot-v62';
var C_OCR = 'sot-ocr-1';        // leitor de fotos (12 MB): NÃO é apagado quando sai versão nova. Se trocar os arquivos do leitor, mude este nome.
var C_FONTES = 'sot-fontes-2';  // letras dos programas (arquivos locais em hub/fonts): não mudam entre versões
var ESSENCIAL = ['./', 'index.html', 'evo.html', 'campos.js', 'pessoa.js', 'sot-datas.js', 'sot-med.js', 'sot-exames.js', 'sot-escala.js', 'sot-linha.js', 'sync.js', 'config.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
var RESTO = ['hub/anamnese.html', 'hub/avaliacao.html', 'hub/condutas.html', 'hub/desccir.html', 'hub/evoamb.html', 'hub/exame.html', 'hub/exames.html', 'hub/mapa.html', 'hub/ambint.html', 'hub/novopac.html', 'hub/posop.html', 'hub/retornos.html', 'hub/cid10.txt', 'hub/ocr/sot-ocr.js', 'hub/sot-tema.css',   // relatorio.html (870 KB) fica guardado só depois de aberto a 1ª vez
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'];
var modoLento = 0;
var LIMITE_MS = 3500;           // internet lenta: depois disso usa a cópia guardada (e atualiza por trás)

function guardarTodos(nome, lista) {
  return caches.open(nome).then(function (c) {
    return Promise.all(lista.map(function (u) {
      return c.match(u).then(function (tem) { return tem || c.add(new Request(u, { cache: 'reload' })).catch(function () {}); });
    }));
  });
}
self.addEventListener('install', function (e) { e.waitUntil(guardarTodos(V, ESSENCIAL).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (k) {
    return Promise.all(k.filter(function (x) { return x !== V && x !== C_OCR && x !== C_FONTES; }).map(function (x) { return caches.delete(x); }));
  }).then(function () { return self.clients.claim(); }));
});
// a página pede o resto (programas do OrthoHub) depois de abrir, para não atrasar a troca de versão
var FONTES = ['400', '500', '600', '700'].map(function (w) { return 'hub/fonts/plex-sans-' + w + '.woff2'; }).concat(['400', '500', '600', '700'].map(function (w) { return 'hub/fonts/plex-cond-' + w + '.woff2'; }), ['400', '500', '600'].map(function (w) { return 'hub/fonts/plex-mono-' + w + '.woff2'; }));
self.addEventListener('message', function (e) {
  if (e.data && e.data.t === 'resto') e.waitUntil(guardarTodos(V, RESTO).then(function () { return guardarTodos(C_FONTES, FONTES); }));
  if (e.data && e.data.t === 'versao' && e.ports && e.ports[0]) e.ports[0].postMessage(V);
});

function ehLeitor(u) { return u.origin === location.origin && /\/hub\/ocr\//.test(u.pathname) && !/sot-ocr\.js$/.test(u.pathname); }
function ehFonte(u) { return u.origin === location.origin && /\/hub\/fonts\//.test(u.pathname); }

// guardado primeiro; se não tiver, busca e guarda (arquivos que não mudam)
function guardadoPrimeiro(nome, req, cors) {
  return caches.open(nome).then(function (c) {
    return c.match(req.url).then(function (r) {
      if (r) return r;
      return fetch(cors ? new Request(req.url, { mode: 'cors', credentials: 'omit' }) : req).then(function (n) {
        if (n.ok) c.put(req.url, n.clone());
        return n;
      });
    });
  });
}
// rede primeiro com limite de tempo; cai para a cópia guardada; a resposta da rede sempre atualiza a cópia
function redePrimeiro(e, u) {
  var mesmo = u.origin === location.origin;
  var req = mesmo ? new Request(e.request, { cache: 'no-cache' }) : e.request;
  var rede = fetch(req).then(function (r) {
    if (r.ok && (mesmo || /cdnjs|jsdelivr/.test(u.host))) { var c = r.clone(); return caches.open(V).then(function (ca) { return ca.put(e.request, c); }).then(function () { return r; }, function () { return r; }); }
    return r;
  });
  var guardado = function () { return caches.match(e.request, { ignoreSearch: true }); };
  var lento = new Promise(function (ok) { setTimeout(function () { ok('LENTO'); }, LIMITE_MS); });
  e.waitUntil(rede.catch(function () {}));
  // a rede acabou de se mostrar lenta: nos próximos 60 s entrega direto a cópia guardada (a rede atualiza por trás)
  if (Date.now() < modoLento) return guardado().then(function (g) { return g || rede; });
  return Promise.race([rede.catch(function () { return 'FALHOU'; }), lento]).then(function (r) {
    if (r === 'LENTO') modoLento = Date.now() + 60000;
    if (r !== 'LENTO' && r !== 'FALHOU') return r;
    return guardado().then(function (g) {
      if (g) return g;
      if (r === 'LENTO') return rede.catch(function () { return caches.match('index.html'); });
      return e.request.mode === 'navigate' ? caches.match('index.html') : Response.error();
    });
  });
}
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (ehFonte(u)) { e.respondWith(guardadoPrimeiro(C_FONTES, e.request, false).catch(function () { return Response.error(); })); return; }
  if (/googleapis\.com|accounts\.google\.com|gstatic\.com/.test(u.host)) return;   // Google (Drive, Agenda, login): sempre rede
  if (ehLeitor(u)) { e.respondWith(guardadoPrimeiro(C_OCR, e.request, false)); return; }
  e.respondWith(redePrimeiro(e, u));
});
