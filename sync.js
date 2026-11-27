/* =====================================================================
   SOT App — Google (login, Drive, Doc), sincronização, fotos e backup
   Tudo é salvo primeiro no aparelho; a nuvem recebe quando houver rede.
   ===================================================================== */
var CFG = window.SOT_CONFIG || {};
var SCOPE_CAL = 'https://www.googleapis.com/auth/calendar.readonly';
var SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly ' + SCOPE_CAL;
var CAL = 'https://www.googleapis.com/calendar/v3';
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
          token = r.access_token; tokenExp = Date.now() + (r.expires_in || 3600) * 1000; tokScope = r.scope || '';
          try { localStorage.setItem('sot-tk', JSON.stringify({ t: token, e: tokenExp, s: tokScope })); localStorage.setItem('sot-logou', '1'); } catch (e) {}
          if (typeof window.aoGanharAgenda === 'function' && temAgenda()) setTimeout(window.aoGanharAgenda, 300);
          renovando = false;
          estado('ok', 'conectado'); agora();
        } else { renovando = false; estado('erro', 'login cancelado'); }
      },
      error_callback: function () { renovando = false; }
    });
    return true;
  }
  function conectar() {
    if (window.__TEST_TOKEN) { agora(); return; }
    if (!configurado()) { toast('Falta configurar o CLIENT_ID (veja o guia)'); return; }
    if (!initGIS()) { toast('Login do Google ainda carregando… tente de novo em 2 s'); return; }
    if (renovando && Date.now() - ultimaRenov < 10000) return;
    renovando = true; ultimaRenov = Date.now();
    tokenClient.requestAccessToken({ prompt: (token || jaLogou()) ? '' : 'consent' });
  }
  /* manter conectado: token guardado no aparelho (vale ~1 h) + renovação silenciosa no 1º toque */
  var renovando = false, ultimaRenov = 0;
  function jaLogou() { try { return localStorage.getItem('sot-logou') === '1'; } catch (e) { return false; } }
  var tokScope = '';
  try { var t0 = JSON.parse(localStorage.getItem('sot-tk') || sessionStorage.getItem('sot-tk') || 'null'); if (t0 && Date.now() < t0.e) { token = t0.t; tokenExp = t0.e; tokScope = t0.s || ''; } } catch (e) {}
  /* ---------- Google Agenda (só leitura) ---------- */
  function temAgenda() { return !!window.__TEST_TOKEN || (temToken() && tokScope.indexOf('calendar') > -1); }
  function pedirAgenda() {
    if (!configurado() || !initGIS()) { toast('Login do Google ainda carregando… tente de novo'); return; }
    renovando = true; ultimaRenov = Date.now();
    tokenClient.requestAccessToken({ prompt: 'consent' });
  }
  function calListar() {
    return req(CAL + '/users/me/calendarList?minAccessRole=reader&fields=items(id,summary,summaryOverride,primary,accessRole,backgroundColor)').then(function (r) { return r.json(); }).then(function (j) { return j.items || []; });
  }
  function calEventos(id, min, max) {
    var url = CAL + '/calendars/' + encodeURIComponent(id) + '/events?singleEvents=true&orderBy=startTime&maxResults=500&timeMin=' + q(min.toISOString()) + '&timeMax=' + q(max.toISOString()) +
      '&fields=items(id,summary,description,start,end,attachments,htmlLink,updated,status)';
    return req(url).then(function (r) { return r.json(); }).then(function (j) { return j.items || []; });
  }
  function renovarSePreciso() {
    if (window.__TEST_TOKEN || renovando || !configurado() || !jaLogou() || !navigator.onLine) return;
    if (token && Date.now() < tokenExp - 5 * 60000) return;
    if (Date.now() - ultimaRenov < 60000) return;
    if (!initGIS()) return;
    ultimaRenov = Date.now(); renovando = true;
    try { tokenClient.requestAccessToken({ prompt: '' }); } catch (e) { renovando = false; }
  }
  document.addEventListener('pointerdown', renovarSePreciso, true);

  /* ---------- chamadas ao Drive ---------- */
  // cada pedido ao Google tem tempo-limite (conexão "pendurada" não trava mais a sincronização inteira)
  // e tenta de novo sozinho em falhas passageiras (limite de uso, servidor ocupado, rede caiu no meio)
  function esperarMs(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function req(url, opt, tent) {
    opt = opt || {}; tent = tent || 0;
    var metodo = (opt.method || 'GET').toUpperCase(), upload = url.indexOf('/upload/') > -1;
    var o = Object.assign({}, opt); o.headers = Object.assign({ Authorization: 'Bearer ' + tok() }, opt.headers || {});
    var ctl = window.AbortController ? new AbortController() : null, tm = null;
    if (ctl) { o.signal = ctl.signal; tm = setTimeout(function () { ctl.abort(); }, window.__SYNC_TO || (upload ? 120000 : 30000)); }
    function deNovo(motivo, criarSeguro) {
      // criar arquivo (POST) só repete quando o Google garantiu que não fez nada (limite/ocupado) — evita arquivo duplicado
      if (tent >= 3 || (metodo === 'POST' && !criarSeguro)) return null;
      return esperarMs([1000, 3000, 8000][tent] + Math.random() * 500).then(function () { return req(url, opt, tent + 1); });
    }
    return fetch(url, o).then(function (r) {
      clearTimeout(tm);
      if (r.status === 401) { token = null; tokenExp = 0; try { localStorage.removeItem('sot-tk'); } catch (e) {} throw { auth: true, msg: 'login expirado' }; }
      if (!r.ok) return r.text().then(function (t) {
        var limite = r.status === 429 || (r.status === 403 && /rate ?limit|userRateLimit|rateLimitExceeded/i.test(t));
        var p = (limite || r.status === 503) ? deNovo('limite', true) : (r.status >= 500 ? deNovo('servidor', false) : null);
        if (p) return p;
        throw { status: r.status, msg: t.slice(0, 200) };
      });
      return r;
    }, function (e) {
      clearTimeout(tm);
      var p = deNovo('rede', false);
      if (p) return p;
      throw { msg: (e && e.name === 'AbortError') ? 'o Google demorou demais para responder' : ((e && e.message) || 'falha de rede') };
    });
  }
  function q(s) { return encodeURIComponent(s); }
  function pasta(nome, pai) {
    var k = (pai || 'root') + '/' + nome; if (pastas[k]) return pastas[k];   // guarda a PROMESSA: duas chamadas ao mesmo tempo não criam duas pastas
    var busca = "name='" + nome.replace(/'/g, "\\'") + "' and mimeType='application/vnd.google-apps.folder' and trashed=false and '" + (pai || 'root') + "' in parents";
    var p = req(API + '/files?q=' + q(busca) + '&fields=files(id,name)&orderBy=createdTime&spaces=drive').then(function (r) { return r.json(); }).then(function (j) {
      if (j.files && j.files.length) return j.files[0].id;   // se já houver duplicadas, usa sempre a mais antiga
      return req(API + '/files?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: nome, mimeType: 'application/vnd.google-apps.folder', parents: [pai || 'root'] }) })
        .then(function (r) { return r.json(); }).then(function (f) { return f.id; });
    });
    pastas[k] = p; p.catch(function () { if (pastas[k] === p) delete pastas[k]; });
    return p;
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
  function acharFoto(lid) {
    return req(API + '/files?q=' + q("appProperties has { key='lid' and value='" + lid + "' } and trashed=false") + '&fields=files(id)').then(function (r) { return r.json(); }).then(function (j) { return j.files && j.files[0] ? j.files[0].id : null; });
  }
  /* ---------- v68: cópia atualizada do internograma (Atualizador) ----------
     Copia o Doc oficial (cópia idêntica, pela API do Drive) e altera SÓ a cópia (API do Google Docs).
     TRAVA: docAlterar recusa o internograma oficial — nesta etapa o app nunca escreve nele. */
  var DOCS_API = 'https://docs.googleapis.com/v1/documents/';
  function copiarInternograma(nome) {
    if (!CFG.DOC_ID) return Promise.reject({ msg: 'DOC_ID não configurado' });
    return req(API + '/files/' + CFG.DOC_ID + '/copy?fields=id,name,webViewLink&supportsAllDrives=true', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: nome }) })
      .then(function (r) { return r.json(); });
  }
  function docLer(id) { return req(DOCS_API + encodeURIComponent(id)).then(function (r) { return r.json(); }); }
  function docAlterar(id, pedidos, revisao) {
    if (!id || id === CFG.DOC_ID) return Promise.reject({ msg: 'Por segurança, o app não altera o internograma oficial.' });
    var corpo = { requests: pedidos }; if (revisao) corpo.writeControl = { requiredRevisionId: revisao };
    return req(DOCS_API + encodeURIComponent(id) + ':batchUpdate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }).then(function (r) { return r.json(); });
  }
  function exportarDoc() {
    if (!CFG.DOC_ID) return Promise.reject({ msg: 'DOC_ID não configurado' });
    return req(API + '/files/' + CFG.DOC_ID + '/export?mimeType=text/html').then(function (r) { return r.text(); });
  }

  /* ---------- registro de cada paciente (o que vai para a nuvem) ---------- */
  function diasGuardar() { return isoAdd(S.hoje, -7); }
  function registro(pid) {
    var ap = (S.apagados || {})[pid];
    if (ap && !hasLocalRaw(pid)) return { pid: pid, v: 1, apagado: true, em: ap };
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
    Object.keys(S.apagados || {}).forEach(function (k) { ids[k] = 1; });
    return Object.keys(ids).filter(function (k) { return k && k !== 'undefined'; });
  }
  function hasLocalRaw(pid) { return Object.keys(S.vis || {}).some(function (d) { return S.vis[d][pid]; }) || (S.evo[pid] || []).length || ((S.fotos || {})[pid] || []).length || (S.pend[pid] || []).some(function (x) { return !x.auto; }); }
  function hasLocal(pid) { var r = registro(pid); if (r.apagado) return true; return Object.keys(r.visitas).length || r.evo.length || r.fotos.length || r.pend.some(function (x) { return !x.auto; }) || r.pendDel.length; }
  function sujo(pid) { var j = JSON.stringify(registro(pid)); return (S.sync.enviado || {})[pid] !== j; }
  /* limpeza do aparelho (1x por dia, depois de sincronizar):
     - visitas com mais de 45 dias saem (estão no backup diário do Drive)
     - paciente que saiu do internograma há mais de 30 dias e já está todo no Drive: sai do aparelho (fica no Drive)
     - se ele voltar ao internograma, o histórico é baixado de novo */
  function ultimaAtividade(pid) {
    var u = '';
    Object.keys(S.vis || {}).forEach(function (d) { if (S.vis[d][pid] && d > u) u = d; });
    (S.evo[pid] || []).forEach(function (e) { if (e.data > u) u = e.data; });
    ((S.fotos || {})[pid] || []).forEach(function (f) { if (f.data > u) u = f.data; });
    (S.pend[pid] || []).forEach(function (x) { if (x.at) { var d = isoLocal(new Date(x.at)); if (d > u) u = d; } });
    return u;
  }
  function arquivar() {
    S.sync.arq = S.sync.arq || {};
    var no = {}; S.pacientes.forEach(function (p) { no[p.id] = 1; });
    Object.keys(S.sync.arq).forEach(function (pid) { if (no[pid]) { delete S.sync.arq[pid]; delete S.sync.vistos[pid]; } });   // voltou: baixa o histórico
    if (S.sync.arqDia === S.hoje) return Promise.resolve(0);
    var limVis = isoAdd(S.hoje, -45), limPac = isoAdd(S.hoje, -30), n = 0, apagarFotos = [];
    Object.keys(S.vis || {}).forEach(function (d) { if (d < limVis) delete S.vis[d]; });
    idsLocais().forEach(function (pid) {
      if (no[pid] || !S.sync.ids[pid] || sujo(pid) || (S.apagados || {})[pid]) return;
      var u = ultimaAtividade(pid); if (u && u >= limPac) return;
      if (((S.fotos || {})[pid] || []).some(function (f) { return !f.driveId && !f.del && !f.perdida; })) return;   // foto ainda não subiu
      ((S.fotos || {})[pid] || []).forEach(function (f) { apagarFotos.push(f.lid); });
      Object.keys(S.vis || {}).forEach(function (d) { delete S.vis[d][pid]; });
      delete S.evo[pid]; delete S.pend[pid]; if (S.pendDel) delete S.pendDel[pid]; if (S.fotos) delete S.fotos[pid]; if (S.evoAlt) delete S.evoAlt[pid];
      delete S.sync.enviado[pid]; S.sync.arq[pid] = 1; n++;
    });
    Object.keys(S.vis || {}).forEach(function (d) { if (!Object.keys(S.vis[d]).length) delete S.vis[d]; });
    S.sync.arqDia = S.hoje;
    return Promise.all(apagarFotos.map(function (lid) { return FDB.del(lid).catch(function () {}); })).then(function () { return n; });
  }
  function contarPend() {
    var n = idsLocais().filter(function (pid) { var r = registro(pid); if (r.apagado) return sujo(pid); return (Object.keys(r.visitas).length || r.evo.length || r.fotos.length || r.pend.some(function (x) { return !x.auto; })) && sujo(pid); }).length;
    var f = 0; Object.keys(S.fotos || {}).forEach(function (k) { S.fotos[k].forEach(function (x) { if (!x.driveId && !x.del && !x.perdida) f++; }); });
    return { reg: n, fotos: f, total: n + f };
  }
  /* pendência apagada = "lápide" com texto + hora. Some só a pendência com esse texto que já existia antes de apagar;
     se alguém criar de novo o mesmo texto depois, ela fica. (Lápides antigas, só texto, continuam valendo como antes.) */
  function lapides(L) { return (L || []).map(function (x) { return typeof x === 'string' ? { t: x, at: 9e15 } : x; }).filter(function (x) { return x && x.t; }); }
  function juntarLapides(a, b) {
    var M = {}; lapides(a).concat(lapides(b)).forEach(function (x) { if (!M[x.t] || (x.at || 0) > (M[x.t].at || 0)) M[x.t] = { t: x.t, at: x.at || 0 }; });
    return Object.keys(M).sort().map(function (k) { return M[k]; });
  }
  function apagadaPor(L, x) { return lapides(L).some(function (d) { return d.t === x.t && (d.at || 0) >= (x.at || 0); }); }
  // texto estável de um objeto (chaves em ordem) — para comparar e desempatar igual em todos os aparelhos
  function canon(o) {
    if (o === undefined) return '';
    if (o === null || typeof o !== 'object') return JSON.stringify(o);
    if (Array.isArray(o)) return '[' + o.map(canon).join(',') + ']';
    return '{' + Object.keys(o).sort().map(function (k) { return JSON.stringify(k) + ':' + canon(o[k]); }).join(',') + '}';
  }
  /* Depois de mesclar: tudo o que este aparelho tem deste paciente já está no arquivo da nuvem?
     Se não estiver (ex.: dois aparelhos gravaram quase juntos e um passou por cima do outro), reenvia. */
  function contidoNaNuvem(pid, rem) {
    var m = registro(pid);
    if (m.apagado) return !!rem.apagado;
    if (rem.apagado) return false;
    var ok = true;
    Object.keys(m.visitas || {}).forEach(function (d) { if (canon(m.visitas[d]) !== canon((rem.visitas || {})[d])) ok = false; });
    (m.pend || []).forEach(function (x) { if (x.auto) return; if (!(rem.pend || []).some(function (y) { return y.t === x.t && canon(y) === canon(x); })) ok = false; });
    lapides(m.pendDel).forEach(function (d) { if (!lapides(rem.pendDel).some(function (r) { return r.t === d.t && (r.at || 0) >= (d.at || 0); })) ok = false; });
    (m.evo || []).forEach(function (x) { if (!(rem.evo || []).some(function (y) { return y.data === x.data && canon(y) === canon(x); })) ok = false; });
    (m.fotos || []).forEach(function (x) { if (!(rem.fotos || []).some(function (y) { return y.lid === x.lid && canon(y) === canon(x); })) ok = false; });
    return ok;
  }
  var reenvios = {};   // trava de segurança: no máximo 4 reenvios por paciente a cada 10 min (evita vai-e-volta sem fim)
  function podeReenviar(pid) {
    var a = Date.now(), L = (reenvios[pid] || []).filter(function (t) { return a - t < 600000; });
    if (L.length >= 4) { reenvios[pid] = L; return false; }
    L.push(a); reenvios[pid] = L; return true;
  }
  /* mescla: o mais recente vence por item (visita do dia, pendência, evolução do dia, foto) */
  function maisRecente(pid) {
    var t = 0;
    Object.keys(S.vis || {}).forEach(function (d) { var v = S.vis[d][pid]; if (v && v._at > t) t = v._at; });
    (S.evo[pid] || []).forEach(function (e) { if ((e.at || 0) > t) t = e.at; });
    ((S.fotos || {})[pid] || []).forEach(function (f) { if ((f.at || 0) > t) t = f.at; });
    (S.pend[pid] || []).forEach(function (x) { if ((x.at || 0) > t) t = x.at; });
    return t;
  }
  function mesclar(pid, rem) {
    if (rem.apagado) {
      if (maisRecente(pid) > rem.em) return;            // reinternado: dado novo é mais recente que a limpeza
      ((S.fotos || {})[pid] || []).forEach(function (f) { FDB.del(f.lid); });
      if (S.fotos) delete S.fotos[pid]; delete S.evo[pid]; delete S.pend[pid]; if (S.pendDel) delete S.pendDel[pid];
      Object.keys(S.vis || {}).forEach(function (d) { delete S.vis[d][pid]; });
      S.apagados = S.apagados || {}; S.apagados[pid] = rem.em; return;
    }
    if ((S.apagados || {})[pid] && maisRecente(pid) > S.apagados[pid]) delete S.apagados[pid];
    if (rem.ident) { S.idents = S.idents || {}; S.idents[pid] = rem.ident; }
    if (rem.manual && !S.pacientes.some(function (p) { return p.id === pid; })) S.pacientes.push(rem.manual);
    Object.keys(rem.visitas || {}).forEach(function (d) {
      S.vis[d] = S.vis[d] || {}; var l = S.vis[d][pid], r = rem.visitas[d];
      S.vis[d][pid] = mesclarVisita(l, r);
      if (typeof visSnap === 'function') visSnap(d, pid);
    });
    S.pendDel = S.pendDel || {};
    var del = juntarLapides(S.pendDel[pid], rem.pendDel);
    S.pendDel[pid] = del;
    var L = (S.pend[pid] || []).slice();
    (rem.pend || []).forEach(function (x) {
      var i = L.findIndex(function (y) { return y.t === x.t; });
      if (i < 0) L.push(x); else if ((x.at || 0) > (L[i].at || 0) || ((x.at || 0) === (L[i].at || 0) && canon(x) > canon(L[i]))) L[i] = x;
    });
    S.pend[pid] = L.filter(function (x) { return !apagadaPor(del, x); });
    var E = (S.evo[pid] || []).slice();
    (rem.evo || []).forEach(function (x) {
      var i = E.findIndex(function (y) { return y.data === x.data; });
      if (i < 0) { E.push(x); return; }
      var ganha = ((x.at || 0) > (E[i].at || 0) || ((x.at || 0) === (E[i].at || 0) && canon(x) > canon(E[i]))) ? x : E[i], perde = ganha === x ? E[i] : x;
      if (perde.txt && !perde.del && !ganha.del && perde.txt !== ganha.txt && (perde.by || '') !== (ganha.by || '')) guardarAlt(pid, perde, ganha);
      E[i] = ganha;
    });
    E.sort(function (a, b) { return a.data < b.data ? -1 : 1; }); S.evo[pid] = E.slice(-5);
    S.fotos = S.fotos || {};
    var F = (S.fotos[pid] || []).slice();
    (rem.fotos || []).forEach(function (x) {
      var i = F.findIndex(function (y) { return y.lid === x.lid; });
      if (i < 0) { F.push(x); return; }
      var loc = F[i], did = loc.driveId || x.driveId, del = loc.del || x.del;
      if ((x.at || 0) > (loc.at || 0) || ((x.at || 0) === (loc.at || 0) && canon(x) > canon(loc))) F[i] = loc = Object.assign({}, x);
      if (did) loc.driveId = did; if (del) loc.del = true;
    });
    S.fotos[pid] = F;
  }

  // relógio: compara a hora do aparelho com a do Google (horário errado pode fazer um dado velho "ganhar")
  function medirRelogio(mt, t0) {
    var srv = Date.parse(mt); if (isNaN(srv)) return;
    var meio = (t0 + Date.now()) / 2, dif = srv - meio;
    var ad = Math.abs(dif);
    S.sync.skew = ad > 90000 && ad < 6 * 3600000 ? Math.round(dif) : 0;   // compensa até 6 h; mais que isso é suspeito: só avisa
    S.sync.relogioRuim = ad > 6 * 3600000 ? Math.round(dif) : 0;
  }
  var META_V = { _at: 1, _by: 1, _t: 1, _limpo: 1 };
  function mesclarVisita(l, r) {
    if (!l) return r; if (!r) return l;
    var ks = {}, res = {}, t = {};
    [l, r, l._t || {}, r._t || {}].forEach(function (o) { Object.keys(o).forEach(function (k) { if (!META_V[k]) ks[k] = 1; }); });
    Object.keys(ks).forEach(function (k) {
      var tl = l._t ? (l._t[k] || 0) : (l._at || 0), tr = r._t ? (r._t[k] || 0) : (r._at || 0);   // com carimbo por campo, campo sem carimbo = antigo
      var src = (tr > tl || (tr === tl && canon(r[k]) > canon(l[k]))) ? r : l;
      if (Object.prototype.hasOwnProperty.call(src, k)) res[k] = src[k];
      t[k] = Math.max(tl, tr);
    });
    var novo = (r._at || 0) > (l._at || 0) ? r : l;
    res._t = t; res._at = Math.max(l._at || 0, r._at || 0); if (novo._by) res._by = novo._by; if (novo._limpo) res._limpo = 1;
    return res;
  }
  function guardarAlt(pid, perde, ganha) {
    S.evoAlt = S.evoAlt || {}; var L = (S.evoAlt[pid] || []).filter(function (a) { return !(a.data === perde.data && a.txt === perde.txt); });
    L.push({ data: perde.data, txt: perde.txt, by: perde.by || '', at: perde.at || 0, porQuem: ganha.by || '', em: Date.now() });
    S.evoAlt[pid] = L.slice(-6);
  }

  // roda fn em cada item com até n ao mesmo tempo (antes era um por vez: 24 pacientes = 48 idas ao Google em fila)
  function emParalelo(lista, n, fn, tolerante) {
    var i = 0, erro = null, falhas = [];
    function proximo() {
      if (erro || i >= lista.length) return Promise.resolve();
      var it = lista[i++];
      return Promise.resolve().then(function () { return fn(it); }).then(proximo, function (e) {
        if (tolerante && !(e && e.auth)) { falhas.push(e); return proximo(); }
        erro = e; throw e;
      });
    }
    var w = []; for (var k = 0; k < Math.min(n, lista.length); k++) w.push(proximo());
    return Promise.all(w).then(function () { if (falhas.length) throw { msg: falhas.length + ' item(ns) não subiram: ' + ((falhas[0] && (falhas[0].msg || falhas[0].message)) || '?') }; });
  }
  /* ---------- ciclo de sincronização ---------- */
  function estado(e, m) { st.estado = e; st.msg = m; desenharStatus(); }
  function agendar() { clearTimeout(timer); timer = setTimeout(agora, 2500); desenharStatus(); }
  var corrente = Promise.resolve(), inicioSync = 0, listadoEm = 0, modLista = {};
  function agora() {
    if (rodando && Date.now() - inicioSync < 180000) return corrente;
    inicioSync = Date.now(); corrente = agora0(); return corrente;
  }
  function agora0() {
    if (window.__estadoPronto === false) return Promise.resolve();
    st.pend = contarPend().total;
    if (!navigator.onLine) { estado('off', 'sem internet — tudo salvo no aparelho'); return Promise.resolve(); }
    if (!configurado() && !window.__TEST_TOKEN) { estado('local', 'só neste aparelho (login não configurado)'); return Promise.resolve(); }
    if (!temToken()) { estado('login', 'toque para conectar ao Google'); return Promise.resolve(); }
    rodando = true; estado('sync', 'sincronizando…');
    S.sync = S.sync || {}; S.sync.enviado = S.sync.enviado || {}; S.sync.ids = S.sync.ids || {}; S.sync.vistos = S.sync.vistos || {};
    var pPac;
    var dups = [];
    return sub('pacientes').then(function (id) { pPac = id; return listar(id); }).then(function (todos) {
      // dois aparelhos criando o mesmo paciente ao mesmo tempo geram dois arquivos com o mesmo nome:
      // todos escolhem o MESMO (menor id); os outros são juntados nele e vão para a lixeira
      var grp = {}, files = [];
      todos.forEach(function (f) { (grp[f.name] = grp[f.name] || []).push(f); });
      Object.keys(grp).forEach(function (nm) {
        var L = grp[nm].sort(function (a, b) { return a.id < b.id ? -1 : 1; });
        files.push(L[0]); L.slice(1).forEach(function (f) { dups.push({ pid: nm.replace(/\.json$/, ''), f: f }); });
      });
      // 1) baixa o que mudou na nuvem (outros aparelhos) e mescla
      listadoEm = Date.now(); modLista = {};
      var baixar = files.filter(function (f) { var pid = f.name.replace(/\.json$/, ''); S.sync.ids[pid] = f.id; modLista[pid] = f.modifiedTime; return S.sync.vistos[pid] !== f.modifiedTime; });
      return emParalelo(baixar, 6, function (f) {
        return (function () {
          var pid = f.name.replace(/\.json$/, '');
          return baixarJSON(f.id).then(function (rem) {
            var tinhaLocal = S.sync.enviado[pid] !== undefined ? sujo(pid) : idsLocais().indexOf(pid) > -1 && sujo(pid) && hasLocal(pid);
            mesclar(pid, rem); S.sync.vistos[pid] = f.modifiedTime;
            if (!tinhaLocal) {
              if (contidoNaNuvem(pid, rem) || !podeReenviar(pid)) S.sync.enviado[pid] = JSON.stringify(registro(pid));   // nada novo aqui: não reenviar
              else { delete S.sync.enviado[pid]; st.reenvios = (st.reenvios || 0) + 1; }                                     // a nuvem perdeu algo deste aparelho: reenviar
            }
          });
        })();
      }).then(function () {
        return emParalelo(dups, 4, function (d) {
          return baixarJSON(d.f.id).then(function (rem) {
            mesclar(d.pid, rem); delete S.sync.enviado[d.pid];   // reenvia tudo junto no arquivo escolhido
            return req(API + '/files/' + d.f.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) });
          }).catch(function (e) { if (window.ERR) ERR.log('sync-dup', e); });
        });
      }).then(function () { return baixar.length + dups.length; });
    }).then(function (nb) {
      return enviarFotos().then(function (nf) { return { nb: nb, nf: nf }; });
    }).then(function (x0) {
      var nb = x0.nb;
      // 2) envia o que mudou aqui (já com o endereço das fotos)
      var envia = idsLocais().filter(function (pid) { var r = registro(pid); return (r.apagado || Object.keys(r.visitas).length || r.evo.length || r.fotos.length || r.pend.some(function (x) { return !x.auto; }) || r.pendDel.length) && sujo(pid); });
      var feitos = 0; if (envia.length) estado('sync', 'enviando 0/' + envia.length + '…');
      return emParalelo(envia, 6, function (pid) {
        return (function () {
          var recente = Date.now() - listadoEm < 60000 && modLista[pid] && modLista[pid] === S.sync.vistos[pid];   // lista tem menos de 1 min e ninguém mexeu: pula a conferência
          var conferir = S.sync.ids[pid] && !recente ? req(API + '/files/' + S.sync.ids[pid] + '?fields=id,modifiedTime,trashed').then(function (r) { return r.json(); }).then(function (m) {
            if (m && !m.trashed && m.modifiedTime && m.modifiedTime !== S.sync.vistos[pid]) {
              st.conflitos = (st.conflitos || 0) + 1;
              return baixarJSON(m.id).then(function (rem) { mesclar(pid, rem); S.sync.vistos[pid] = m.modifiedTime; });
            }
          }).catch(function (e) { if (window.ERR) ERR.log('sync-conferir', e); }) : Promise.resolve();
          return conferir.then(function () {
            var j = JSON.stringify(registro(pid)), b = new Blob([j], { type: 'application/json' });
            var t0 = Date.now();
            var op = S.sync.ids[pid] ? atualizarArquivo(S.sync.ids[pid], b, 'application/json') : criarArquivo(pid + '.json', pPac, b, 'application/json');
            return op.then(function (f) { S.sync.ids[pid] = f.id; S.sync.vistos[pid] = f.modifiedTime; S.sync.enviado[pid] = j; medirRelogio(f.modifiedTime, t0); feitos++; st.msg = 'enviando ' + feitos + '/' + envia.length + '…'; st.pend = contarPend().total; desenharStatus(); });
          });
        })();
      }, true).then(function () { return { nb: nb, ne: envia.length, nf: x0.nf }; });
    }).then(function (x) {
      return esvaziarLixo().then(function () { return backupDiario(); }).then(function () { return limparBackups().catch(function (e) { if (window.ERR) ERR.log('backups', e); }); }).then(function () { return arquivar().catch(function (e) { if (window.ERR) ERR.log('arquivar', e); }); }).then(function () { return x; });
    }).then(function (x) {
      S.sync.ultimo = Date.now(); saveLocal(); rodando = false;
      st.pend = contarPend().total;
      var sk = S.sync.skew || S.sync.relogioRuim;
      if (sk && !window.__TEST_TOKEN) { estado('erro', '⚠ relógio deste aparelho está ' + Math.round(Math.abs(sk) / 60000) + ' min ' + (sk > 0 ? 'atrasado' : 'adiantado') + ' — ajuste para data/hora automática' + (S.sync.skew ? ' (o app já compensa)' : '')); if (x.nb && typeof render === 'function') render(); return; }
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
    Object.keys(S.fotos || {}).forEach(function (pid) { S.fotos[pid].forEach(function (f) { if (!f.driveId && !f.del && !f.perdida) lista.push([pid, f]); }); });
    if (!lista.length) return Promise.resolve(0);
    var n = 0;
    return sub('fotos').then(function (pf) {
      return emParalelo(lista, 3, function (it) {
        return (function () {
          var pid = it[0], f = it[1];
          return FDB.get(f.lid).then(function (blob) {
            if (!blob) {   // o arquivo da foto não está neste aparelho: já está no Drive? senão, marca como perdida (para de travar o envio e o "Sair")
              return acharFoto(f.lid).then(function (id) { if (id) f.driveId = id; else f.perdida = true; saveLocal(); }, function () {});
            }
            var mm = /^mapa_(\d{4}-\d{2})-(\d{2})_/.exec(pid);
            var destino = mm ? pasta('MAPA CIRURGICO').then(function (r0) { return pasta(mm[1], r0); }).then(function (r1) { return pasta('fotos ' + mm[1] + '-' + mm[2], r1); }) : pasta(pid, pf);
            return destino.then(function (pp) { return criarArquivo(f.nome, pp, blob, 'image/jpeg', { pid: pid, tipo: f.tipo, lid: f.lid }); })
              .then(function (r) { f.driveId = r.id; n++; saveLocal(); });
          });
        })();
      });
    }).then(function () { return n; });
  }
  function esvaziarLixo() {
    var L = (S.lixo || []).slice(), lids = (S.lixoLid || []).slice();
    var p = Promise.resolve();
    lids.forEach(function (lid) { p = p.then(function () { return acharFoto(lid).then(function (id) { if (id) L.push(id); }); }); });
    return p.then(function () {
      return L.reduce(function (pr, id) { return pr.then(function () { return req(API + '/files/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) }).catch(function () {}); }); }, Promise.resolve());
    }).then(function () { S.lixo = []; S.lixoLid = []; });
  }
  var backupRodando = null;
  function backupDiario() {
    S.sync.backups = S.sync.backups || {};
    if (S.sync.backups[S.hoje]) return Promise.resolve();
    if (backupRodando) return backupRodando;
    backupRodando = sub('backups').then(function (pb) {
      // já existe backup de hoje no Drive (feito por este ou por outro aparelho)? então não cria outro
      return req(API + '/files?q=' + q("name contains 'backup-" + S.hoje + "' and '" + pb + "' in parents and trashed=false") + '&fields=files(id)&pageSize=1').then(function (r) { return r.json(); }).then(function (j) {
        if (j.files && j.files.length) return;
        var b = new Blob([JSON.stringify(backupObj())], { type: 'application/json' });
        return criarArquivo('backup-' + S.hoje + '-' + hhmm(new Date()).replace(':', 'h') + '.json', pb, b, 'application/json');
      });
    }).then(function () { S.sync.backups[S.hoje] = 1; backupRodando = null; }, function (e) { backupRodando = null; throw e; });
    return backupRodando;
  }
  /* retenção dos backups no Drive (1x por dia): últimos 14 dias = o mais recente de cada dia; mais antigos = o mais recente de cada mês.
     Os demais vão para a LIXEIRA do Drive (recuperáveis por 30 dias), nunca apagados direto. */
  function limparBackups() {
    S.sync = S.sync || {};
    if (S.sync.limpBk === S.hoje) return Promise.resolve(0);
    return sub('backups').then(function (pb) { return listar(pb); }).then(function (L) {
      var lim = new Date(new Date(S.hoje + 'T12:00:00').getTime() - 14 * 864e5).toISOString().slice(0, 10), fica = {}, fora = [];
      L.filter(function (f) { return /^backup-\d{4}-\d{2}-\d{2}/.test(f.name || ''); })
        .sort(function (a, b) { return a.name < b.name ? 1 : a.name > b.name ? -1 : (String(b.modifiedTime) > String(a.modifiedTime) ? 1 : -1); })
        .forEach(function (f) {
          var d = f.name.slice(7, 17), k = d >= lim ? d : d.slice(0, 7);   // um por dia (recente) ou um por mês (antigo)
          if (fica[k]) fora.push(f); else fica[k] = f;
        });
      fora = fora.slice(0, 60);   // aos poucos, para não pesar
      return fora.reduce(function (pr, f) { return pr.then(function () { return req(API + '/files/' + f.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) }).catch(function () {}); }); }, Promise.resolve())
        .then(function () { S.sync.limpBk = S.hoje; return fora.length; });
    });
  }
  function backupObj() {
    var o = {}; ['hoje', 'pacientes', 'vis', 'pend', 'pendDel', 'evo', 'fotos', 'conf', 'fonte', 'dataIG', 'cab', 'idents', 'dihConv', 'igHist', 'vistoEm', 'altaEm', 'ultimos', 'apagados', 'rasc'].forEach(function (k) { o[k] = S[k]; });
    o.geradoEm = new Date().toISOString(); o.por = S.eu || ''; return o;
  }
  function hhmm(d) { return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function desenharStatus() {
    var el = document.getElementById('sync'); if (!el) return;
    var ic = { ok: '☁︎', sync: '⟳', off: '📴', login: '🔑', erro: '⚠', local: '📱' }[st.estado] || '';
    var pend = contarPend().total;
    el.className = 'sync ' + st.estado + (st.estado === 'ok' && !pend ? ' quieto' : '');   // tudo certo: a linha some (o ícone da nuvem mostra o estado)
    el.innerHTML = ic + ' ' + esc(st.msg) + (pend ? ' · <b>' + pend + ' aguardando envio</b>' : '');
  }

  window.addEventListener('online', function () { agendar(); });
  window.addEventListener('offline', function () { estado('off', 'sem internet — tudo salvo no aparelho'); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) agendar(); });
  setInterval(function () { if (!document.hidden) agora(); }, 30000);
  window.addEventListener('load', function () { setTimeout(function () { initGIS(); agora(); }, 800); });

  function sair() {
    var tk = token;
    token = null; tokenExp = 0; tokScope = '';
    try { localStorage.removeItem('sot-tk'); localStorage.removeItem('sot-logou'); sessionStorage.removeItem('sot-tk'); } catch (e) {}
    try { if (tk && window.google && google.accounts && google.accounts.oauth2) google.accounts.oauth2.revoke(tk, function () {}); } catch (e) {}
    estado('login', 'desconectado — toque para conectar ao Google');
  }
  /* ---------- Mapa cirúrgico: pasta "MAPA CIRURGICO" no Drive da equipe ---------- */
  function mapaArquivo(iso) {
    return pasta('MAPA CIRURGICO').then(function (raizM) { return pasta(iso.slice(0, 7), raizM); }).then(function (pid) {
      return req(API + '/files?q=' + q("name='mapa-" + iso + ".json' and '" + pid + "' in parents and trashed=false") + '&fields=files(id,modifiedTime)').then(function (r) { return r.json(); }).then(function (j) { return { pai: pid, f: maisNovo(j) || (idsArq['mapa' + iso] ? { id: idsArq['mapa' + iso] } : null) }; });
    });
  }
  function mapaBaixar(iso) { return mapaArquivo(iso).then(function (o) { return o.f ? baixarJSON(o.f.id) : null; }); }
  // mapas dos dias vizinhos (±n dias) que existem no Drive: [{iso, id, mod}] — só procura, não cria pastas
  function mapaVizinhos(iso, n) {
    var t0 = new Date(iso + 'T12:00:00').getTime(), meses = {}, ini = new Date(t0 - n * 864e5).toISOString().slice(0, 10), fim = new Date(t0 + n * 864e5).toISOString().slice(0, 10);
    [ini, iso, fim].forEach(function (d) { meses[d.slice(0, 7)] = 1; });
    return Promise.all(Object.keys(meses).map(function (mes) {
      return req(API + '/files?q=' + q("name contains 'mapa-" + mes + "-' and mimeType='application/json' and trashed=false") + '&fields=files(id,name,modifiedTime)&pageSize=100').then(function (r) { return r.json(); }).then(function (j) { return j.files || []; });
    })).then(function (ls) {
      var out = [], vistos = {};
      [].concat.apply([], ls).forEach(function (f) { var m = /^mapa-(\d{4}-\d{2}-\d{2})\.json$/.exec(f.name || ''); if (!m || m[1] === iso || m[1] < ini || m[1] > fim || vistos[m[1]]) return; vistos[m[1]] = 1; out.push({ iso: m[1], id: f.id, mod: f.modifiedTime }); });
      return out;
    });
  }
  /* ---------- AMB Internação: uma ficha por prontuário em "AMB INTERNACAO" (Drive da equipe) ---------- */
  function ambPasta() { return pasta('AMB INTERNACAO'); }
  var idsArq = {}, fila = {};
  function enfileirar(k, fn) { var p = (fila[k] || Promise.resolve()).catch(function () {}).then(fn); fila[k] = p; return p; }
  function maisNovo(j) { var L = (j.files || []).slice().sort(function (a, b) { return String(b.modifiedTime).localeCompare(String(a.modifiedTime)); }); return L[0] || null; }
  function salvarPorNome(chave, pid, nome, obj, achar) {
    var b = new Blob([JSON.stringify(obj)], { type: 'application/json' });
    return enfileirar(chave, function () {
      return achar().then(function (o) {
        var f = o.f || (idsArq[chave] ? { id: idsArq[chave] } : null);     // o índice do Drive demora a ver arquivo novo: usa o id já conhecido
        if (f) { idsArq[chave] = f.id; return atualizarArquivo(f.id, b, 'application/json'); }
        return criarArquivo(nome, o.pai, b, 'application/json').then(function (r) { if (r && r.id) idsArq[chave] = r.id; return r; });
      });
    });
  }
  // histórico do internograma (quem estava em cada dia), comum a todos os aparelhos
  function igHistArquivo() {
    return raiz().then(function (pid) {
      return req(API + '/files?q=' + q("name='internograma-hist.json' and '" + pid + "' in parents and trashed=false") + '&fields=files(id,modifiedTime)').then(function (r) { return r.json(); }).then(function (j) { return { pai: pid, f: maisNovo(j) || (idsArq.ighist ? { id: idsArq.ighist } : null) }; });
    });
  }
  function igHistTrocar(juntar) {   // baixa, junta com o local (juntar devolve {obj, mudou}) e regrava
    var mudou = false;
    return enfileirar('ighist', function () {
      return igHistArquivo().then(function (o) {
        return (o.f ? baixarJSON(o.f.id) : Promise.resolve(null)).then(function (rem) {
          var r = juntar(rem); mudou = r.mudou;
          var b = new Blob([JSON.stringify(r.obj)], { type: 'application/json' });
          if (o.f) { idsArq.ighist = o.f.id; return atualizarArquivo(o.f.id, b, 'application/json'); }
          return criarArquivo('internograma-hist.json', o.pai, b, 'application/json').then(function (x) { if (x && x.id) idsArq.ighist = x.id; });
        });
      });
    }).then(function () { return mudou; });
  }
  // v86: moldes do evoluidor (um arquivo moldes.json para a equipe; junta pelo id, vale a mudança mais nova)
  function moldesArquivo() {
    return raiz().then(function (pid) {
      return req(API + '/files?q=' + q("name='moldes.json' and '" + pid + "' in parents and trashed=false") + '&fields=files(id,modifiedTime)').then(function (r) { return r.json(); }).then(function (j) { return { pai: pid, f: maisNovo(j) || (idsArq.moldes ? { id: idsArq.moldes } : null) }; });
    });
  }
  function moldesTrocar(juntar) {   // baixa, junta com o do aparelho (juntar devolve {obj, mudou}) e regrava se mudou
    var res = null;
    return enfileirar('moldes', function () {
      return moldesArquivo().then(function (o) {
        return (o.f ? baixarJSON(o.f.id) : Promise.resolve(null)).then(function (rem) {
          var r = juntar(rem); res = r.obj;
          if (!r.mudou || (!o.f && !(r.obj && r.obj.length))) return;   // nada novo: não envia nada
          var b = new Blob([JSON.stringify(r.obj)], { type: 'application/json' });
          if (o.f) { idsArq.moldes = o.f.id; return atualizarArquivo(o.f.id, b, 'application/json'); }
          return criarArquivo('moldes.json', o.pai, b, 'application/json').then(function (x) { if (x && x.id) idsArq.moldes = x.id; });
        });
      });
    }).then(function () { return res; });
  }
  // mapa das caixinhas de cada folha de visita impressa (para ler a foto em qualquer aparelho)
  function folhaArquivo(id) {
    return sub('folhas').then(function (pid) {
      return req(API + '/files?q=' + q("name='folha-" + id + ".json' and trashed=false") + '&fields=files(id,modifiedTime)&pageSize=5').then(function (r) { return r.json(); }).then(function (j) { return { pai: pid, f: maisNovo(j) || (idsArq['folha' + id] ? { id: idsArq['folha' + id] } : null) }; });
    });
  }
  function folhaSalvar(id, obj) { return salvarPorNome('folha' + id, null, 'folha-' + id + '.json', obj, function () { return folhaArquivo(id); }); }
  function folhaBaixar(id) { return folhaArquivo(id).then(function (o) { return o.f ? baixarJSON(o.f.id) : null; }); }
  function ambArquivo(reg) {
    return ambPasta().then(function (pid) {   // procura em todo o Drive: acha a ficha mesmo que esteja numa pasta duplicada antiga
      return req(API + '/files?q=' + q("name='amb-" + reg + ".json' and trashed=false") + '&fields=files(id,modifiedTime)&pageSize=20').then(function (r) { return r.json(); }).then(function (j) { return { pai: pid, f: maisNovo(j) || (idsArq['amb' + reg] ? { id: idsArq['amb' + reg] } : null) }; });
    });
  }
  function ambBaixar(reg) { return ambArquivo(reg).then(function (o) { return o.f ? baixarJSON(o.f.id) : null; }); }
  function ambSalvar(reg, obj) { return salvarPorNome('amb' + reg, null, 'amb-' + reg + '.json', obj, function () { return ambArquivo(reg); }); }
  function mapaSalvar(iso, obj) { return salvarPorNome('mapa' + iso, null, 'mapa-' + iso + '.json', obj, function () { return mapaArquivo(iso); }); }
  return { moldesTrocar: moldesTrocar, copiarInternograma: copiarInternograma, docLer: docLer, docAlterar: docAlterar, folhaSalvar: folhaSalvar, folhaBaixar: folhaBaixar, igHistTrocar: igHistTrocar, ambBaixar: ambBaixar, ambSalvar: ambSalvar, mapaBaixar: mapaBaixar, mapaSalvar: mapaSalvar, mapaVizinhos: mapaVizinhos, baixarJSON: baixarJSON, temAgenda: temAgenda, pedirAgenda: pedirAgenda, calListar: calListar, calEventos: calEventos, sair: sair, acharFoto: acharFoto, agendar: agendar, agora: agora, conectar: conectar, exportarDoc: exportarDoc, baixarBlob: baixarBlob, backupObj: backupObj,
    status: function () { return st; }, _canon: canon, _arquivar: arquivar, lapides: lapides, apagadaPor: apagadaPor, _contido: contidoNaNuvem, temToken: temToken, configurado: configurado, contarPend: contarPend, _mesclar: mesclar, _mesclarVisita: mesclarVisita, _registro: registro, erro: function () { return ultimoErro; } };
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
  adicionar: function (pid, tipo, file, legenda, nomeArq) {
    return FOTO.reduzir(file).then(function (blob) {
      var p = S.pacientes.find(function (x) { return x.id === pid; }) || {};
      var agora = new Date(), lid = 'f' + agora.getTime() + Math.random().toString(36).slice(2, 6);
      var carimbo = S.hoje + '_' + ('0' + agora.getHours()).slice(-2) + ('0' + agora.getMinutes()).slice(-2);
      var nome = [(p.leito || p.lugar || 'sem-leito'), (p.registro || ''), ({ rx: 'RX', rxpoi: 'RX-POI', pele: 'PELE', laudo: 'LAUDO', nota: 'NOTA' }[tipo] || 'FOTO'), carimbo, (legenda || '').replace(/[^\wÀ-ÿ -]/g, '').trim()].filter(Boolean).join('_').replace(/\s+/g, '-') + '.jpg';
      if (nomeArq) nome = (nomeArq + '_' + carimbo).replace(/[^\wÀ-ÿ -]/g, '').trim().replace(/\s+/g, '-') + '.jpg';
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
      if (!SYNC.temToken() || !navigator.onLine) return null;
      var id = f.driveId ? Promise.resolve(f.driveId) : SYNC.acharFoto(f.lid).then(function (x) { if (x) { f.driveId = x; saveLocal(); } return x; });
      return id.then(function (did) {
        if (!did) return null;
        return SYNC.baixarBlob(did).then(function (bl) { FDB.put(f.lid, bl); return (FOTO._c[f.lid] = URL.createObjectURL(bl)); });
      }).catch(function () { return null; });
    });
  }
};
