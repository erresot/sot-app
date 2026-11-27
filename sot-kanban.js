/* SOT — MINI-KANBAN DO PS (v88): um motor só para os cartões do quadro (guardar, mover, tirar, juntar, histórico).
   Decisões de 26/11/2026 (plano do Atendimento do PS):
   - Faixa "A atender" + 4 colunas: 'exames' (exames, medicação e reavaliação) · 'conduta' (conduta, procedimento ou CROSS)
     · 'ic' (interconsulta: outra equipe pediu para nós) · 'coluna' (aguardam o especialista de coluna).
   - Chave = prontuário: prontuário com cartão aberto não duplica.
   - Ordem na coluna: gravidade (cor da triagem do hospital) e depois o tempo de entrada.
   - "Parado há Xh": conta desde a última mudança; limites por coluna (exames 2 h, ou 1 h com medicação/reavaliação; conduta 1 h);
     interconsulta, coluna e REV SERIADA sem alarme.
   - 8h+ sem conduta final → "aguardando nossa decisão"; 24h+ no PS → "dar alta ou internar" (regra da diretoria).
   - O cartão só sai quando o médico tira (nada sai sozinho). Cartão tirado vira histórico por 21 dias ("atendimento anterior").
   Guardado primeiro no aparelho (localStorage 'sot-kanban-v1'); o app junta com o Drive (kanban.json) e todos os aparelhos
   veem o mesmo quadro. Junta pelo id: vale a mudança mais nova. Nome guardado já abreviado (Ana P.).
   Cartão: { id, reg, em, criado, nome, idade, cor, origem:'ps'|'ic'|'td', col, tags[], local, entrada(ms), mudou(ms),
             hist:[{em,txt}], aberto:{por,em}, fora(ms: tirado do quadro), desf, apagado }   */
(function (G) {
  'use strict';
  var CHAVE = 'sot-kanban-v1', DIAS_HIST = 21, MS_H = 3600e3, MS_D = 864e5;
  var COLS = [
    { k: 'atender', n: 'A atender' },
    { k: 'exames', n: 'Exames, medicação e reavaliação' },
    { k: 'conduta', n: 'Conduta, procedimento ou CROSS' },
    { k: 'ic', n: 'Interconsulta' },
    { k: 'coluna', n: 'Coluna' }
  ];
  var TAGS = {
    exames: ['RX', 'LAB', 'USG', 'TC', 'RX CONTROLE', 'MEDICAÇÃO', 'REAVALIAR APÓS', 'REV SERIADA'],
    conduta: ['PROCEDIMENTO', 'CROSS', 'INTERCONSULTA SOLICITADA'],
    ic: ['REV SERIADA'], coluna: ['REV SERIADA'], atender: []
  };
  // cores da triagem do hospital, da mais grave para a menos grave
  var CORES = [
    { k: 'vermelho', n: 'Vermelho', d: 'Emergência', hex: '#d32f2f' },
    { k: 'laranja', n: 'Laranja', d: 'Muito urgente', hex: '#ef6c00' },
    { k: 'amarelo', n: 'Amarelo', d: 'Urgente', hex: '#f9a825' },
    { k: 'verde', n: 'Verde', d: 'Pouco urgente', hex: '#2e7d32' },
    { k: 'azul', n: 'Azul', d: 'Não urgente', hex: '#1565c0' }
  ];
  var LOCAIS = ['Recepção', 'Espera/corredor', 'Sala amarela', 'Sala vermelha', 'Sala de gesso'];
  var ORIGENS = [{ k: 'ps', n: 'PS' }, { k: 'ic', n: 'Interconsulta' }, { k: 'td', n: 'Tomada de decisão' }];

  function agora() { return Date.now(); }
  function ler() { try { var L = JSON.parse(localStorage.getItem(CHAVE) || '[]'); return Array.isArray(L) ? L : []; } catch (e) { return []; } }
  function gravar(L) { try { localStorage.setItem(CHAVE, JSON.stringify(L)); } catch (e) {} }
  function avisar() { try { (window.top || window.parent).postMessage({ src: 'kanban', type: 'kanban-sinc' }, '*'); } catch (e) {} }
  function soDig(s) { return String(s || '').replace(/\D/g, ''); }
  // nome abreviado: primeiro nome + inicial do último ("Ana Paula Souza" → "Ana S.")
  function abreviar(nome) {
    var p = String(nome || '').trim().split(/\s+/).filter(function (x) { return x && !/^(d[aeo]s?|e)$/i.test(x); });
    if (!p.length) return '';
    var cap = function (w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); };
    if (p.length === 1) return cap(p[0]);
    if (/\.$/.test(p[p.length - 1]) && p.length === 2) return cap(p[0]) + ' ' + p[1].charAt(0).toUpperCase() + '.';
    return cap(p[0]) + ' ' + p[p.length - 1].charAt(0).toUpperCase() + '.';
  }
  // tira o que passou do prazo: histórico (cartão tirado) com mais de 21 dias; lápide com mais de 30
  function limpar(L, t) {
    t = t || agora();
    return (L || []).filter(function (x) {
      if (!x || !x.id) return false;
      if (x.apagado) return t - (x.em || 0) < 30 * MS_D;
      if (x.fora) return t - x.fora < DIAS_HIST * MS_D;
      return true;
    });
  }
  function juntar(a, b) {
    var M = {};
    [].concat(a || [], b || []).forEach(function (x) { if (!x || !x.id) return; var y = M[x.id]; if (!y || (x.em || 0) > (y.em || 0)) M[x.id] = x; });
    return limpar(Object.keys(M).map(function (k) { return M[k]; }));
  }
  function abertos(L) { return limpar(L || ler()).filter(function (x) { return !x.apagado && !x.fora; }); }
  function historico(L) { return limpar(L || ler()).filter(function (x) { return !x.apagado && x.fora; }); }
  function doReg(reg, L) { reg = soDig(reg); return abertos(L).filter(function (x) { return x.reg === reg; })[0] || null; }
  // atendimento anterior: último cartão tirado do mesmo prontuário (até 21 dias)
  function anterior(reg, L) {
    reg = soDig(reg); var h = historico(L).filter(function (x) { return x.reg === reg; }).sort(function (a, b) { return b.fora - a.fora; });
    return h[0] || null;
  }
  function mudar(id, fn) {
    var L = ler(), x = L.filter(function (y) { return y.id === id; })[0]; if (!x) return null;
    var n = JSON.parse(JSON.stringify(x)), t = agora(); fn(n, t); n.em = Math.max(t, (x.em || 0) + 1);
    gravar(juntar(L, [n])); avisar(); return n;
  }
  // cria um cartão; devolve {ok, cartao} ou {ok:false, motivo:'dup', cartao: o aberto}
  function criar(c) {
    var reg = soDig(c.reg); if (!reg) return { ok: false, motivo: 'reg' };
    var L = ler(), ja = doReg(reg, L); if (ja) return { ok: false, motivo: 'dup', cartao: ja };
    var t = agora(), col = COLS.some(function (k) { return k.k === c.col; }) ? c.col : 'atender';
    var x = { id: 'k' + reg + '-' + t.toString(36), reg: reg, em: t, criado: t, nome: abreviar(c.nome), idade: String(c.idade || '').replace(/\D/g, '').slice(0, 3),
      cor: c.cor || '', origem: c.origem || 'ps', col: col, tags: (c.tags || []).slice(), local: c.local || '',
      entrada: c.entrada || t, mudou: t, hist: c.hist || [], ant: null, faa: String(c.faa || '').replace(/\D/g, '') };
    var a = anterior(reg, L); if (a) x.ant = { fora: a.fora, desf: a.desf || '', seg: a.seg || '' };
    gravar(juntar(L, [x])); avisar(); return { ok: true, cartao: x };
  }
  function mover(id, col) { return mudar(id, function (x, t) { if (x.col !== col) { x.col = col; x.mudou = t; x.tags = (x.tags || []).filter(function (g) { return (TAGS[col] || []).indexOf(g) >= 0; }); } }); }
  function tag(id, g) { return mudar(id, function (x, t) { var L = x.tags || [], i = L.indexOf(g); if (i >= 0) L.splice(i, 1); else L.push(g); x.tags = L; x.mudou = t; }); }
  function campo(id, k, v) { return mudar(id, function (x) { x[k] = k === 'nome' ? abreviar(v) : v; }); }
  function nota(id, txt, col) { return mudar(id, function (x, t) { (x.hist = x.hist || []).push({ em: t, txt: String(txt || '').slice(0, 2000) }); x.mudou = t; if (col) x.col = col; }); }
  function abrir(id, por) { return mudar(id, function (x, t) { x.aberto = { por: por || '', em: t }; }); }
  function tirar(id, desf) { return mudar(id, function (x, t) { x.fora = t; x.desf = desf || ''; x.hist = (x.hist || []).slice(-3); }); }
  function apagar(id) { var L = ler(), x = L.filter(function (y) { return y.id === id; })[0]; if (!x) return false; gravar(juntar(L, [{ id: id, em: agora() + 1, apagado: true }])); avisar(); return true; }
  function corRank(k) { for (var i = 0; i < CORES.length; i++) if (CORES[i].k === k) return i; return CORES.length; }
  function ordenar(L) { return L.slice().sort(function (a, b) { return corRank(a.cor) - corRank(b.cor) || (a.entrada || 0) - (b.entrada || 0); }); }
  // limite de "parado" em horas (null = sem alarme)
  function limite(x) {
    var T = x.tags || [];
    if (T.indexOf('REV SERIADA') >= 0) return null;
    if (x.col === 'exames') return (T.indexOf('MEDICAÇÃO') >= 0 || T.indexOf('REAVALIAR APÓS') >= 0) ? 1 : 2;
    if (x.col === 'conduta') return 1;
    return null;
  }
  // avisos do cartão: [{k, txt}] — parado, 8h+, 24h+
  function avisos(x, t) {
    t = t || agora(); var A = [], noPS = (t - (x.entrada || t)) / MS_H, par = (t - (x.mudou || x.criado || t)) / MS_H, lim = limite(x);
    if (noPS >= 24) A.push({ k: '24h', txt: '24h+ · dar alta ou internar' });
    else if (noPS >= 8) A.push({ k: '8h', txt: '8h+ · aguardando nossa decisão' });
    if (lim != null && par >= lim) A.push({ k: 'parado', txt: 'parado há ' + horas(t - (x.mudou || x.criado)) });
    return A;
  }
  function horas(ms) { var m = Math.max(0, Math.floor(ms / 60000)); return m < 60 ? m + ' min' : Math.floor(m / 60) + 'h' + (m % 60 ? String(m % 60).padStart(2, '0') : ''); }
  /* ---- etapa 2 (v88): a ficha do Atendimento move o cartão ----
     registrarFicha({reg, nome, idade, momento: texto copiado agora, toda: ficha inteira (anteriores + agora)})
     → coluna e etiquetas pela conduta (SOTFICHA.coluna / pendencias); ficha final (tem ASS) tira do quadro com o desfecho.
     Devolve {acao:'criado'|'movido'|'fechado'|'nada', cartao}. */
  var MAPA_COL = { aguarda: 'exames', cond: 'conduta', coluna: 'coluna', ic: 'ic' };
  function desfecho(conduta) {
    var u = String((conduta || []).join('\n')).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
    if (/VAGA LIBERADA VIA CROSS|TRANSFERENCIA/.test(u)) return 'Transferência';
    if (/AOS CUIDADOS DA EQUIPE|DEVOLVO PACIENTE/.test(u)) return 'Outra equipe';
    if (/INTERNACAO HOSPITALAR/.test(u)) return 'Internação';
    if (/AGENDADO PARA/.test(u)) return 'Cirurgia eletiva';
    if (/RETORNO/.test(u)) return 'Retorno';
    return 'Alta';
  }
  function registrarFicha(o) {
    var SF = G.SOTFICHA; if (!SF) return { acao: 'nada' };
    var reg = soDig(o.reg); if (!reg) return { acao: 'nada', motivo: 'reg' };
    var F = SF.ler(o.toda || o.momento || ''), M = F.momentos, ult = M[M.length - 1]; if (!ult) return { acao: 'nada' };
    var colF = SF.coluna(F), col = MAPA_COL[colF] || 'conduta', P = SF.pendencias(ult).filter(function (g) { return (TAGS[col] || []).indexOf(g) >= 0; });
    var txt = String(o.momento || '').slice(0, 8000), c = doReg(reg);
    if (!c) {
      if (F.final) return { acao: 'nada', motivo: 'final' };   // atendimento num tempo só: nada a acompanhar
      var r = criar({ reg: reg, nome: o.nome, idade: o.idade, origem: F.tipo === 'ic' ? 'ic' : 'ps', col: col, tags: P, hist: [{ em: agora(), txt: txt, f: 1 }] });
      return r.ok ? { acao: 'criado', cartao: r.cartao } : { acao: 'nada', motivo: r.motivo };
    }
    if (F.final) {
      var d = desfecho(ult.conduta);
      mudar(c.id, function (x, t) { (x.hist = x.hist || []).push({ em: t, txt: txt, f: 1 }); });
      return { acao: 'fechado', cartao: tirar(c.id, d) };
    }
    var n = mudar(c.id, function (x, t) {
      x.col = col; x.tags = P; x.mudou = t; (x.hist = x.hist || []).push({ em: t, txt: txt, f: 1 });
      if (o.nome && !x.nome) x.nome = abreviar(o.nome); if (o.idade && !x.idade) x.idade = String(o.idade).replace(/\D/g, '').slice(0, 3);
    });
    return { acao: 'movido', cartao: n };
  }
  // ficha toda do cartão (para "Continuar"): as fichas copiadas, na ordem
  function fichaDoCartao(x) { return (x && x.hist || []).filter(function (h) { return h.f; }).map(function (h) { return h.txt; }).join('\n\n'); }
  /* ---- etapa 3 (v88): print do kanban do hospital ----
     acharCartoes(img {data,width,height}) → [{x,y,w,h,cor}] : cartões pela cor de fundo (cor da triagem), sem ícones nem barras.
     lerTextoCartao(texto do leitor) → {nome, reg, faa, entrada(ms), entradaTxt} : "NOME / P: 123 / FAA: 456 / ENTRADA: dd/mm/aaaa hh:mm". */
  function corPixel(r, g, b) {
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), v = mx / 255, sat = mx ? (mx - mn) / mx : 0;
    if (sat < 0.45 || v < 0.28) return '';
    var h, d = mx - mn;
    if (mx === r) h = 60 * (((g - b) / d) % 6); else if (mx === g) h = 60 * ((b - r) / d + 2); else h = 60 * ((r - g) / d + 4);
    if (h < 0) h += 360;
    if (h < 14 || h >= 340) return 'vermelho';
    if (h < 38) return 'laranja';
    if (h < 68) return 'amarelo';
    if (h < 170) return 'verde';
    if (h < 265) return 'azul';
    return '';
  }
  function acharCartoes(img, opt) {
    opt = opt || {};
    var W = img.width, H = img.height, D = img.data, C = opt.celula || 6, gw = Math.floor(W / C), gh = Math.floor(H / C);
    var lab = new Array(gw * gh), i, x, y;
    for (y = 0; y < gh; y++) for (x = 0; x < gw; x++) {
      var cont = {}, best = '', bn = 0;
      for (var yy = 0; yy < C; yy += 2) for (var xx = 0; xx < C; xx += 2) {
        var o = ((y * C + yy) * W + x * C + xx) * 4, k = corPixel(D[o], D[o + 1], D[o + 2]);
        if (k) { cont[k] = (cont[k] || 0) + 1; if (cont[k] > bn) { bn = cont[k]; best = k; } }
      }
      lab[y * gw + x] = bn >= (C / 2) * (C / 2) * 0.4 ? best : '';
    }
    var vis = new Uint8Array(gw * gh), out = [];
    for (i = 0; i < gw * gh; i++) {
      if (!lab[i] || vis[i]) continue;
      var k2 = lab[i], pilha = [i], x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0; vis[i] = 1;
      while (pilha.length) {
        var c = pilha.pop(), cx = c % gw, cy = (c / gw) | 0; n++;
        if (cx < x0) x0 = cx; if (cx > x1) x1 = cx; if (cy < y0) y0 = cy; if (cy > y1) y1 = cy;
        [c - 1, c + 1, c - gw, c + gw].forEach(function (z) { if (z < 0 || z >= gw * gh || vis[z] || lab[z] !== k2) return; if ((z === c - 1 && cx === 0) || (z === c + 1 && cx === gw - 1)) return; vis[z] = 1; pilha.push(z); });
      }
      var bw = (x1 - x0 + 1) * C, bh = (y1 - y0 + 1) * C, area = (x1 - x0 + 1) * (y1 - y0 + 1);
      // cartão: grande o bastante para 4–5 linhas de texto e preenchido (não é ícone nem barra fina)
      if (bw >= (opt.minL || 140) && bh >= (opt.minA || 70) && n / area > 0.6 && bw / bh < 4.5 && bh / bw < 2.5) out.push({ x: x0 * C, y: y0 * C, w: bw, h: bh, cor: k2 });
    }
    return out.sort(function (a, b) { return Math.abs(a.y - b.y) > 20 ? a.y - b.y : a.x - b.x; });
  }
  function dig(s) { return String(s || '').replace(/[Oo]/g, '0').replace(/[Il|]/g, '1').replace(/[Ss]/g, '5').replace(/\D/g, ''); }
  function lerTextoCartao(txt) {
    var L = String(txt || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean), o = { nome: '', reg: '', faa: '', entrada: null, entradaTxt: '' };
    var iP = -1;
    L.forEach(function (l, i) {
      var u = l.toUpperCase(), m;
      if (!o.reg && (m = u.match(/^\W*P\s*[:;.]\s*([0-9OIlS|]{4,9})/))) { o.reg = dig(m[1]); if (iP < 0) iP = i; }
      else if (!o.faa && (m = u.match(/F\s*A\s*A\s*[:;.]?\s*([0-9OIlS|]{5,10})/))) o.faa = dig(m[1]);
      else if (!o.entrada && (m = u.match(/ENTRADA\s*[:;.]?\s*([0-9OI]{1,2})\s*\/\s*([0-9OI]{1,2})\s*\/\s*([0-9OI]{4})\s*([0-9OI]{1,2})\s*[:.]\s*([0-9OI]{2})/))) {
        var d = +dig(m[1]), mo = +dig(m[2]), a = +dig(m[3]), hh = +dig(m[4]), mi = +dig(m[5]);
        if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12 && hh < 24 && mi < 60) { o.entrada = new Date(a, mo - 1, d, hh, mi).getTime(); o.entradaTxt = String(d).padStart(2, '0') + '/' + String(mo).padStart(2, '0') + '/' + a + ' ' + String(hh).padStart(2, '0') + ':' + String(mi).padStart(2, '0'); }
      }
    });
    // nome: a linha de letras logo antes do "P:" (o cronômetro e os ícones ficam fora do recorte)
    for (var j = (iP >= 0 ? iP : L.length) - 1; j >= 0; j--) {
      var t = L[j].replace(/[^A-Za-zÀ-ÿ' ]/g, ' ').replace(/\s+/g, ' ').trim();
      if (t.replace(/ /g, '').length >= 5 && !/ENTRADA|EMERG|URG|ORTOPEDIA|FAA/i.test(t)) { o.nome = t; break; }
    }
    return o;
  }
  function aparelho() {
    try { var d = localStorage.getItem('sot-aparelho'); if (!d) { d = 'A' + Math.random().toString(36).slice(2, 6).toUpperCase(); localStorage.setItem('sot-aparelho', d); } return d; } catch (e) { return ''; }
  }
  G.SOTKANBAN = { CHAVE: CHAVE, COLS: COLS, TAGS: TAGS, CORES: CORES, LOCAIS: LOCAIS, ORIGENS: ORIGENS, DIAS_HIST: DIAS_HIST,
    ler: ler, gravar: gravar, juntar: juntar, limpar: limpar, abertos: abertos, historico: historico, doReg: doReg, anterior: anterior,
    criar: criar, mover: mover, tag: tag, campo: campo, nota: nota, abrir: abrir, tirar: tirar, apagar: apagar,
    registrarFicha: registrarFicha, acharCartoes: acharCartoes, lerTextoCartao: lerTextoCartao, corPixel: corPixel, fichaDoCartao: fichaDoCartao, desfecho: desfecho,
    ordenar: ordenar, limite: limite, avisos: avisos, horas: horas, abreviar: abreviar, aparelho: aparelho, corRank: corRank };
  if (typeof module !== 'undefined' && module.exports) module.exports = G.SOTKANBAN;
})(typeof window !== 'undefined' ? window : globalThis);
