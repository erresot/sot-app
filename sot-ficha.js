/* SOT — MOTOR DA FICHA DO PS: um motor só para ESCREVER e LER a ficha do pronto-socorro em blocos.
   Usado (quando o plano for liberado) por: Atendimento (Anamnese + Exame + Conduta), Condutas, "Continuar atendimento",
   mini-kanban, Novo Paciente, AMB Internação e evoluidor.

   Padrão da ficha (combinado em 26/11/2026):
     1º momento                         em tempo (evolução nova)
     # PS ORTOPEDIA #                   # EM TEMPO #
     # HMA                              <resultados: RADIOGRAFIAS … / TC … / LABS dd/mm/aaaa: …>
     …                                  ---
     ---                                AO REAVALIAR, PACIENTE REFERE …
     # AP                               # EF            (só se mudou)
     CMB: … / MUC: … / ALERGIAS: …      …
     ---                                ---
     # EF                               REALIZADO:
     …                                  - …
     ---                                ---
     RX EXTERNO dd/mm/aaaa: …           # CONDUTA
     ---                                DISCUTIDO E ORIENTADO POR DR X EM dd/mm/aaaa   (quando houve)
     REALIZADO:                         - …
     - …
     ---                                ASS DR X        (só na conduta final)
     # CONDUTA
     - …

   API:
     SOTFICHA.escrever(m, opc)  → texto de UM momento.
        m = { emTempo, tipo:'ps'|'ic', hma, ap (texto ou [linhas] ou {cmb,muc,alergia,outros:[…]}), ef,
              resultados:[linhas], reavaliacao, realizado:[linhas], conduta:[linhas],
              discutido:{tit,nome,data}, ass:{tit,nome} }
        opc = { hifen:true }  (marcador "- " nas linhas de REALIZADO e CONDUTA)
     SOTFICHA.ler(texto)        → { momentos:[…], tipo, final, ass, discutido }
        cada momento tem os mesmos campos de m (+ outros:[linhas sem bloco], apCampos quando campos.js está carregado).
        Lê também o formato antigo: "#CONDUTA", "CD:", anamnese sem "# HMA", "EXAME FÍSICO ORTOPÉDICO",
        "DISCUTIDO COM DR X EM …", "CD DISCUTIDA E ORIENTADA PELO ASS DR X".
     SOTFICHA.pendencias(m)     → etiquetas do que o paciente aguarda (mini-kanban), lidas da CONDUTA de um momento
        que não fecha a ficha: RX · LAB · USG · TC · RX CONTROLE · MEDICAÇÃO · REAVALIAR APÓS · REV SERIADA ·
        INTERCONSULTA SOLICITADA · CROSS · COLUNA.
     SOTFICHA.coluna(ficha)     → coluna sugerida do mini-kanban para o último momento:
        'ic' (pediram interconsulta para nós) · 'coluna' · 'cond' · 'aguarda' · null (ficha fechada).
   Nada aqui inventa texto clínico: o motor só arruma e reconhece blocos. */
(function (G) {
  'use strict';
  var A = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase(); };
  var CAB = { ps: '# PS ORTOPEDIA #', ic: '# INTERCONSULTA ORTOPEDIA #', et: '# EM TEMPO #' };
  var SEP = '---';

  /* ---------- escrever ---------- */
  function linhas(v) {
    if (v == null) return [];
    if (Array.isArray(v)) return v.map(function (x) { return String(x == null ? '' : x).trim(); }).filter(Boolean);
    return String(v).replace(/\r/g, '').split('\n').map(function (x) { return x.replace(/\s+$/, ''); })
      .join('\n').replace(/^\n+|\n+$/g, '').split('\n').filter(function (x, i, a) { return x || (a[i - 1] && a[i + 1]); });
  }
  function apLinhas(ap) {
    if (!ap) return [];
    if (typeof ap === 'object' && !Array.isArray(ap)) {
      var L = [];
      if (ap.cmb) L.push('CMB: ' + ap.cmb);
      if (ap.muc) L.push('MUC: ' + ap.muc);
      if (ap.alergia) L.push('ALERGIAS: ' + ap.alergia);
      return L.concat(linhas(ap.outros));
    }
    return linhas(ap);
  }
  function semMarca(l) { return String(l).replace(/^\s*[-–—•·]\s+/, ''); }
  function marca(l, hifen) { l = semMarca(l); return hifen ? '- ' + l : l; }
  function efLinhas(ef) {   // o título do Exame Físico vira o bloco "# EF"
    var L = linhas(ef);
    while (L.length && /^EXAME FISICO( ORTOPEDICO)?:?$/.test(A(L[0]).trim())) L.shift();
    while (L.length && !L[0].trim()) L.shift();
    return L;
  }
  function pessoa(p) { return (p && p.nome) ? ((p.tit || 'DR') + ' ' + String(p.nome).trim()).toUpperCase() : ''; }
  function escrever(m, opc) {
    m = m || {}; opc = opc || {};
    var hifen = opc.hifen !== false, B = [];
    var bloco = function (L) { L = L.filter(function (x) { return x != null; }); if (L.length) B.push(L.join('\n')); };
    var res = linhas(m.resultados);
    if (m.emTempo) {
      var et = [CAB.et].concat(res);
      B.push(et.join('\n'));
      var re = [];
      if (m.reavaliacao) re.push(String(m.reavaliacao).trim());
      var ef1 = efLinhas(m.ef);
      if (ef1.length) re.push('# EF'), re = re.concat(ef1);
      bloco(re);
    } else {
      var cab = [m.tipo === 'ic' ? CAB.ic : CAB.ps];
      var h = linhas(m.hma);
      if (h.length) cab.push('# HMA'), cab = cab.concat(h);
      B.push(cab.join('\n'));
      var ap = apLinhas(m.ap); if (ap.length) bloco(['# AP'].concat(ap));
      var ef = efLinhas(m.ef); if (ef.length) bloco(['# EF'].concat(ef));
      bloco(res);
    }
    var ou = linhas(m.outros); if (ou.length) bloco(ou);   // linhas sem bloco (formato antigo): nunca se perdem
    var rz = linhas(m.realizado); if (rz.length) bloco(['REALIZADO:'].concat(rz.map(function (l) { return marca(l, hifen); })));
    var cd = linhas(m.conduta), disc = m.discutido && m.discutido.nome ? 'DISCUTIDO E ORIENTADO POR ' + pessoa(m.discutido) + (m.discutido.data ? ' EM ' + m.discutido.data : '') : '';
    if (cd.length || disc) bloco(['# CONDUTA'].concat(disc ? [disc] : [], cd.map(function (l) { return marca(l, hifen); })));
    if (m.emTempo && !res.length && B.length > 1) B.splice(0, 2, B[0] + '\n' + B[1]);   // em tempo sem resultado: sem "---" logo abaixo do cabeçalho
    var txt = B.join('\n' + SEP + '\n');
    if (m.ass && m.ass.nome) txt += '\n\nASS ' + pessoa(m.ass);
    return txt;
  }

  /* ---------- ler ---------- */
  // cabeçalho de bloco → [campo, resto da linha]
  function cabecalho(l) {
    var u = A(l).trim(), m;
    if (/^#\s*PS ORTOPEDIA\s*#?$/.test(u)) return ['tipo:ps', ''];
    if (/^#\s*INTERCONSULTA ORTOPEDIA\s*#?$/.test(u)) return ['tipo:ic', ''];
    if (/^#\s*EM TEMPO\s*#?$/.test(u)) return ['emtempo', ''];
    if ((m = u.match(/^#\s*(HMA|HDA|HPMA)\b\s*:?\s*/)) || (m = u.match(/^(HMA|HDA)\s*:\s*/)) || (m = u.match(/^(HMA|HDA)$/))) return ['hma', l.trim().slice(m[0].length)];
    if ((m = u.match(/^#\s*AP\b\s*:?\s*/)) || (m = u.match(/^(AP|ANTECEDENTES(?: PESSOAIS)?)\s*:\s*/)) || (m = u.match(/^AP$/))) return ['ap', l.trim().slice(m[0].length)];
    if ((m = u.match(/^#\s*(EF|EXAME FISICO(?: ORTOPEDICO)?)\b\s*:?\s*/)) || (m = u.match(/^(EF|EXAME FISICO(?: ORTOPEDICO)?)\s*:\s*/)) || (m = u.match(/^(EF|EXAME FISICO(?: ORTOPEDICO)?)$/))) return ['ef', l.trim().slice(m[0].length)];
    if ((m = u.match(/^#?\s*REALIZADOS?\s*:\s*/)) || (m = u.match(/^#\s*REALIZADOS?$/))) return ['realizado', l.trim().slice(m[0].length)];
    if ((m = u.match(/^#\s*(CONDUTA|CD)\b\s*:?\s*/)) || (m = u.match(/^(CONDUTA|CD)\s*:\s*/)) || (m = u.match(/^(CONDUTA|CD)$/))) return ['conduta', l.trim().slice(m[0].length)];
    return null;
  }
  var RE_SEP = /^\s*(?:[-–—_=]{3,}|\*{3,})\s*$/;
  var RE_ASS = /^\s*ASS(?:\.|INADO)?\s*:?\s*(DRA?\.?)\s+(.+?)\s*$/i;
  var RE_DISC = [
    /^\s*(?:[-–—•·]\s+)?DISCUTIDO\s+E\s+ORIENTADO\s+(?:POR|COM)\s+(?:O\s+|A\s+)?(?:ASS\.?\s+)?(DRA?\.?)\s+(.+?)(?:\s+EM\s+(\d{2}\/\d{2}\/\d{4}))?\s*$/i,
    /^\s*(?:[-–—•·]\s+)?DISCUTIDO\s+COM\s+(?:O\s+|A\s+)?(?:ASS\.?\s+)?(DRA?\.?)\s+(.+?)(?:\s+EM\s+(\d{2}\/\d{2}\/\d{4}))?\s*$/i,
    /^\s*(?:[-–—•·]\s+)?CD\s+DISCUTIDA\s+E\s+ORIENTADA\s+(?:PEL[OA]\s+)?(?:ASS\.?\s+)?(DRA?\.?)\s+(.+?)(?:\s+EM\s+(\d{2}\/\d{2}\/\d{4}))?\s*$/i
  ];
  var RE_REAV = /^\s*(?:AO\s+REAVALIAR|REAVALIO\s+PACIENTE|PACIENTE\s+REFERE\s+MELHORA|PACIENTE\s+NEGA\s+MELHORA)/i;
  var RE_RESULT = /^\s*(?:RADIOGRAFIAS?|RX|TC|TOMOGRAFIA|USG|ULTRASSONOGRAFIA|RM|RESSONANCIA|LABS?|EXAMES?\s+LABORATORIAIS|ECG)\b/;
  function novoMomento(emTempo) {
    return { emTempo: !!emTempo, tipo: '', hma: [], ap: [], ef: [], resultados: [], reavaliacao: '', realizado: [], conduta: [], discutido: null, ass: null, outros: [] };
  }
  function pessoaDe(tit, nome) { return { tit: A(tit).replace(/\./g, ''), nome: String(nome).trim().toUpperCase() }; }
  function fecha(M) {
    ['hma', 'ef'].forEach(function (k) { M[k] = M[k].join('\n').replace(/^\n+|\n+$/g, ''); });
    M.ap = M.ap.filter(Boolean);
    ['realizado', 'conduta', 'resultados', 'outros'].forEach(function (k) { M[k] = M[k].map(semMarca).filter(function (x) { return x.trim(); }); });
    if (G.SOTCAMPOS && M.ap.length) M.apCampos = G.SOTCAMPOS.ap(M.ap.join('\n'));
    M.final = !!M.ass;
    return M;
  }
  function ler(texto) {
    var L = String(texto || '').replace(/\r/g, '').split('\n'), Ms = [], M = null, campo = null, tipo = '';
    function abre(et) { if (M) Ms.push(fecha(M)); M = novoMomento(et); campo = et ? 'resultados' : null; }
    function poe(k, v) {
      if (k === 'hma' || k === 'ef') M[k].push(v);
      else if (v.trim()) M[k].push(v.trim());
    }
    for (var i = 0; i < L.length; i++) {
      var l = L[i], u = A(l).trim(), c = cabecalho(l), m, j;
      if (c && c[0] === 'emtempo') { abre(true); continue; }
      if (!M) abre(false);
      if (c && c[0].indexOf('tipo:') === 0) { M.tipo = c[0].slice(5); if (!tipo) tipo = M.tipo; campo = 'hma0'; continue; }
      if (c) { campo = c[0]; if (c[1]) poe(campo, c[1]); continue; }
      if ((m = l.match(RE_ASS))) { M.ass = pessoaDe(m[1], m[2]); campo = null; continue; }
      var disc = null;
      for (j = 0; j < RE_DISC.length && !disc; j++) if ((m = l.match(RE_DISC[j]))) disc = { tit: A(m[1]).replace(/\./g, ''), nome: String(m[2]).trim().toUpperCase(), data: m[3] || '' };
      if (disc) { M.discutido = disc; if (campo !== 'conduta' && M.conduta.length === 0) campo = 'conduta'; continue; }
      if (RE_SEP.test(l)) { campo = null; continue; }
      if (!u) { if (campo === 'hma' || campo === 'hma0' || campo === 'ef') M[campo === 'hma0' ? 'hma' : campo].push(''); continue; }
      if (RE_REAV.test(u) && M.emTempo && !M.reavaliacao) { M.reavaliacao = l.trim(); campo = null; continue; }
      if (campo === 'hma0') { poe('hma', l); continue; }                       // anamnese antiga: texto logo abaixo do cabeçalho
      if (campo) { poe(campo, l); continue; }
      // linha solta depois de um separador
      if (RE_RESULT.test(u) || /\bEXTERN[OA]S?\b/.test(u)) { campo = 'resultados'; poe('resultados', l); continue; }
      if (/^\s*(CMB|MUC|ALERGI|COMORB|HV\b|INTERNAC)/.test(u)) { campo = 'ap'; poe('ap', l); continue; }
      poe('outros', l);
    }
    if (M) Ms.push(fecha(M));
    Ms = Ms.filter(function (x) { return x.emTempo || x.hma || x.ap.length || x.ef || x.resultados.length || x.realizado.length || x.conduta.length || x.outros.length || x.ass || x.tipo; });
    var ult = Ms[Ms.length - 1] || null, ass = null, disc = null;
    Ms.forEach(function (x) { if (x.ass) ass = x.ass; if (x.discutido) disc = x.discutido; });
    return { momentos: Ms, tipo: tipo || 'ps', final: !!(ult && ult.ass), ass: ass, discutido: disc };
  }

  /* ---------- pendências (etiquetas do mini-kanban) ---------- */
  function pendencias(m) {
    if (!m || m.ass) return [];
    var T = [], put = function (t) { if (T.indexOf(t) < 0) T.push(t); };
    (m.conduta || []).forEach(function (l) {
      var u = A(l);
      if (/\bSOLICIT|\bAGUARD|\bPEDID/.test(u)) {
        if (/RADIOGRAFIA|\bRX\b/.test(u)) put(/CONTROLE/.test(u) ? 'RX CONTROLE' : 'RX');
        if (/TOMOGRAFIA|\bTC\b/.test(u)) put('TC');
        if (/ULTRASS|\bUSG\b/.test(u)) put('USG');
        if (/LABORATORI|\bLABS?\b/.test(u)) put('LAB');
        if (/INTERCONSULTA/.test(u)) put('INTERCONSULTA SOLICITADA');
      }
      if (/ANALGESIA|MEDICACAO|\bAINES?\b/.test(u)) put('MEDICAÇÃO');
      if (/REAVALIACAO SERIADA/.test(u)) put('REV SERIADA');
      else if (/REAVALIAR APOS/.test(u)) put('REAVALIAR APÓS');
      if (/\bCROSS\b/.test(u)) put('CROSS');
      if (/MOVIMENTO EM BLOCO|MOV\.? EM BLOCO|COLAR CERVICAL|\bCOLUNA\b/.test(u)) put('COLUNA');
    });
    return T;
  }
  function coluna(ficha) {
    var Ms = ficha && ficha.momentos || [], ult = Ms[Ms.length - 1];
    if (!ult || ult.ass) return null;
    if (ficha.tipo === 'ic') return 'ic';
    var P = pendencias(ult);
    if (P.indexOf('COLUNA') >= 0) return 'coluna';
    if (P.indexOf('CROSS') >= 0 || P.indexOf('INTERCONSULTA SOLICITADA') >= 0) return 'cond';
    if (P.some(function (t) { return t !== 'COLUNA'; })) return 'aguarda';
    return 'cond';
  }

  /* ---------- regiões citadas no texto (chaves do Condutas) ---------- */
  var REGS = [['cervical', /COLUNA CERVICAL|\bCERVICAL\b/], ['toracica', /COLUNA TORACICA|\bTORACICA\b/], ['lombar', /COLUNA LOMBAR|\bLOMBAR\b/],
    ['pelve', /\bBACIA\b|\bPELVE\b/], ['ombro', /\bOMBRO\b|CLAVICULA|ESCAPULA/], ['braco', /\bBRACO\b|\bUMERO\b(?! PROXIMAL| DISTAL)/],
    ['cotovelo', /\bCOTOVELO\b/], ['antebraco', /\bANTEBRACO\b/], ['punho', /\bPUNHO\b|RADIO DISTAL/], ['mao', /\bMAO\b|\bDEDOS? DA MAO\b|METACARP|FALANGE/],
    ['quadril', /\bQUADRIL\b|FEMUR PROXIMAL|COLO DO FEMUR|TRANSTROCANT/], ['coxa', /\bCOXA\b|DIAFISE DO FEMUR/], ['joelho', /\bJOELHO\b|\bPATELA\b|PLATO TIBIAL/],
    ['perna', /\bPERNA\b|DIAFISE DA TIBIA/], ['tornozelo', /\bTORNOZELO\b|MALEOL/], ['pe', /\bPES?\b|\bHALUX\b|CALCANEO|METATARS/]];
  var LAT = { cervical: 0, toracica: 0, lombar: 0, pelve: 0 };
  function regioes(texto) {
    var R = [], u = A(texto);
    u.split(/\n|\.\s|;/).forEach(function (fr) {
      REGS.forEach(function (rg) {
        var m = fr.match(rg[1]); if (!m) return;
        var depois = fr.slice(m.index, m.index + m[0].length + 30), side = '';
        if (LAT[rg[0]] !== 0) { if (/DIREIT/.test(depois)) side = 'D'; else if (/ESQUERD/.test(depois)) side = 'E'; }
        if (!R.some(function (x) { return x.k === rg[0] && (x.side === side || !side); })) {
          R = R.filter(function (x) { return !(x.k === rg[0] && !x.side && side); });
          R.push({ k: rg[0], side: side });
        }
      });
    });
    return R;
  }

  /* ---------- molde do evoluidor (v86) ----------
     A ficha do PS vira a "evolução anterior" que o evoluidor lê: cabeçalho com eventos datados ("1D FRATURA … dd/mm/aaaa",
     o evoluidor conta os dias pela data), HMA, AP, parágrafo padrão (frases que o evoluidor reconhece e oferece opções),
     exame do segmento, o que foi feito no PS com data, radiografia, labs e a conduta copiada linha a linha. */
  // eventos: achado do RX ("COM evidências", traço, linha — "SEM evidências" não é evento) e o que foi feito (redução, gesso, sutura…)
  function eventos(ficha, hoje) {
    var Ms = ficha && ficha.momentos || [], E = [], vis = {};
    var poe = function (t) { t = String(t || '').replace(/\s+/g, ' ').replace(/[.;,\s]+$/, '').trim(); var k = A(t); if (t && !vis[k]) { vis[k] = 1; E.push({ t: t.toUpperCase(), data: hoje || '' }); } };
    Ms.forEach(function (m) { m.resultados.forEach(function (l) { var x = A(l).match(/(?:COM EVIDENCIAS NITIDAS|TRACO SUGESTIVO|LINHA SUGESTIVA) DE (.+)$/); if (x) poe(String(l).slice(String(l).length - x[1].length)); }); });
    Ms.forEach(function (m) { m.realizado.forEach(function (l) { if (/REDU[CÇ][AÃ]O|GESSO|TALA|TRA[CÇ][AÃ]O|SUTURA|DRENAGEM|ARTROCENTESE|PUN[CÇ][AÃ]O/i.test(l)) poe(String(l).split(/,|\. |\s(?:SOB|COM|POR|APÓS|APOS)\s/i)[0]); }); });
    return E;
  }
  function mecanismo(ficha) {
    var h = (ficha && ficha.momentos && ficha.momentos[0] && ficha.momentos[0].hma) || '';
    var m = A(h).match(/\b(QUEDA DA PROPRIA ALTURA|QUEDA DE [A-Z ]{3,30}?|ACIDENTE (?:DE|COM) [A-Z ]{3,30}?|ATROPELAMENTO|AGRESSAO|ENTORSE|TRAUMA (?:DIRETO|TORCIONAL)|COLISAO [A-Z ]{3,30}?)(?=[,.;]|\s+(?:HA|EM|NO|NA|DIA|EVOLUINDO|COM)\b|$)/);
    if (!m) return '';
    var ini = A(h).indexOf(m[1]); return String(h).slice(ini, ini + m[1].length).toUpperCase();
  }
  var PARAGRAFO = {
    enf: 'AVALIO PACIENTE EM LEITO DE ENFERMARIA, EM BOM ESTADO GERAL, LÚCIDO E ORIENTADO EM TEMPO E ESPAÇO, REFERE DOR LEVE, BOA ACEITAÇÃO DA DIETA E ELIMINAÇÕES PRESENTES. HEMODINAMICAMENTE ESTÁVEL.',
    amb: 'AVALIO PACIENTE EM AMB ORTOPEDIA, REFERE DOR LEVE COM MELHORA COMPLETA AO USO DE ANALGESIA, NEGA FEBRE, NEGA QUEIXAS EM DEMAIS SEGMENTOS.'
  };
  /* retorno no ambulatório (v86, revisto 27/11): relato e exame montados com as frases do catálogo do evoluidor
     (local, dor, orientações, cuidados com a imobilização, carga, curativo, antibiótico, anticoagulação), pelo que a ficha diz */
  var IMOB_RE = /\b(GESSO (?:AXILOPALMAR|ANTEBRAQUIOPALMAR|LUVA(?: COM INCLUS[AÃ]O DO POLEGAR)?|SUROPOD[AÁ]LICO|INGUINOPOD[AÁ]LICO|INGUINOMALEOLAR|PELVIPOD[AÁ]LICO|TIPO SARMIENTO)|BOTA GESSADA|TALA (?:AXILOPALMAR|ANTEBRAQUIOPALMAR|LUVA|SUROPOD[AÁ]LICA|INGUINOPOD[AÁ]LICA|INGUINOMALEOLAR|BOTA|DIGITAL|DE STACK|GESSADA)|PIN[CÇ]A DE CONFEITEIRO|BOTA IMOBILIZADORA|BRACE(?: ARTICULADO)?(?: DE JOELHO)?|TIPOIA(?: AMERICANA)?|VELPEAU|IMOBILIZADOR DE (?:OMBRO|JOELHO))/;
  function relatoAmb(Ms, ult) {
    var tudo = Ms.map(function (m) { return m.realizado.concat(m.conduta).join('\n'); }).join('\n'), cd = (ult.conduta || []).join('\n'), ua = A(cd);
    var imob = (tudo.match(IMOB_RE) || [])[1] || '', P = [];
    // local: o ambulatório do retorno ("EM AMBULATÓRIO ORTOPEDIA GESSO" → "AMB ORTOPEDIA GESSO")
    var amb = (cd.match(/AMBULAT[ÓO]RIO (?:DE )?ORTOPEDIA ((?:GESSO|CURATIVO|P[ÉE] E TORNOZELO|M[ÃA]O|OMBRO E COTOVELO|QUADRIL|JOELHO|COLUNA|PEDI[ÁA]TRICA|TUMOR|TRAUMA))\b/) || [])[1] || '';
    P.push('AVALIO PACIENTE EM AMB ORTOPEDIA' + (amb ? ' ' + amb : ''));
    var mmii = /SEM CARGA|CARGA (?:PARCIAL|TOTAL|PROPRIOCEPTIVA|CONFORME DOR)|SUROPOD|BOTA|INGUINO|PELVIPOD|JOELHO|TORNOZELO|\bP[ÉE]\b|QUADRIL|COXA|PERNA/.test(ua);
    if (mmii) P.push(/SEM CARGA/.test(ua) ? 'DEAMBULANDO EM USO DE MULETAS' : /ANDADOR/.test(ua) ? 'DEAMBULANDO EM USO DE ANDADOR' : 'DEAMBULANDO SEM AUXÍLIO');
    P.push('REFERE DOR LEVE COM MELHORA COMPLETA AO USO DE ANALGESIA');
    if (/FISIOTERAPIA/.test(ua)) P.push('EM REALIZAÇÃO DE FISIOTERAPIA CONFORME ORIENTADO');
    if (/ANTIBIOTICOTERAPIA|CEFALEXINA|AMOXICILINA|CLINDAMICINA|CIPROFLOXACINO|SULFAMETOXAZOL/.test(ua)) P.push('EM USO DE ANTIBIOTICOTERAPIA CONFORME ORIENTADO');
    if (/ANTICOAGULA|ENOXAPARINA|RIVAROXABANA|HEPARINA/.test(ua)) P.push('EM USO DE ANTICOAGULANTE CONFORME ORIENTADO');
    P.push('NEGA FEBRE');
    var cur = /SUTURA|PONTOS|CURATIVO|DRENAGEM|DESBRIDAMENTO/.test(A(tudo)), oper = /OSTEOSS[IÍ]NTESE|ARTROPLASTIA|ARTROSCOPIA|CIR[UÚ]RGIC|FIXADOR/.test(tudo);
    if (cur) { P.push('RELATA FERIDA' + (oper ? ' OPERATÓRIA' : '') + ' SECA DURANTE TROCAS DE CURATIVO'); P.push('REALIZANDO TROCA DE CURATIVO'); }
    if (/^GESSO|^BOTA GESSADA/.test(imob)) P.push('REFERE CUIDADO ADEQUADO COM O GESSO'); else if (/^TALA|PIN[CÇ]A/.test(imob)) P.push('REFERE CUIDADO ADEQUADO COM A TALA'); else if (imob) P.push('REFERE CUIDADO ADEQUADO COM A IMOBILIZAÇÃO');
    if (/\bSEM CARGA\b/.test(ua)) P.push('MANTENDO-SE SEM CARGA');
    else if (/CARGA PROPRIOCEPTIVA/.test(ua)) P.push('MANTENDO-SE COM CARGA PROPRIOCEPTIVA');
    else if (/CARGA PARCIAL/.test(ua)) P.push('MANTENDO-SE COM CARGA PARCIAL');
    else if (/CARGA CONFORME DOR/.test(ua)) P.push('MANTENDO-SE COM CARGA CONFORME DOR');
    else if (/CARGA TOTAL/.test(ua)) P.push('MANTENDO-SE COM CARGA TOTAL');
    if (mmii && imob) P.push('NEGA DOR EM PANTURRILHA');   // membro inferior imobilizado: vigiar TVP
    P.push('NEGA QUEIXAS EM DEMAIS SEGMENTOS');
    return { texto: P.join(', ') + '.', imob: imob, curativo: cur };
  }
  function exameAmb(ef, R) {   // segmento do exame do PS + estado da imobilização + perfusão e neurovascular
    var seg = (String(ef || '').split('\n').filter(Boolean)[0] || '').split(':')[0].trim() || '___', L = [];
    var partes = [];
    if (R.imob) partes.push('EM USO DE ' + R.imob, /^TALA|PIN[CÇ]A/.test(R.imob) ? 'TALA GESSADA BEM POSICIONADA' : /^GESSO|^BOTA GESSADA/.test(R.imob) ? 'GESSO ÍNTEGRO' : 'IMOBILIZAÇÃO ÍNTEGRA');
    partes.push('EDEMA LEVE');
    if (R.imob && /GESSO|TALA|PIN[CÇ]A|BOTA/.test(R.imob)) partes.push('MOBILIDADE DOS DEDOS PRESERVADA');
    partes.push('PERFUSÃO PERIFÉRICA PRESERVADA', 'NEUROVASCULAR PRESERVADO', 'TEC < 3 SEGUNDOS');
    L.push(seg + ': ' + partes.join(', '));
    if (R.curativo) L.push('FERIDA: PONTOS ÍNTEGROS SEM DEISCÊNCIAS, SEM SAÍDA DE SECREÇÃO ATIVA OU PASSIVA, SEM SINAIS FLOGÍSTICOS');
    return L.join('\n');
  }
  function molde(ficha, opc) {
    opc = opc || {}; var tipo = opc.tipo === 'amb' ? 'amb' : 'enf', hoje = opc.hoje || '', Ms = ficha && ficha.momentos || [];
    var M0 = Ms[0] || novoMomento(false), ult = Ms[Ms.length - 1] || M0, L = [];
    (opc.eventos || []).forEach(function (e) { if (e && String(e.t || '').trim()) L.push('1D ' + String(e.t).trim().toUpperCase() + (e.data ? ' ' + e.data : '')); });
    if (String(opc.mec || '').trim()) L.push(String(opc.mec).trim().toUpperCase());
    var bloco = function (B) { B = B.filter(function (x) { return x != null; }); if (!B.length) return; if (L.length) L.push(SEP); L.push.apply(L, B); };
    if (M0.hma) bloco(['HMA'].concat(String(M0.hma).split('\n')));
    if (M0.ap.length) bloco(M0.ap.slice());
    var ef = ''; Ms.forEach(function (m) { if (m.ef) ef = m.ef; });
    var par = PARAGRAFO.enf, efTxt = ef;
    if (tipo === 'amb') { var R = relatoAmb(Ms, ult); par = R.texto; efTxt = exameAmb(ef, R); }
    bloco([par, '', 'EXAME FISICO', ''].concat(efTxt ? String(efTxt).split('\n') : ['___']));
    var rz = []; Ms.forEach(function (m) { m.realizado.forEach(function (l) { rz.push((hoje ? hoje + ': ' : '') + l); }); });
    bloco(rz);
    var rx = [], labs = [];
    Ms.forEach(function (m) { m.resultados.forEach(function (l) { if (/^\s*LABS?\b/i.test(l)) labs.push(l); else rx.push((hoje && !/\d{2}\/\d{2}\/\d{4}/.test(l) ? hoje + ': ' : '') + l); }); });
    if (rx.length) bloco(['RADIOGRAFIA'].concat(rx));
    bloco(labs);
    var cd = (ult.discutido ? ['DISCUTIDO E ORIENTADO POR ' + pessoa(ult.discutido) + (ult.discutido.data ? ' EM ' + ult.discutido.data : '')] : []).concat(ult.conduta.map(function (l) { return '- ' + l; }));
    if (cd.length) bloco(['CONDUTA'].concat(cd));
    return L.join('\n');
  }

  var API = { escrever: escrever, ler: ler, pendencias: pendencias, coluna: coluna, regioes: regioes, eventos: eventos, mecanismo: mecanismo, molde: molde, PARAGRAFO: PARAGRAFO, CAB: CAB };
  G.SOTFICHA = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof self !== 'undefined' ? self : this);
