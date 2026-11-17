/* SOT — EXAMES: UM motor para todos os exames, não importa como chegaram (laudo do sistema colado, linha do internograma,
   "PRÉ-OPS" da evolução, foto lida por OCR, digitado). Usado por: Exames Updater, Mapa, AMB Internação (evoluidor), internograma.
   Duas portas de entrada, UMA saída (mesma estrutura {dias:[{data, itens:[{ab, vals:[{val,v,alt,diff,tag}]}]}]}):
     • laudo do sistema  → motor do Exames Updater (processar)
     • linha compacta    → leitor de linhas (deLinha): "Hb 14,7; Ht 45,1 / Leuco 8.080 (0-0-0-81) | Plaq 396 mil ..."
   Saídas: formatar() (linha pronta p/ colar), paraMapa() (campos do mapa), paraInternograma() (formato do internograma). */
(function (G) {
'use strict';

// ═════════════════════════════ PARSER (puro, sem DOM) ═════════════════════════════
const norm = txt => txt
  .replace(/\r/g, '')
  .replace(/[   \t]/g, ' ')
  .replace(/[µμ]/g, 'u')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[–—]/g, '-')
  .replace(/[ ]{2,}/g, ' ')
  .replace(/ *\n */g, '\n')
  .replace(/\n{2,}/g, '\n');

const nameRe = src => new RegExp('(?<![a-z0-9])(?:' + src + ')(?![a-z0-9])', 'g');

// Número: aceita < > ≤ ≥, sinal só quando permitido; ignora datas, horas e dígitos colados em letras (t4, pco2, hba1c, mm3)
const NUM_RE = /(?<![\w.,\/:])((?:[<>]=?|[≤≥])\s*)?(-\s?)?(\d+(?:[.,]\d+)*)(?!\d|\s*\/\s*\d|:\d|[.,]\d)/g;

function toNum(s, thousands) {
  s = s.replace(/\s/g, '');
  const hasC = s.includes(','), hasD = s.includes('.');
  if (hasC && hasD) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (thousands && /^\d{1,3}([.,]\d{3})+$/.test(s)) {
    s = s.replace(/[.,]/g, '');
  } else {
    s = s.replace(',', '.');
  }
  return parseFloat(s);
}

function numbersIn(w, signed) {
  const out = [];
  NUM_RE.lastIndex = 0;
  let m;
  while ((m = NUM_RE.exec(w))) {
    out.push({
      op: m[1] ? m[1].replace(/\s/g, '').replace('≤', '<=').replace('≥', '>=') : '',
      neg: signed && !!m[2],
      raw: m[3],
      idx: m.index,
      after: w.slice(m.index + m[0].length, m.index + m[0].length + 14)
    });
  }
  return out;
}

// ── Catálogo de exames ──
// nomes: fontes regex (texto já normalizado); prioridade pela ordem.
// notAfter/notBefore: descartam ocorrências falsas (ex.: "hemoglobina corpuscular").
// ref: {min,max,strict}; unit(w,v): referência alternativa conforme unidade encontrada.
// plaus: faixa plausível — fora dela o número é descartado (evita pegar datas, IDs etc).
const EXAMES = [
  { ab: 'HB',    nomes: ['hemoglobina'], notAfter: /^\s*(corpuscular|glicada|glicosilada|a1c|fetal|media)/, notBefore: /(concentracao|media)\s+(de\s+)?$/, ref: { min: 10, max: 18 }, plaus: [1, 30] },
  { ab: 'HT',    nomes: ['hematocrito'], ref: { min: 30, max: 54 }, plaus: [3, 90] },
  { ab: 'RETIC', nomes: ['reticulocitos?'], ref: { min: 0.5, max: 2.5 }, plaus: [0, 60] },
  { ab: 'LEUCO', nomes: ['leucocitos', 'globulos brancos'], count: 100, ref: { min: 4000, max: 11000 }, plaus: [50, 2000000] },
  { ab: 'PLAQ',  nomes: ['plaquetas', 'contagem de plaquetas'], count: 2000, ref: { min: 150000, max: 400000 }, plaus: [500, 3000000] },
  { ab: 'PCR',   nomes: ['proteina c[\\s\\-]*reativa', 'pcr'], notAfter: /^\s*(para|rt|em tempo|sars|covid)/,
    ref: { min: null, max: 5, strict: true }, plaus: [0, 700],
    unit: a => /^\s*mg\s*\/\s*dl/.test(a) ? { min: null, max: 0.5, strict: true, nota: 'mg/dL' } : null, unidadeNota: 'mg/L; em mg/dL usa < 0,5' },
  { ab: 'VHS',   nomes: ['vhs', 'velocidade de hemossedimentacao', 'hemossedimentacao'], clean: w => w.replace(/(?<![\d.,])1\s*[aªo°º]?\s*h(ora)?\b/g, ' '), ref: { min: null, max: 20 }, plaus: [0, 200] },
  { ab: 'GLIC',  nomes: ['glicose', 'glicemia'], notAfter: /^\s*(capilar|na urina|urinaria|pos|2h)/, ref: { min: 75, max: 99 }, plaus: [5, 3000] },
  { ab: 'HBA1C', nomes: ['hemoglobina glicada', 'hemoglobina glicosilada', 'hba1c', 'a1c'], ref: { min: null, max: 5.6 }, plaus: [2, 25] },
  { ab: 'CR',    nomes: ['creatinina'], notAfter: /^\s*(urinaria|na urina|em urina|de urina|urina)/, notBefore: /clearance\s+(de\s+)?$/, ref: { min: 0.5, max: 1.3 }, plaus: [0.05, 30],
    sexAge: (sx) => sx === 'F' ? { min: 0.6, max: 1.0 } : sx === 'M' ? { min: 0.7, max: 1.25 } : null, sexNota: 'F 0,6–1,0 · M 0,7–1,25 (auto)' },
  { ab: 'UR',    nomes: ['ureia'], notAfter: /^\s*(urinaria|na urina|urina)/, ref: { min: 10, max: 55 }, plaus: [1, 600],
    sexAge: (sx, age) => age != null && age < 20 ? { min: 10.9, max: 44.9 } : sx === 'F' ? (age != null && age < 50 ? { min: 14.9, max: 40 } : { min: 20.9, max: 43 }) : sx === 'M' ? (age != null && age < 50 ? { min: 19, max: 44 } : { min: 17.9, max: 54.9 }) : null,
    sexNota: 'por sexo/idade do laudo (auto)' },
  { ab: 'NA',    nomes: ['sodio'], notAfter: /^\s*(urinario|na urina|urina)/, ref: { min: 136, max: 145 }, plaus: [90, 200] },
  { ab: 'K',     nomes: ['potassio'], notAfter: /^\s*(urinario|na urina|urina)/, ref: { min: 3.5, max: 5.1 }, plaus: [1, 12] },
  { ab: 'MG',    nomes: ['magnesio'], ref: { min: 1.6, max: 2.6 }, plaus: [0.2, 10] },
  { ab: 'CAT',   nomes: ['calcio total', 'calcio'], notAfter: /^\s*(ionico|ionizado|ion|i\b|livre|urinario)/, ref: { min: 8.4, max: 10.2 }, plaus: [2, 20],
    sexAge: (sx, age) => sx === 'M' && age > 60 ? { min: 8.8, max: 10.0 } : null, sexNota: 'H > 60 a: 8,8–10,0 (auto)' },
  { ab: 'CA ION',nomes: ['calcio ionico', 'calcio ionizado', 'calcio livre'], ref: { min: 1.15, max: 1.35 }, plaus: [0.3, 8],
    unit: (a, v) => /^\s*mg/.test(a) || v > 3 ? { min: 4.0, max: 5.4, nota: 'mg/dL' } : null, unidadeNota: 'mmol/L; em mg/dL usa 4,0–5,4' },
  { ab: 'P',     nomes: ['fosforo'], ref: { min: 2.5, max: 4.5 }, plaus: [0.3, 20] },
  { ab: 'CL',    nomes: ['cloreto', 'cloro'], ref: { min: 98, max: 107 }, plaus: [50, 160] },
  { ab: 'TSH',   nomes: ['tsh', 'hormonio tireoestimulante', 'tireotrofina'], ref: { min: 0.4, max: 4.0 }, plaus: [0, 500] },
  { ab: 'T4L',   nomes: ['t4 livre', 't4l', 'tiroxina livre'], ref: { min: 0.8, max: 1.8 }, plaus: [0, 20] },
  { ab: 'TGO',   nomes: ['transaminase oxalacetica', 'aspartato aminotransferase', 'tgo', 'ast'], ref: { min: null, max: 40 }, plaus: [1, 50000] },
  { ab: 'TGP',   nomes: ['transaminase piruvica', 'alanina aminotransferase', 'tgp', 'alt'], ref: { min: null, max: 55 }, plaus: [1, 50000] },
  { ab: 'FA',    nomes: ['fosfatase alcalina'], ref: { min: 40, max: 150 }, plaus: [1, 10000], thousands: true },
  { ab: 'GGT',   nomes: ['gama[\\s\\-]*glutamil[\\s\\-]*transferase', 'gama[\\s\\-]*glutamil', 'gama[\\s\\-]*gt', 'ggt'], ref: { min: 9, max: 64 }, plaus: [1, 10000], thousands: true },
  { ab: 'AMILASE', nomes: ['amilase'], ref: { min: 25, max: 125 }, plaus: [1, 20000], thousands: true },
  { ab: 'LIPASE',  nomes: ['lipase'], ref: { min: 13, max: 60 }, plaus: [1, 50000], thousands: true },
  { ab: 'BT',    nomes: ['bilirrubinas?[\\s\\-]*total'], bili: 'total', ref: { min: 0.2, max: 1.2 }, plaus: [0, 60] },
  { ab: 'BI',    nomes: ['bilirrubinas?[\\s\\-]*indireta'], bili: 'indireta', ref: { min: 0.2, max: 0.7 }, plaus: [0, 60] },
  { ab: 'BD',    nomes: ['bilirrubinas?[\\s\\-]*direta'], bili: 'direta', ref: { min: 0, max: 0.5 }, plaus: [0, 60] },
  { ab: 'PT',    nomes: ['proteinas totais', 'proteina total'], notAfter: /^\s*(urinaria|na urina|urina|24)/, ref: { min: 6.0, max: 8.0 }, plaus: [1, 15] },
  { ab: 'ALB',   nomes: ['albumina'], notAfter: /^\s*(urinaria|na urina|urina)/, ref: { min: 3.5, max: 5.0 }, plaus: [0.5, 8] },
  { ab: 'TP',    coag: 'tp',  ref: { min: 10, max: 14 }, plaus: [5, 200] },
  { ab: 'ATV',   coag: 'atv', ref: { min: 70, max: 130 }, plaus: [1, 200] },
  { ab: 'INR',   coag: 'inr', ref: { min: null, max: 1.24 }, plaus: [0.5, 20] },
  { ab: 'TTPA',  nomes: ['tempo de tromboplastina parcial ativad[ao]', 'tromboplastina parcial ativad[ao]', 'tromboplastina parcial', 'ttpa', 'kptt', 'aptt'], secs: true, ref: { min: 22, max: 40 }, plaus: [10, 250] },
  { ab: 'FIBRI', nomes: ['fibrinogenio'], ref: { min: 180, max: 350 }, plaus: [10, 2000], thousands: true },
  { ab: 'AC LAT',nomes: ['acido lactico', 'lactato'], ref: { min: 4.5, max: 19.8 }, plaus: [0.1, 300],
    unit: a => /^\s*mmol/.test(a) ? { min: 0.5, max: 2.2, nota: 'mmol/L' } : null, unidadeNota: 'mg/dL; em mmol/L usa 0,5–2,2' },
  { ab: 'DDIM',  nomes: ['d[\\s\\-]*dimero', 'dimero[\\s\\-]*d', 'dimero'], thousands: true, ref: { min: null, max: 500, strict: true }, plaus: [0, 200000],
    unit: (a, v) => (/^\s*(ug|mg)\s*(\/\s*(ml|l)\b|feu)/.test(a)) || (!/^\s*ng/.test(a) && v < 20) ? { min: null, max: 0.5, strict: true, nota: 'µg/mL' } : null,
    unidadeNota: 'ng/mL; em µg/mL ou mg/L usa < 0,5' },
  { ab: 'TROP',  nomes: ['troponina(?:\\s*[it])?(?:\\s*(?:ultra[\\s\\-]*sensivel|us|hs|de alta sensibilidade))?'], ref: { min: null, max: 0.04, strict: true }, plaus: [0, 100000],
    unit: (a, v) => /^\s*(ng\s*\/\s*l\b|pg\s*\/\s*ml)/.test(a) || (!/^\s*ng\s*\/\s*ml/.test(a) && v >= 1) ? { min: null, max: 14, strict: true, nota: 'ng/L' } : null,
    unidadeNota: 'ng/mL; em ng/L (alta sensib.) usa < 14' },
  { ab: 'CKMB',  nomes: ['ck[\\s\\-]*mb'], ref: { min: null, max: 25, strict: true }, plaus: [0, 5000] },
  { ab: 'CPK',   nomes: ['cpk', 'creatinofosfoquinase', 'creatinoquinase', 'creatina[\\s\\-]*(?:fosfo)?quinase', 'ck total', 'ck'], notAfter: /^[\s\-]*mb/, thousands: true, ref: { min: 30, max: 200 }, plaus: [1, 500000] },
  { ab: 'BNP',   nomes: ['bnp'], ref: { min: null, max: 100, strict: true }, plaus: [0, 50000], thousands: true },
  { ab: 'NTPROBNP', nomes: ['nt[\\s\\-]*pro[\\s\\-]*bnp', 'pro[\\s\\-]*bnp'], ref: { min: null, max: 125, strict: true }, plaus: [0, 100000], thousands: true },
  { ab: 'BHCG',  nomes: ['gonadotrofina corionica(?: humana)?(?:[\\s\\-]*fracao beta| beta)?', 'beta[\\s\\-]*hcg', 'b[\\s\\-]*hcg', 'bhcg', 'hcg'], qual: true, ref: { min: null, max: 5, strict: true }, plaus: [0, 2000000], thousands: true },
];

// Grupos da aba "Exames lançados" e seleção padrão SOT (cirurgia ortopédica + manejo infeccioso)
const GRUPOS = [
  ['Hemograma', ['HB', 'HT', 'LEUCO', 'PLAQ', 'RETIC']],
  ['Inflamação / infecção', ['PCR', 'VHS', 'AC LAT']],
  ['Renal / eletrólitos', ['CR', 'UR', 'NA', 'K', 'MG', 'CAT', 'CA ION', 'P', 'CL']],
  ['Coagulação', ['TP', 'ATV', 'INR', 'TTPA', 'FIBRI', 'DDIM']],
  ['Metabólico / nutrição', ['GLIC', 'HBA1C', 'ALB']],
  ['Músculo / trauma', ['CPK']],
  ['Pré-operatório', ['BHCG']],
  ['Fígado / pâncreas', ['TGO', 'TGP', 'FA', 'GGT', 'BT', 'BI', 'BD', 'PT', 'AMILASE', 'LIPASE']],
  ['Cardíaco', ['TROP', 'CKMB', 'BNP', 'NTPROBNP']],
  ['Tireoide', ['TSH', 'T4L']],
];
const PADRAO_SOT = new Set(['HB', 'HT', 'LEUCO', 'PLAQ', 'PCR', 'VHS', 'AC LAT', 'CR', 'UR', 'NA', 'K',
  'TP', 'ATV', 'INR', 'TTPA', 'FIBRI', 'GLIC', 'HBA1C', 'ALB', 'CPK', 'BHCG']);
EXAMES.forEach(e => { e.off = !PADRAO_SOT.has(e.ab); });
const oculto = (ab, cfg) => { const d = (cfg.disabled || {})[ab]; return d === undefined ? !PADRAO_SOT.has(ab) : !!d; };

// Nomes que não são exames da linha, mas servem de "parede" para não ler o valor do vizinho
const STOPPERS = [
  'hemacias', 'eritrocitos', 'vcm', 'hcm', 'chcm', 'rdw', 'vpm', 'volume corpuscular', 'volume plaquetario',
  'concentracao de hemoglobina', 'hemoglobina corpuscular', 'hbcm', 'chbcm', 'eritroblastos', 'comentarios', 'etfg', 'ratio', 'pool normal', 'eosinofilos', 'basofilos', 'linfocitos', 'monocitos',
  'neutrofilos', 'blastos', 'promielocitos', 'mielocitos', 'metamielocitos', 'bastonetes', 'bastoes', 'segmentados',
  'valores? de referencia', 'valor referencial', 'intervalo de referencia', 'referencia', 'metodo', 'material',
  'nota', 'observacao', 'obs', 'liberado', 'assinado', 'responsavel', 'coletado', 'data da coleta',
  'atividade', 'inr', 'rni', 'relacao', 'tempo controle', 'controle', 'gasometria',
];
const DIFF = [
  { k: 'mi',   nomes: ['mielocitos'] },
  { k: 'meta', nomes: ['metamielocitos'] },
  { k: 'bast', nomes: ['bastonetes', 'bastoes'] },
  { k: 'seg',  nomes: ['segmentados'] },
];

// Gasometria — refs arterial (A) e venosa (V)
const GASO = [
  { ab: 'PH',   nomes: ['ph'], ref: { A: { min: 7.35, max: 7.45 }, V: { min: 7.35, max: 7.45 } }, plaus: [6.5, 8] },
  { ab: 'PCO2', abA: 'PACO2', abV: 'PVCO2', nomes: ['paco2', 'pvco2', 'pco2', 'pressao parcial de co2'], ref: { A: { min: 35, max: 45 }, V: { min: 37, max: 50 } }, plaus: [5, 200] },
  { ab: 'PO2',  abA: 'PAO2', abV: 'PVO2', nomes: ['pao2', 'pvo2', 'po2', 'pressao parcial de o2'], ref: { A: { min: 80, max: 100 }, V: null }, plaus: [5, 700] },
  { ab: 'HCO3', nomes: ['c?hco3(?:[\\s\\-]*(?:std|padrao|real|act))?', 'bicarbonato(?:[\\s\\-]*(?:padrao|standard|real))?'], ref: { A: { min: 22, max: 26 }, V: { min: 22, max: 29 } }, plaus: [1, 70] },
  { ab: 'BE',   nomes: ['excesso de bases?', 'base excess', 'beecf', 'beb', 'be'], signed: true, ref: { A: { min: -2, max: 2 }, V: { min: -2, max: 2 } }, plaus: [-40, 40] },
  { ab: 'SATO2',abA: 'SATO2', abV: 'SVO2', nomes: ['sat\\.?\\s*o2', 'sao2', 'svo2', 'so2', 'saturacao(?: de (?:o2|oxigenio))?'], ref: { A: { min: 95, max: null }, V: null }, plaus: [5, 100] },
  { ab: 'LAC',  nomes: ['lactato', 'acido lactico'], ref: { A: { min: null, max: 2.0 }, V: { min: null, max: 2.0 } }, plaus: [0, 40],
    unit: a => /^\s*mg\s*\/\s*dl/.test(a) ? { min: null, max: 18 } : null },
];
const GASO_STOP = ['fio2', 'temperatura', 'hemoglobina', 'hb', 'sodio', 'potassio', 'cloro', 'cloreto', 'calcio', 'glicose', 'anion gap', 'tco2', 'co2 total', 'ctco2', 'p50', 'shunt', 'a-ado2', 'ado2', 'pao2\\/fio2'];

function matchesOf(t, src) {
  const re = nameRe(src), out = [];
  let m;
  while ((m = re.exec(t))) out.push({ start: m.index, end: m.index + m[0].length });
  return out;
}

function validOcc(t, occ, ex) {
  if (ex.notAfter && ex.notAfter.test(t.slice(occ.end, occ.end + 30))) return false;
  if (ex.notBefore && ex.notBefore.test(t.slice(Math.max(0, occ.start - 30), occ.start))) return false;
  return true;
}

// Monta índice de "paredes": inícios de todos os nomes conhecidos
function buildWalls(t, groups) {
  const walls = [];
  groups.forEach(g => g.nomes.forEach(src => matchesOf(t, src).forEach(o => walls.push({ ...o, id: g.id }))));
  walls.sort((a, b) => a.start - b.start);
  return walls;
}
function windowAfter(t, occ, walls, selfId, maxLen) {
  let end = Math.min(t.length, occ.end + maxLen);
  for (const w of walls) {
    if (w.start < occ.end) continue;
    if (w.start >= end) break;
    if (w.id === selfId) continue;
    end = w.start; break;
  }
  return t.slice(occ.end, end);
}

function pickNumber(w, ex, opts = {}) {
  let s = ex.clean ? ex.clean(w) : w;
  const seq = [];
  const rm = s.match(/resultado\s*[:.\-]?\s*/);
  if (rm) seq.push(...numbersIn(s.slice(rm.index + rm[0].length), ex.signed).slice(0, 1));
  seq.push(...numbersIn(s, ex.signed));
  for (const n of seq) {
    if (opts.needSecs && !/^\s*(s\b|seg|segundos)/.test(n.after)) continue;
    let v = toNum(n.raw, ex.thousands || !!ex.count);
    if (isNaN(v)) continue;
    if (n.neg) v = -v;
    let display = null;
    if (/^\s*mil\b/.test(n.after)) v *= 1000;
    if (ex.count && v < ex.count) v *= 1000;           // 7,5 (x10³) → 7500
    if (ex.count || (ex.thousands && /^\d{1,3}([.,]\d{3})+$/.test(n.raw))) display = String(Math.round(v));
    if (ex.plaus && !n.op && (v < ex.plaus[0] || v > ex.plaus[1])) continue;
    if (display === null) display = (n.neg ? '-' : '') + n.raw.replace(/\.(?=\d{3}(?!\d))(?=.*,)/g, '').replace(/[.,]/, '#').replace(/[.,]/g, '').replace('#', '.');
    return { v, display: (n.op || '') + display, op: n.op, w: s, a: n.after };
  }
  return null;
}

function extractGeneric(t, ex, walls) {
  for (const src of ex.nomes) {
    for (const occ of matchesOf(t, src)) {
      if (!validOcc(t, occ, ex)) continue;
      const w = windowAfter(t, occ, walls, ex.ab, 420);
      const r = pickNumber(w, ex, { needSecs: ex.secs && /seg|\ds\b/.test(w) });
      if (r) {
        if (/^\s*pos[\s\-]*transfus/.test(t.slice(occ.end, occ.end + 25))) r.tag = 'PÓS-TX';
        return r;
      }
      if (ex.qual) {
        const q = w.slice(0, 160).match(/\b(nao reagente|negativo|reagente|positivo)\b/);
        if (q) { const neg = /nao|negativo/.test(q[1]); return { qualTxt: neg ? 'NEG' : 'POS', altered: !neg }; }
      }
    }
  }
  return null;
}

// Bilirrubinas em bloco ("BILIRRUBINAS ... Total 0.8 / Direta 0.2 / Indireta 0.6")
function extractBiliBlock(t, ex) {
  for (const occ of matchesOf(t, 'bilirrubinas?')) {
    const blk = t.slice(occ.end, occ.end + 400);
    const m = blk.match(new RegExp('(?<![a-z])' + ex.bili + '(?![a-z])[^\\d\\n]{0,25}(\\d+(?:[.,]\\d+)?)'));
    if (m) { const v = toNum(m[1]); if (v >= ex.plaus[0] && v <= ex.plaus[1]) return { v, display: m[1].replace(',', '.') }; }
  }
  return null;
}

// Coagulograma: TP (segundos), atividade (%), INR/RNI
function extractCoag(t, which) {
  const heads = ['tempo de protrombina', 'tempo e atividade de protrombina', 'tempo de atividade de protrombina', 'protrombina', 'tap', 'tp'];
  const occs = [];
  heads.forEach(h => matchesOf(t, h).forEach(o => occs.push(o)));
  occs.sort((a, b) => a.start - b.start);
  const blocks = occs.map(o => {
    let blk = t.slice(o.end, o.end + 450);
    const stop = blk.search(/tromboplastina|ttpa|kptt|aptt|fibrinogenio|plaquetas|d[\s\-]*dimero/);
    return stop > 0 ? blk.slice(0, stop) : blk;
  });
  const NUM = '(\\d+(?:[.,]\\d+)?)';
  if (which === 'inr') {
    const zones = [...blocks, t];
    for (const z of zones) {
      const m = z.match(new RegExp('(?<![a-z])(?:inr|rni|r\\.n\\.i\\.?|i\\.n\\.r\\.?)(?![a-z])[^\\d\\n]{0,30}' + NUM));
      if (m) { const v = toNum(m[1]); if (v >= 0.5 && v <= 20) return { v, display: m[1].replace(',', '.') }; }
    }
    return null;
  }
  for (const b of blocks) {
    if (which === 'atv') {
      let m = b.match(new RegExp('atividade[^\\d\\n]{0,40}' + NUM)) || b.match(new RegExp(NUM + '\\s*%'));
      if (m) { const v = toNum(m[1]); if (v > 0 && v <= 200) return { v, display: m[1].replace(',', '.') }; }
    } else {
      let m = b.match(new RegExp('(?:tempo(?: do paciente)?|paciente|resultado)[^\\d\\n]{0,20}' + NUM + '\\s*(?:s\\b|seg)')) ||
              b.match(new RegExp('(?<![\\d.,])' + NUM + '\\s*(?:s\\b|seg)'));
      if (m) { const v = toNum(m[1]); if (v >= 5 && v <= 200) return { v, display: m[1].replace(',', '.') }; }
    }
  }
  // fallback direto ("Atividade protrombínica 85 %")
  if (which === 'atv') {
    const m = t.match(new RegExp('atividade (?:de )?protrombin\\w*[^\\d\\n]{0,30}' + NUM));
    if (m) return { v: toNum(m[1]), display: m[1].replace(',', '.') };
  }
  return null;
}

function extractDiff(t, walls) {
  const res = {};
  let found = 0;
  for (const d of DIFF) {
    res[d.k] = null;
    outer: for (const src of d.nomes) {
      for (const occ of matchesOf(t, src)) {
        const w = windowAfter(t, occ, walls, 'diff_' + d.k, 120);
        const m = w.match(/(?<![\w.,])(\d+(?:[.,]\d+)?)\s*%/) || (numbersIn(w)[0] && { 1: numbersIn(w)[0].raw });
        if (m) { const v = toNum(m[1]); if (v >= 0 && v <= 100) { res[d.k] = m[1].replace(',', '.'); found++; break outer; } }
      }
    }
  }
  if (!found) return null;
  return ['mi', 'meta', 'bast', 'seg'].map(k => res[k] ?? '0').join('-');
}

function detectarData(t) {
  const lab = t.match(/(?:data\s*(?:da|de)?\s*coleta|coletad[oa]\s*(?:em)?|coleta|data\s*(?:do)?\s*(?:exame|atendimento|resultado))[^\d\n]{0,25}(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?/);
  let m = lab;
  if (!m) {
    const re = /(?<![\d\/])(\d{2})\/(\d{2})\/(\d{2,4})(?![\d\/])/g;
    let x;
    while ((x = re.exec(t))) {
      if (/nasc|dn\b|d\.n\./.test(t.slice(Math.max(0, x.index - 25), x.index))) continue;
      m = x; break;
    }
  }
  if (!m) return '';
  const d = +m[1], mo = +m[2];
  if (d < 1 || d > 31 || mo < 1 || mo > 12) return '';
  const ano = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : '';
  return String(d).padStart(2, '0') + '/' + String(mo).padStart(2, '0') + (ano ? '/' + ano : '');
}

function isAltered(v, ref) {
  if (!ref) return false;
  if (ref.min != null && v < ref.min) return true;
  if (ref.max != null && (ref.strict ? v >= ref.max : v > ref.max)) return true;
  return false;
}

function avaliarOp(op, v, ref) {
  // "<5" com ref máx 5 → normal; ">200" com ref máx 40 → alterado
  if (!ref) return false;
  if (op.startsWith('<')) return ref.min != null && v <= ref.min;
  if (op.startsWith('>')) return ref.max != null && v >= ref.max;
  return isAltered(v, ref);
}

// Extras da gasometria (opcional): eletrólitos/metabólitos do mesmo painel
const GASO_EXTRA = [
  { ab: 'NA',     nomes: ['sodio'], ref: { min: 136, max: 145 }, plaus: [90, 200] },
  { ab: 'K',      nomes: ['potassio'], ref: { min: 3.5, max: 5.1 }, plaus: [1, 12] },
  { ab: 'CA ION', nomes: ['calcio ionico', 'calcio ionizado'], ref: { min: 1.15, max: 1.35 }, plaus: [0.3, 8] },
  { ab: 'CL',     nomes: ['cloro', 'cloreto'], ref: { min: 98, max: 107 }, plaus: [50, 160] },
  { ab: 'GLIC',   nomes: ['glicose'], ref: { min: 75, max: 99 }, plaus: [5, 3000] },
  { ab: 'HB',     nomes: ['hb', 'hemoglobina'], notBefore: /(o2|co|h|met|oxi|carboxi)\s*$/, ref: { min: 10, max: 18 }, plaus: [1, 30] },
  { ab: 'HT',     nomes: ['ht', 'hematocrito'], ref: { min: 30, max: 54 }, plaus: [3, 90] },
];

function detectarSexoIdade(t) {
  const sx = t.match(/(?<![a-z])sexo\s*:?\s*(masculino|feminino|m|f)(?![a-z])/);
  const id = t.match(/(?<![a-z])idade\s*:?\s*(\d{1,3})/);
  return { sexo: sx ? sx[1][0].toUpperCase() : '', idade: id ? +id[1] : null };
}

// Divide o texto em laudos (um por cabeçalho "Requisição ... Data: dd/mm/aa hh:mm")
function segmentar(t) {
  const re = /requisicao\s*:?\s*\d+[^\n]*?\bdata\s*:?\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/g;
  const heads = [];
  let m;
  while ((m = re.exec(t))) heads.push(m);
  if (!heads.length) {
    const d = detectarData(t);
    return [{ txt: t, data: d, key: d ? (d.slice(6) || '0000') + d.slice(3, 5) + d.slice(0, 2) : '', hora: '' }];
  }
  return heads.map((h, i) => {
    let ano = h[3].length === 2 ? '20' + h[3] : h[3];
    const dd = h[1].padStart(2, '0'), mm = h[2].padStart(2, '0');
    return {
      txt: t.slice(h.index, i + 1 < heads.length ? heads[i + 1].index : t.length),
      data: `${dd}/${mm}/${ano}`, key: `${ano}${mm}${dd}`,
      hora: h[4] ? h[4].padStart(2, '0') + ':' + h[5] : ''
    };
  });
}

function refFor(ex, cfg, ctx) {
  const user = (cfg.refs || {})[ex.ab];
  if (user) return { ...ex.ref, ...user };
  if (ex.sexAge && cfg.sexRef !== false) { const r = ex.sexAge(ctx.sexo, ctx.idade); if (r) return r; }
  return { ...ex.ref };
}

// Processa UM laudo/segmento
function processarSegmento(t, cfg, ctx) {
  const disabled = cfg.disabled || {};
  const mainGroups = EXAMES.filter(e => e.nomes).map(e => ({ id: e.ab, nomes: e.nomes }));
  const gasoShared = new Set(['NA', 'K', 'CL', 'CA ION', 'CAT', 'GLIC', 'AC LAT', 'HB', 'HT']);
  const strongWalls = buildWalls(t, mainGroups.filter(g => !gasoShared.has(g.id)).concat([{ id: 'hemo', nomes: ['hemograma', 'coagulograma', 'eritrograma', 'leucograma', 'urina', 'eas'] }]));
  const gasoHeads = matchesOf(t, 'gasometria(?:\\s*[-:]?\\s*(?:arterial|venosa|venosa central|mista))?|gaso\\s*(?:arterial|venosa)');
  const gasoBlocks = [];
  gasoHeads.forEach((h, i) => {
    const head = t.slice(h.start, h.end);
    let end = Math.min(t.length, h.end + 1500);
    if (gasoHeads[i + 1]) end = Math.min(end, gasoHeads[i + 1].start);
    for (const w of strongWalls) { if (w.start > h.end + 5 && w.start < end) { end = w.start; break; } }
    const tipo = /venosa/.test(head) ? 'V' : /arterial/.test(head) ? 'A' : '';
    gasoBlocks.push({ start: h.start, end, tipo, txt: t.slice(h.end, end) });
  });
  let tMain = t;
  for (const b of gasoBlocks) tMain = tMain.slice(0, b.start) + ' '.repeat(b.end - b.start) + tMain.slice(b.end);

  const walls = buildWalls(tMain, mainGroups.concat(
    [{ id: 'stop', nomes: STOPPERS }],
    DIFF.map(d => ({ id: 'diff_' + d.k, nomes: d.nomes }))
  ));
  const itens = {};
  for (const ex of EXAMES) {
    let r = null;
    if (ex.coag) r = extractCoag(tMain, ex.coag);
    else {
      r = extractGeneric(tMain, ex, walls);
      if (!r && ex.bili) r = extractBiliBlock(tMain, ex);
    }
    if (!r) continue;
    let item;
    if (r.qualTxt) item = { val: r.qualTxt, alt: r.altered };
    else {
      let ref = refFor(ex, cfg, ctx);
      if (ex.unit) { const u = ex.unit(r.a || '', r.v); if (u) ref = u; }
      item = { val: r.display, v: r.v, alt: r.op ? avaliarOp(r.op, r.v, ref) : isAltered(r.v, ref), unidade: ref.nota || '', tag: r.tag || '' };
    }
    if (ex.ab === 'LEUCO' && cfg.diff !== false) item.diff = extractDiff(tMain, walls);
    item.hidden = oculto(ex.ab, cfg);
    itens[ex.ab] = item;
  }

  const gasos = [];
  const extras = cfg.gasoExtra ? GASO_EXTRA : [];
  const gWallsGroups = GASO.concat(extras).map(g => ({ id: g.ab, nomes: g.nomes })).concat([{ id: 'gstop', nomes: GASO_STOP.concat(STOPPERS) }]);
  for (const b of gasoBlocks) {
    const gw = buildWalls(b.txt, gWallsGroups);
    const tipo = b.tipo || 'A';
    const params = [];
    for (const g of GASO) {
      const r = extractGeneric(b.txt, g, gw);
      const label = (tipo === 'V' ? g.abV : g.abA) || g.ab;
      if (!r) { params.push({ ab: label, val: null }); continue; }
      let ref = g.ref[tipo];
      if (g.unit && ref) { const u = g.unit(r.a || '', r.v); if (u) ref = u; }
      params.push({ ab: label, val: r.display, v: r.v, alt: ref ? isAltered(r.v, ref) : false });
    }
    for (const g of extras) {
      const r = extractGeneric(b.txt, g, gw);
      if (r) params.push({ ab: g.ab, val: r.display, v: r.v, alt: isAltered(r.v, g.ref) });
    }
    if (params.some(p => p.val !== null)) gasos.push({ label: b.tipo === 'V' ? 'GASO V' : b.tipo === 'A' ? 'GASO A' : 'GASO', params, hidden: !cfg.gaso });
  }
  return { itens, gasos };
}

// cfg: { refs, disabled, diff, sexRef, gasoExtra }
// Retorna { dias: [{ data, itens:[{ab, vals:[...]}], gasos:[...] }], faltando, sexo, idade }
function processar(raw, cfg = {}) {
  const t = norm(raw);
  const ctx = detectarSexoIdade(t);
  const segs = segmentar(t).map((sg, i) => ({ ...sg, ordem: i, res: processarSegmento(sg.txt, cfg, ctx) }));
  segs.sort((a, b) => (a.key + a.hora).localeCompare(b.key + b.hora) || a.ordem - b.ordem);

  const diasMap = new Map();
  for (const sg of segs) {
    if (!diasMap.has(sg.key)) diasMap.set(sg.key, { data: sg.data, por: {}, gasos: [], ocultos: [] });
    const dia = diasMap.get(sg.key);
    for (const [ab, it] of Object.entries(sg.res.itens)) {
      if (it.hidden) {
        if (it.alt && !dia.ocultos.some(o => o.ab === ab && o.val === it.val)) dia.ocultos.push({ ab, val: it.val });
        continue;
      }
      const lista = dia.por[ab] = dia.por[ab] || [];
      const ult = lista[lista.length - 1];
      const sig = it.val + '|' + (it.diff || '') + '|' + it.tag;
      if (ult && ult.sig === sig) continue;            // mesmo valor repetido (ex.: plaquetas do hemograma + contagem)
      lista.push({ ...it, sig, hora: sg.hora });
    }
    for (const g of sg.res.gasos) {
      if (g.hidden) {
        g.params.filter(p => p.alt).forEach(p => {
          const ab = `${p.ab} (${g.label})`;
          if (!dia.ocultos.some(o => o.ab === ab && o.val === p.val)) dia.ocultos.push({ ab, val: p.val });
        });
        continue;
      }
      const sig = g.label + JSON.stringify(g.params.map(p => p.val));
      if (!dia.gasos.some(x => x.sig === sig)) dia.gasos.push({ ...g, sig, hora: sg.hora });
    }
  }
  const encontrados = new Set();
  const dias = [...diasMap.values()].map(d => ({
    data: d.data,
    itens: EXAMES.filter(e => d.por[e.ab]).map(e => { encontrados.add(e.ab); return { ab: e.ab, vals: d.por[e.ab] }; }),
    gasos: d.gasos,
    ocultos: d.ocultos
  })).filter(d => d.itens.length || d.gasos.length || d.ocultos.length);
  const faltando = EXAMES.filter(e => !encontrados.has(e.ab) && !oculto(e.ab, cfg)).map(e => e.ab);
  return { dias, faltando, sexo: ctx.sexo, idade: ctx.idade, nSeg: segs.length };
}



// ═════════════════════════════ LINHAS COMPACTAS (internograma, PRÉ-OPS, digitado, foto) ═════════════════════════════
const ALIAS = [
  ['HB', /^(HB|HGB|HEMOGLOBINA)$/], ['HT', /^(HT|HTC|HTO|HEMATOCRITO)$/], ['LEUCO', /^(LEUCO|LEUCOS|LEUC|LEU|LEUCOCITOS|GB|L)$/], ['PLAQ', /^(PLAQ|PLAQUE|PLAQUETAS|PLT|PLQ)$/],
  ['TP', /^(TP|TAP)$/], ['ATV', /^(ATV|ATIV|AP|ATIVIDADE)$/], ['INR', /^(INR|RNI)$/], ['TTPA', /^(TTPA|KPTT|TTP)$/], ['RATIO', /^(RATIO|TTPA R)$/], ['FIBRI', /^(FIB|FIBRI|FIBRIN|FIBRINO|FIBRINOGENIO)$/],
  ['CR', /^(CR|CREAT|CREATININA|CREA)$/], ['UR', /^(UR|U|UREIA)$/], ['NA', /^(NA|SODIO)$/], ['K', /^(K|POTASSIO)$/], ['GLIC', /^(GLIC|GLICEMIA|GLI|GJ|GLICOSE)$/],
  ['TSH', /^TSH$/], ['T4L', /^(T4L|T4 LIVRE|T4LIVRE)$/], ['PCR', /^PCR$/], ['VHS', /^VHS$/], ['MG', /^(MG|MAGNESIO)$/], ['CA', /^(CA|CAI|CALCIO|CA ION|CAION)$/], ['P', /^(P|FOSFORO)$/], ['ALB', /^(ALB|ALBUMINA)$/],
  ['TGO', /^(TGO|AST)$/], ['TGP', /^(TGP|ALT)$/], ['BT', /^BT$/], ['BD', /^BD$/], ['BI', /^BI$/], ['FA', /^FA$/], ['GGT', /^(GGT|GAMA GT)$/], ['CPK', /^(CK|CPK)$/], ['LAC', /^(LACTATO|LAC)$/],
  ['HBA1C', /^(HBA1C|HB GLICADA|A1C|GLICADA)$/], ['TROP', /^(TROP|TROPONINA)$/], ['BNP', /^(BNP|NT PROBNP)$/], ['DDIM', /^(D DIMERO|DIMERO D|DDIMERO)$/], ['AMILASE', /^AMILASE$/], ['LDH', /^(LDH|DHL)$/],
  ['CAT', /^CAT$/], ['AC LAT', /^AC LAT$/], ['SEG', /^(SEG|SEGMENTADOS)$/], ['LINF', /^(LINF|LINFOCITOS)$/], ['MONO', /^(MONO|MONOCITOS)$/], ['T4', /^T4$/], ['T3', /^T3$/], ['PTH', /^PTH$/],
  ['VITD', /^(VIT D|VITD|VITAMINA D)$/], ['FERRITINA', /^FERRITINA$/], ['PROCALC', /^(PROCALCITONINA|PCT)$/]
];
const MAPA_AB = { HB: 'Hb', HT: 'Ht', LEUCO: 'Leuco', PLAQ: 'Plaq', TP: 'TP', INR: 'INR', TTPA: 'TTPA', FIBRI: 'Fib', CR: 'Cr', UR: 'Ur', NA: 'Na', K: 'K', GLIC: 'Glic' };
const MAPA_ORDEM = ['HB', 'HT', 'LEUCO', 'PLAQ', 'TP', 'INR', 'TTPA', 'FIBRI', 'CR', 'UR', 'NA', 'K', 'GLIC'];
const NOME_EXTRA = { HBA1C: 'HbA1c', ALB: 'Alb', BHCG: 'β-hCG', 'AC LAT': 'Ac Lat', FIBRI: 'Fib', CAT: 'Cat', LDH: 'LDH' };
const SEMACENTO = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
function abDe(nome) {
  const u = SEMACENTO(nome).replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const [ab, re] of ALIAS) if (re.test(u)) return ab;
  return '';
}
const PLAUS = {}; EXAMES.forEach(e => { if (e.plaus) PLAUS[e.ab] = e.plaus; });
const EXAME_POR_AB = {}; EXAMES.forEach(e => { EXAME_POR_AB[e.ab] = e; });
function dataNorm(s, anoRef) {
  const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/); if (!m) return '';
  let y = m[3] || String(anoRef || new Date().getFullYear()); if (y.length === 2) y = '20' + y;
  return ('0' + m[1]).slice(-2) + '/' + ('0' + m[2]).slice(-2) + '/' + y;
}
const num = (s) => { s = String(s).trim(); return /^\d{1,3}(\.\d{3})+$/.test(s) ? parseFloat(s.replace(/\./g, '')) : parseFloat(s.replace(',', '.')); };
const RE_SEG = /^\s*([*↑↓]*)\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 .]{0,14}?)(?:\s*:\s*|\s+)([*↑↓]*)\s*(\d{1,3}(?:\.\d{3})+|\d+(?:[.,]\d+)?)(?!\d)(?!\s*-\s*\d)\s*(mil\b|k\b|%|s\b)?\s*([*↑↓]*)/i;
// separa o texto em blocos por data ("13/11/2026: ...", "PRÉ-OPS (22/10): ...", "07/11:Hb ...")
function blocosPorData(t) {
  const re = /(?:^|[\s(\[])(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s*\)?\s*[:\-–]?\s*(?=[*↑↓]*\s*[A-Za-zÀ-ÿ]{1,12}\b)/g;
  const heads = []; let m;
  while ((m = re.exec(t))) heads.push({ ini: m.index + m[0].length - m[0].replace(/^[\s(\[]/, '').length + (m[0].length - m[0].replace(/^[\s(\[]/, '').length), data: m[1], fim: m.index + m[0].length });
  if (!heads.length) return [{ data: '', txt: t }];
  const out = []; if (t.slice(0, heads[0].fim - 0).replace(/\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s*\)?\s*[:\-–]?\s*$/, '').trim()) out.push({ data: '', txt: t.slice(0, heads[0].ini) });
  heads.forEach((h, i) => out.push({ data: h.data, txt: t.slice(h.fim, i + 1 < heads.length ? heads[i + 1].ini : t.length) }));
  return out;
}
function limparLinha(t) {
  return String(t || '')
    .replace(/\\([|*#>_~\-])/g, '$1').replace(/\*\*/g, ' ')
    
    .replace(/\(\s*NA PASTA\s*\)|\bEM JEJUM\b|\bEXTERNOS?\b/gi, ' ')
    .replace(/\bU\s*\/\s*CR\s*\/\s*NA\s*\/\s*K\s*\/\s*GJ\b[^/\n]*/gi, ' ')
    .replace(/\bPLAQ\s*(\d{2,3})\s*MIL\b/gi, 'PLAQ $1 mil').replace(/[|]/g, ' ; ');
}
function itemDe(ab, v, extra) {
  const ex = EXAME_POR_AB[ab]; let alt = !!extra.alt;
  if (ex && !alt) { const ref = refFor(ex, { refs: {}, sexRef: false }, { sexo: '', idade: null }); alt = isAltered(v, ref); }
  return { ab, vals: [Object.assign({ val: extra.val, v, alt, tag: '' }, extra.diff ? { diff: extra.diff } : {})] };
}
function deLinha(raw, opt) {
  opt = opt || {}; const ano = opt.ano; const mapa = new Map(), extras = []; // data → Map(ab → vals[])
  const blocos = blocosPorData(limparLinha(raw));
  blocos.forEach(bl => {
    const data = dataNorm(bl.data, ano) || (opt.dataPadrao ? dataNorm(opt.dataPadrao, ano) : '');
    let txt = bl.txt;
    // "GJ (13/11/26) 91": glicemia de OUTRO dia dentro da linha
    txt = txt.replace(/\b(GJ|GLIC\w*|GLICEMIA)\s*\(\s*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s*\)\s*(\d+(?:[.,]\d+)?)/gi, (a, n, d, v) => { extras.push({ data: dataNorm(d, ano), ab: 'GLIC', v: num(v), val: String(num(v)) }); return ' '; });
    const diffs = {}; txt = txt.replace(/\b(leuco\w*|leu|l)\s*:?\s*[*↑↓]*(\d[\d.,]*)[*↑↓]*\s*\((\d{1,2}(?:-\d{1,2}){2,4})\)/gi, (a, n, v, d) => { diffs[abDe(n)] = d; return n + ' ' + v + ' '; });
    txt.replace(/[()]/g, ' ; ').replace(/,\s+(?=[A-Za-zÀ-ÿ])/g, ' ; ').split(/\s*;\s*|\s\/\s|\/(?=\s*\*?\s*[A-Za-zÀ-ÿ])|\n/).forEach(seg => {
      const m = seg.match(RE_SEG); if (!m) return;
      const ab = abDe(m[2]); if (!ab) return;
      const raw1 = m[4], suf = (m[5] || '').toLowerCase(), marcado = !!(m[1] || m[3] || m[6]);
      let v = num(raw1); if (isNaN(v)) return;
      const ex = EXAME_POR_AB[ab]; let display;
      if (ab === 'PLAQ') { if (suf === 'mil' || suf === 'k') v *= 1000; else if (v < 2000) v *= 1000; display = String(Math.round(v)); }
      else if (ab === 'LEUCO') { if (suf === 'mil' || suf === 'k') v *= 1000; else if (v < 100) v *= 1000; display = String(Math.round(v)); }
      else display = /^\d{1,3}(\.\d{3})+$/.test(raw1) ? String(v) : raw1.replace(',', '.');
      if (ex && ex.plaus && (v < ex.plaus[0] || v > ex.plaus[1])) return;
      if (ab === 'ATV' && suf !== '%' && v > 300) return;
      const it = itemDe(ab, v, { alt: marcado, val: display, diff: ab === 'LEUCO' ? diffs.LEUCO : '' });
      if (!mapa.has(data)) mapa.set(data, new Map());
      const dm = mapa.get(data); if (dm.has(ab)) dm.get(ab).vals.push(it.vals[0]); else dm.set(ab, it);
    });
  });
  extras.forEach(x => { const it = itemDe(x.ab, x.v, { alt: false, val: x.val }); if (!mapa.has(x.data)) mapa.set(x.data, new Map()); const dm = mapa.get(x.data); if (!dm.has(x.ab)) dm.set(x.ab, it); });
  const dias = [...mapa.entries()].map(([data, dm]) => ({ data, itens: [...dm.values()], gasos: [], ocultos: [] }));
  dias.sort((a, b) => diaChave(a.data) - diaChave(b.data));
  return { dias, faltando: [], sexo: '', idade: null, nSeg: blocos.length };
}
function diaChave(d) { const m = String(d || '').match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? +(m[3] + m[2] + m[1]) : 0; }
function ehLaudo(raw) { return (String(raw).match(/Resultado/gi) || []).length >= 2 || /M[eé]todo\s*:/i.test(raw) || /Refer[eê]ncia\s*:/i.test(raw); }
// ENTRADA ÚNICA: qualquer texto de exames
function ler(raw, opt) {
  opt = opt || {}; raw = String(raw || '');
  const cfg = Object.assign({ refs: {}, disabled: {}, diff: true, ast: true, dec: '.', data: true, dias: 'todos', sexRef: true, gasoExtra: false, gaso: false }, opt.cfg || {});
  const vazio = r => !r || !r.dias || !r.dias.some(d => d.itens.length);
  let r = null;
  if (ehLaudo(raw)) { try { r = processar(raw, cfg); } catch (e) { r = null; } if (vazio(r)) r = deLinha(raw, opt); }
  else { r = deLinha(raw, opt); if (vazio(r)) { try { const r2 = processar(raw, cfg); if (!vazio(r2)) r = r2; } catch (e) { /* segue */ } } }
  r.dias = (r.dias || []).map(d => Object.assign({}, d, { data: d.data ? dataNorm(d.data, opt.ano) : '' }));
  return r;
}
const fd = (x, dec) => dec === ',' ? String(x).replace(/(\d)\.(\d)/g, '$1,$2') : String(x);
function textoItem(it, cfg) {
  return it.vals.map((v, i) => { const t = (i === 0 ? it.ab + ' ' : '') + fd(v.val, cfg.dec) + (v.diff ? ' (' + v.diff + ')' : '') + (v.tag ? ' (' + v.tag + ')' : ''); return (v.alt && cfg.ast !== false) ? '*' + t + '*' : t; }).join(' → ');
}
// linha pronta p/ colar na evolução (mesmo formato do Exames Updater): "dd/mm/aaaa: HB 14.2 / HT 44.1 / ..."
function formatar(dias, opt) {
  opt = opt || {}; const cfg = Object.assign({ dec: '.', ast: true, data: true }, opt.cfg || {});
  return dias.filter(d => d.itens.length).map(d => {
    const corpo = d.itens.map(it => textoItem(it, cfg)).join(' / ');
    const cab = opt.cabecalho ? opt.cabecalho(d.data) : (cfg.data !== false && d.data ? d.data + ': ' : '');
    return cab + corpo;
  }).join('\n');
}
// campos do mapa: o valor mais recente de cada exame padrão; dia "principal" = o do Hb; outros dias levam " (dd/mm)"
function paraMapa(dias, opt) {
  opt = opt || {}; const sel = opt.dias ? new Set(opt.dias) : null;
  const usados = dias.filter(d => d.itens.length && (!sel || sel.has(d.data)));
  let principal = ''; usados.forEach(d => { if (d.itens.some(i => i.ab === 'HB')) principal = d.data; });
  if (!principal && usados.length) principal = usados[0].data;
  const labs = {}, extras = {}, todos = {}, curto = d => d ? d.slice(0, 5) : '';
  usados.forEach(d => d.itens.forEach(it => {
    const v = it.vals[it.vals.length - 1]; if (!v || v.val == null) return;
    const campo = MAPA_AB[it.ab]; let val = String(v.val).replace('.', ',');
    if (campo === 'Plaq' && v.v >= 1000) val = Math.round(v.v / 1000) + 'k';
    else if (campo === 'Leuco') val = String(Math.round(v.v));
    const suf = (d.data && principal && d.data !== principal) ? ' (' + curto(d.data) + ')' : '';
    const chave = diaChave(d.data);
    if (campo) { labs[campo] = val + (v.alt ? '*' : '') + suf; todos[campo] = { k: campo, v: val, alt: !!v.alt, data: curto(d.data), chave }; }
    else if (it.ab !== 'ATV' && it.ab !== 'RATIO') { const nome = NOME_EXTRA[it.ab] || it.ab; (extras[d.data || '?'] = extras[d.data || '?'] || []).push(nome + ' ' + val + (v.alt ? '*' : '')); todos[nome] = { k: nome, v: val, alt: !!v.alt, data: curto(d.data), chave }; }
  }));
  const ex = Object.keys(extras).sort((a, b) => diaChave(a) - diaChave(b)).map(d => extras[d].join(' / ') + (d !== '?' ? ' (' + curto(d) + ')' : '')).join(' · ');
  return { labs, extras: ex, data: principal, dataCurta: curto(principal), todos };
}
// internograma (várias linhas do paciente) → mesmo formato que o mapa usa (labsCompletos)
function paraInternograma(linhas, opt) {
  opt = opt || {}; const dias = [];
  (linhas || []).forEach(l => { if (/solicit|pedir|colher|aguard|programar|repetir/i.test(l) && !/\d+[.,]\d/.test(l)) return; ler(l, opt).dias.forEach(d => dias.push(d)); });
  // junta dias iguais
  const por = new Map(); dias.forEach(d => { const k = d.data || '?'; if (!por.has(k)) por.set(k, { data: d.data, itens: [], gasos: [], ocultos: [] }); const o = por.get(k); d.itens.forEach(it => { const x = o.itens.find(y => y.ab === it.ab); if (x) x.vals = x.vals.concat(it.vals); else o.itens.push(it); }); });
  const lista = [...por.values()].sort((a, b) => diaChave(a.data) - diaChave(b.data));
  const pm = paraMapa(lista, opt);
  // preData do internograma: dia do Hb (ou o dia com mais exames padrão), no formato dd/mm
  const cont = {}; lista.forEach(d => { cont[d.data] = d.itens.filter(i => MAPA_AB[i.ab]).length; });
  const dh = (() => { let x = ''; lista.forEach(d => { if (d.itens.some(i => i.ab === 'HB')) x = d.data; }); return x || Object.keys(cont).sort((a, b) => cont[b] - cont[a])[0] || ''; })();
  const labs = {}; MAPA_ORDEM.forEach(ab => { const k = MAPA_AB[ab], t = pm.todos[k]; if (t) labs[k] = t.v + (t.alt ? '*' : '') + (t.data && dh && t.data !== dh.slice(0, 5) ? ' (' + t.data + ')' : ''); });
  return { labs, data: dh ? dh.slice(0, 5) : '', extras: pm.extras.replace(/ \((\d{2}\/\d{2})\)/g, ' ($1)'), todos: pm.todos, dias: lista };
}
function cfgSalva() { try { return JSON.parse(localStorage.getItem('examesUpdater.sot.v4')) || {}; } catch (e) { return {}; } }

G.SOTEXAMES = { processar, EXAMES, GRUPOS, oculto, GASO, norm, toNum, ler, deLinha, ehLaudo, formatar, textoItem, paraMapa, paraInternograma, abDe, dataNorm, cfgSalva, MAPA_AB, MAPA_ORDEM, NOME_EXTRA };
if (typeof module !== 'undefined') module.exports = G.SOTEXAMES;
})(typeof window !== 'undefined' ? window : globalThis);
