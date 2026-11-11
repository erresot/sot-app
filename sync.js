/* =====================================================================
   SOT App — Google (login, Drive, Doc), sincronização, fotos e backup
   Tudo é salvo primeiro no aparelho; a nuvem recebe quando houver rede.
   ===================================================================== */
var CFG = window.SOT_CONFIG || {};
var SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly';
var API = 'https://www.googleapis.com/drive/v3', UP = 'https://www.googleapis.com/upload/drive/v3';

/* ---------------- fotos guardadas no aparelho (IndexedDB) ---------------- */
var FDB = (function () {
  var dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (ok, err) {
      try {
        var r = indexedDB.open('sot-fotos', 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('f'); };
        r.onsuccess = function () { ok(r.result); }; r.onerror = function () { err(r.error); };
      } catch (e) { err(e); }
    });
    return dbp;
  }
  function tx(mode, fn) { return db().then(function (d) { return new Promise(function (ok, err) { var t = d.transaction('f', mode), s = t.objectStore('f'), r = fn(s); t.oncomplete = function () { ok(r && r.result); }; t.onerror = function () { err(t.error); }; }); }); }
  return {
    put: function (k, blob) { return tx('readwrite', function (s) { return s.put(blob, k); }); },
    get: function (k) { return tx('readonly', function (s) { return s.get(k); }); },
    del: function (k) { return tx('readwrite', function (s) { return s.delete(k); }); }
  };
})();

var SYNC = (function () {
  var token = null, tokenExp = 0, tokenClient = null, pastas = {}, rodando = false, timer = null, ultimoErro = '';
  var st = { estado: 'local', msg: 'só neste aparelho', pend: 0 };

  /* ---------- login Google ---------- */
  function configurado() { return !!CFG.CLIENT_ID; }
  function temToken() { return (window.__TEST_TOKEN) || (token && Date.now() < tokenExp - 60000); }
  function tok() { return window.__TEST_TOKEN || token; }
  function initGIS() {
    if (tokenClient || !configurado() || !window.google || !google.accounts || !google.accounts.oauth2) return !!tokenClient;
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CFG.CLIENT_ID, scope: SCOPES, hint: CFG.CONTA || undefined,
      callback: function (r) {
        if (r && r.access_token) {
          token = r.access_token; tokenExp = Date.now() + (r.expires_in || 3600) * 1000;
          try { sessionStorage.setItem('sot-tk', JSON.stringify({ t: token, e: tokenExp })); } catch (e) {}
          estado('ok', 'conectado'); agora();
        } else estado('erro', 'login cancelado');
      }
    });
    return true;
  }
  function conectar() {
    if (window.__TEST_TOKEN) { agora(); return; }
    if (!configurado()) { toast('Falta configurar o CLIENT_ID (veja o guia)'); return; }
    if (!initGIS()) { toast('Login do Google ainda carregando… tente de novo em 2 s'); return; }
    tokenClient.requestAccessToken({ prompt: token ? '' : 'consent' });
  }
  try { var t0 = JSON.parse(sessionStorage.getItem('sot-tk') || 'null'); if (t0 && Date.now() < t0.e) { token = t0.t; tokenExp = t0.e; } } catch (e) {}

  /* ---------- chamadas ao Drive ---------- */
  function req(url, opt) {
    opt = opt || {}; opt.headers = Object.assign({ Authorization: 'Bearer ' + tok() }, opt.headers || {});
    return fetch(url, opt).then(function (r) {
      if (r.status === 401) { token = null; tokenExp = 0; throw { auth: true, msg: 'login expirado' }; }
      if (!r.ok) return r.text().then(function (t) { throw { status: r.status, msg: t.slice(0, 200) }; });
      return r;
    });
  }
  function q(s) { return encodeURIComponent(s); }
  function pasta(nome, pai) {
    var k = (pai || 'root') + '/' + nome; if (pastas[k]) return Promise.resolve(pastas[k]);
    var busca = "name='" + nome.replace(/'/g, "\\'") + "' and mimeType='application/vnd.google-apps.folder' and trashed=false and '" + (pai || 'root') + "' in parents";
    return req(API + '/files?q=' + q(busca) + '&fields=files(id,name)&spaces=drive').then(function (r) { return r.json(); }).then(function (j) {
      if (j.files && j.files.length) return (pastas[k] = j.files[0].id);
      return req(API + '/files?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: nome, mimeType: 'application/vnd.google-apps.folder', parents: [pai || 'root'] }) })
        .then(function (r) { return r.json(); }).then(function (f) { return (pastas[k] = f.id); });
    });
  }
  function raiz() { return pasta(CFG.PASTA || 'SOT App - Visitas'); }
  function sub(n) { return raiz().then(function (id) { return pasta(n, id); }); }
  function listar(pai) {
    var out = [];
    function pg(tk) {
      return req(API + '/files?q=' + q("'" + pai + "' in parents and trashed=false") + '&fields=nextPageToken,files(id,name,modifiedTime,appProperties)&pageSize=1000' + (tk ? '&pageToken=' + tk : ''))
        .then(function (r) { return r.json(); }).then(function (j) { out = out.concat(j.files || []); return j.nextPageToken ? pg(j.nextPageToken) : out; });
    }
    return pg('');
  }
  function multipart(meta, blob, tipo) {
    var b = 'sotb' + Math.random().toString(36).slice(2);
    var corpo = new Blob(['--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) + '\r\n--' + b + '\r\nContent-Type: ' + tipo + '\r\n\r\n', blob, '\r\n--' + b + '--'], { type: 'multipart/related; boundary=' + b });
    return { corpo: corpo, ct: 'multipart/related; boundary=' + b };
  }
  function criarArquivo(nome, pai, blob, tipo, props) {
    var m = multipart({ name: nome, parents: [pai], appProperties: props || undefined }, blob, tipo);
    return req(UP + '/files?uploadType=multipart&fields=id,modifiedTime', { method: 'POST', headers: { 'Content-Type': m.ct }, body: m.corpo }).then(function (r) { return r.json(); });
  }
  function atualizarArquivo(id, blob, tipo) {
    return req(UP + '/files/' + id + '?uploadType=media&fields=id,modifiedTime', { method: 'PATCH', headers: { 'Content-Type': tipo }, body: blob }).then(function (r) { return r.json(); });
  }
  function baixarJSON(id) { return req(API + '/files/' + id + '?alt=media').then(function (r) { return r.json(); }); }
  function baixarBlob(id) { return req(API + '/files/' + id + '?alt=media').then(function (r) { return r.blob(); }); }
  function exportarDoc() {
    if (!CFG.DOC_ID) return Promise.reject({ msg: 'DOC_ID não configurado' });
    return req(API + '/files/' + CFG.DOC_ID + '/export?mimeType=text/html').then(function (r) { return r.text(); });
  }

  /* ---------- registro de cada paciente (o que vai para a nuvem) ---------- */
  function diasGuardar() { return isoAdd(S.hoje, -7); }
  function registro(pid) {
    var vis = {};
    Object.keys(S.vis || {}).forEach(function (d) { if (d >= diasGuardar() && S.vis[d][pid]) vis[d] = S.vis[d][pid]; });
    var p = S.pacientes.find(function (x) { return x.id === pid; });
    return {
      pid: pid, v: 1,
      ident: p ? { nome: p.nome, leito: p.leito || '', registro: p.registro || '' } : (S.idents || {})[pid] || null,
      manual: p && p.manual ? p : null,
      visitas: vis, pend: S.pend[pid] || [], pendDel: (S.pendDel || {})[pid] || [], evo: S.evo[pid] || [], fotos: (S.fotos || {})[pid] || []
    };
  }
  function idsLocais() {
    var ids = {};
    S.pacientes.forEach(function (p) { ids[p.id] = 1; });
    Object.keys(S.vis || {}).forEach(function (d) { Object.keys(S.vis[d]).forEach(function (k) { ids[k] = 1; }); });
    Object.keys(S.evo || {}).forEach(function (k) { ids[k] = 1; });
    Object.keys(S.fotos || {}).forEach(function (k) { ids[k] = 1; });
    Object.keys(S.pend || {}).forEach(function (k) { if ((S.pend[k] || []).some(function (x) { return !x.auto; })) ids[k] = 1; });
    return Object.keys(ids).filter(function (k) { return k && k !== 'undefined'; });
  }
  function hasLocal(pid) { var r = registro(pid); return Object.keys(r.visitas).length || r.evo.length || r.fotos.length || r.pend.some(function (x) { return !x.auto; }) || r.pendDel.length; }
  function sujo(pid) { var j = JSON.stringify(registro(pid)); return (S.sync.enviado || {})[pid] !== j; }
  function contarPend() {
    var n = idsLocais().filter(function (pid) { var r = registro(pid); return (Object.keys(r.visitas).length || r.evo.length || r.fotos.length || r.pend.some(function (x) { return !x.auto; })) && sujo(pid); }).length;
    var f = 0; Object.keys(S.fotos || {}).forEach(function (k) { S.fotos[k].forEach(function (x) { if (!x.driveId && !x.del) f++; }); });
    return { reg: n, fotos: f, total: n + f };
  }
  /* mescla: o mais recente vence por item (visita do dia, pendência, evolução do dia, foto) */
  function mesclar(pid, rem) {
    if (rem.ident) { S.idents = S.idents || {}; S.idents[pid] = rem.ident; }
    if (rem.manual && !S.pacientes.some(function (p) { return p.id === pid; })) S.pacientes.push(rem.manual);
    Object.keys(rem.visitas || {}).forEach(function (d) {
      S.vis[d] = S.vis[d] || {}; var l = S.vis[d][pid], r = rem.visitas[d];
      if (!l || (r._at || 0) > (l._at || 0)) S.vis[d][pid] = r;
    });
    S.pendDel = S.pendDel || {};
    var del = (S.pendDel[pid] || []).concat(rem.pendDel || []).filter(function (x, i, a) { return a.indexOf(x) === i; });
    S.pendDel[pid] = del;
    var L = (S.pend[pid] || []).slice();
    (rem.pend || []).forEach(function (x) {
      var i = L.findIndex(function (y) { return y.t === x.t; });
      if (i < 0) L.push(x); else if ((x.at || 0) > (L[i].at || 0)) L[i] = x;
    });
    S.pend[pid] = L.filter(function (x) { return del.indexOf(x.t) < 0; });
    var E = (S.evo[pid] || []).slice();
    (rem.evo || []).forEach(function (x) {
      var i = E.findIndex(function (y) { return y.data === x.data; });
      if (i < 0) E.push(x); else if ((x.at || 0) > (E[i].at || 0)) E[i] = x;
    });
    E.sort(function (a, b) { return a.data < b.data ? -1 : 1; }); S.evo[pid] = E.slice(-5);
    S.fotos = S.fotos || {};
    var F = (S.fotos[pid] || []).slice();
    (rem.fotos || []).forEach(function (x) {
      var i = F.findIndex(function (y) { return y.lid === x.lid; });
      if (i < 0) F.push(x); else { if (x.driveId && !F[i].driveId) F[i].driveId = x.driveId; if (x.del) F[i].del = true; }
    });
    S.fotos[pid] = F;
  }

  /* ---------- ciclo de sincronização ---------- */
  function estado(e, m) { st.estado = e; st.msg = m; desenharStatus(); }
  function agendar() { clearTimeout(timer); timer = setTimeout(agora, 2500); desenharStatus(); }
  function agora() {
    if (rodando) return Promise.resolve();
    st.pend = contarPend().total;
    if (!navigator.onLine) { estado('off', 'sem internet — tudo salvo no aparelho'); return Promise.resolve(); }
    if (!configurado() && !window.__TEST_TOKEN) { estado('local', 'só neste aparelho (login não configurado)'); return Promise.resolve(); }
    if (!temToken()) { estado('login', 'toque para conectar ao Google'); return Promise.resolve(); }
    rodando = true; estado('sync', 'sincronizando…');
    S.sync = S.sync || {}; S.sync.enviado = S.sync.enviado || {}; S.sync.ids = S.sync.ids || {}; S.sync.vistos = S.sync.vistos || {};
    var pPac;
    return sub('pacientes').then(function (id) { pPac = id; return listar(id); }).then(function (files) {
      // 1) baixa o que mudou na nuvem (outros aparelhos) e mescla
      var baixar = files.filter(function (f) { var pid = f.name.replace(/\.json$/, ''); S.sync.ids[pid] = f.id; return S.sync.vistos[pid] !== f.modifiedTime; });
      return baixar.reduce(function (pr, f) {
        return pr.then(function () {
          var pid = f.name.replace(/\.json$/, '');
          return baixarJSON(f.id).then(function (rem) {
            var tinhaLocal = S.sync.enviado[pid] !== undefined ? sujo(pid) : idsLocais().indexOf(pid) > -1 && sujo(pid) && hasLocal(pid);
            mesclar(pid, rem); S.sync.vistos[pid] = f.modifiedTime;
            if (!tinhaLocal) S.sync.enviado[pid] = JSON.stringify(registro(pid));   // nada novo aqui: não reenviar (evita vai-e-volta)
          });
        });
      }, Promise.resolve()).then(function () { return baixar.length; });
    }).then(function (nb) {
      // 2) envia o que mudou aqui
      var envia = idsLocais().filter(function (pid) { var r = registro(pid); return (Object.keys(r.visitas).length || r.evo.length || r.fotos.length || r.pend.some(function (x) { return !x.auto; }) || r.pendDel.length) && sujo(pid); });
      return envia.reduce(function (pr, pid) {
        return pr.then(function () {
          var j = JSON.stringify(registro(pid)), b = new Blob([j], { type: 'application/json' });
          var op = S.sync.ids[pid] ? atualizarArquivo(S.sync.ids[pid], b, 'application/json') : criarArquivo(pid + '.json', pPac, b, 'application/json');
          return op.then(function (f) { S.sync.ids[pid] = f.id; S.sync.vistos[pid] = f.modifiedTime; S.sync.enviado[pid] = j; });
        });
      }, Promise.resolve()).then(function () { return { nb: nb, ne: envia.length }; });
    }).then(function (x) {
      return enviarFotos().then(function (nf) { x.nf = nf; return backupDiario().then(function () { return x; }); });
    }).then(function (x) {
      S.sync.ultimo = Date.now(); saveLocal(); rodando = false;
      st.pend = contarPend().total;
      estado('ok', 'sincronizado ' + hhmm(new Date()) + (x.nb ? ' · ' + x.nb + ' recebido(s)' : '') + (x.ne ? ' · ' + x.ne + ' enviado(s)' : '') + (x.nf ? ' · ' + x.nf + ' foto(s)' : ''));
      if (x.nb && typeof render === 'function') { render(); if (atual && !document.querySelector('#sheet input:focus,#sheet textarea:focus')) redesenhar(); }
    }).catch(function (e) {
      rodando = false; ultimoErro = (e && (e.msg || e.message)) || String(e);
      if (e && e.auth) estado('login', 'login expirou — toque para reconectar');
      else if (!navigator.onLine) estado('off', 'sem internet — tudo salvo no aparelho');
      else estado('erro', 'falha ao sincronizar (tenta de novo sozinho): ' + ultimoErro.slice(0, 80));
    });
  }
  function enviarFotos() {
    var lista = [];
    Object.keys(S.fotos || {}).forEach(function (pid) { S.fotos[pid].forEach(function (f) { if (!f.driveId && !f.del) lista.push([pid, f]); }); });
    if (!lista.length) return Promise.resolve(0);
    var n = 0;
    return sub('fotos').then(function (pf) {
      return lista.reduce(function (pr, it) {
        return pr.then(function () {
          var pid = it[0], f = it[1];
          return FDB.get(f.lid).then(function (blob) {
            if (!blob) return;
            return pasta(pid, pf).then(function (pp) { return criarArquivo(f.nome, pp, blob, 'image/jpeg', { pid: pid, tipo: f.tipo, lid: f.lid }); })
              .then(function (r) { f.driveId = r.id; n++; saveLocal(); });
          });
        });
      }, Promise.resolve());
    }).then(function () { return n; });
  }
  function backupDiario() {
    S.sync.backups = S.sync.backups || {};
    if (S.sync.backups[S.hoje]) return Promise.resolve();
    return sub('backups').then(function (pb) {
      var b = new Blob([JSON.stringify(backupObj())], { type: 'application/json' });
      return criarArquivo('backup-' + S.hoje + '-' + hhmm(new Date()).replace(':', 'h') + '.json', pb, b, 'application/json');
    }).then(function () { S.sync.backups[S.hoje] = 1; });
  }
  function backupObj() {
    var o = {}; ['hoje', 'pacientes', 'vis', 'pend', 'pendDel', 'evo', 'fotos', 'conf', 'fonte', 'dataIG', 'cab', 'idents', 'dihConv'].forEach(function (k) { o[k] = S[k]; });
    o.geradoEm = new Date().toISOString(); o.por = S.eu || ''; return o;
  }
  function hhmm(d) { return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function desenharStatus() {
    var el = document.getElementById('sync'); if (!el) return;
    var ic = { ok: '☁︎', sync: '⟳', off: '📴', login: '🔑', erro: '⚠', local: '📱' }[st.estado] || '';
    var pend = contarPend().total;
    el.className = 'sync ' + st.estado;
    el.innerHTML = ic + ' ' + esc(st.msg) + (pend ? ' · <b>' + pend + ' aguardando envio</b>' : '');
  }

  window.addEventListener('online', function () { agendar(); });
  window.addEventListener('offline', function () { estado('off', 'sem internet — tudo salvo no aparelho'); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) agendar(); });
  setInterval(function () { if (!document.hidden) agora(); }, 45000);
  window.addEventListener('load', function () { setTimeout(function () { initGIS(); agora(); }, 800); });

  return { agendar: agendar, agora: agora, conectar: conectar, exportarDoc: exportarDoc, baixarBlob: baixarBlob, backupObj: backupObj,
    status: function () { return st; }, temToken: temToken, configurado: configurado, contarPend: contarPend, _mesclar: mesclar, _registro: registro, erro: function () { return ultimoErro; } };
})();

/* ---------------- fotos: câmera → reduz → guarda no aparelho → fila ---------------- */
var FOTO = {
  reduzir: function (file) {
    return new Promise(function (ok, err) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var M = 1600, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, M / Math.max(w, h));
        var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? ok(b) : err('falha ao converter'); }, 'image/jpeg', 0.82);
      };
      img.onerror = function () { err('imagem inválida'); }; img.src = url;
    });
  },
  adicionar: function (pid, tipo, file, legenda) {
    return FOTO.reduzir(file).then(function (blob) {
      var p = S.pacientes.find(function (x) { return x.id === pid; }) || {};
      var agora = new Date(), lid = 'f' + agora.getTime() + Math.random().toString(36).slice(2, 6);
      var carimbo = S.hoje + '_' + ('0' + agora.getHours()).slice(-2) + ('0' + agora.getMinutes()).slice(-2);
      var nome = [(p.leito || p.lugar || 'sem-leito'), (p.registro || ''), tipo === 'rx' ? 'RX' : 'PELE', carimbo, (legenda || '').replace(/[^\wÀ-ÿ -]/g, '').trim()].filter(Boolean).join('_').replace(/\s+/g, '-') + '.jpg';
      return FDB.put(lid, blob).then(function () {
        S.fotos = S.fotos || {}; (S.fotos[pid] = S.fotos[pid] || []).push({ lid: lid, tipo: tipo, data: S.hoje, hora: carimbo.slice(-4), legenda: legenda || '', nome: nome, by: S.eu || '', at: Date.now() });
        save(); return lid;
      });
    });
  },
  url: function (f) {
    FOTO._c = FOTO._c || {};
    if (FOTO._c[f.lid]) return Promise.resolve(FOTO._c[f.lid]);
    return FDB.get(f.lid).then(function (b) {
      if (b) return (FOTO._c[f.lid] = URL.createObjectURL(b));
      if (f.driveId && SYNC.temToken()) return SYNC.baixarBlob(f.driveId).then(function (bl) { FDB.put(f.lid, bl); return (FOTO._c[f.lid] = URL.createObjectURL(bl)); });
      return null;
    });
  }
};
