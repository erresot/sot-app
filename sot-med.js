/* SOT — MEDICAMENTOS: UMA lista para o app todo (AMB Internação/checklist, avaliação pré-op, mapa, Novo Paciente, Anamnese).
   Cada regra: k (id), nome, re (texto sem acento, maiúsculo), orient (conduta pré-op de referência), tipos:
   anticoag = anticoagulante/antiagregante/antitrombótico (alerta de sangramento) · mapa = entra no alerta do mapa. */
(function (G) {
'use strict';
var A = function (s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase(); };
var R = [
  { k: 'varfarina', nome: 'Varfarina', re: /VARFARINA|MAREVAN|COUMADIN|WARFARIN/, anticoag: 1, mapa: 1, orient: 'suspender ~5 dias antes e conferir INR no pré-op (ponte com heparina se alto risco trombótico).' },
  { k: 'doac', nome: 'DOAC (rivaroxabana/apixabana/edoxabana)', re: /RIVAROXABAN|XARELTO|APIXABAN|ELIQUIS|EDOXABAN|LIXIANA/, anticoag: 1, mapa: 1, orient: 'suspender 48–72 h antes conforme função renal e risco de sangramento.' },
  { k: 'dabigatrana', nome: 'Dabigatrana', re: /DABIGATRAN|PRADAXA/, anticoag: 1, mapa: 1, orient: 'suspender 48–96 h antes conforme função renal.' },
  { k: 'clopidogrel', nome: 'Clopidogrel', re: /CLOPIDOGREL|PLAVIX/, anticoag: 1, mapa: 1, orient: 'suspender ~5 dias antes (avaliar indicação — stent recente: discutir com cardiologia).' },
  { k: 'ticagrelor', nome: 'Ticagrelor', re: /TICAGRELOR|BRILINTA/, anticoag: 1, orient: 'suspender 3–5 dias antes (discutir com cardiologia).' },
  { k: 'prasugrel', nome: 'Prasugrel', re: /PRASUGREL|EFFIENT/, anticoag: 1, orient: 'suspender ~7 dias antes (discutir com cardiologia).' },
  { k: 'cilostazol', nome: 'Cilostazol', re: /CILOSTAZOL|PLETAL/, anticoag: 1, orient: 'suspender ~2–3 dias antes (antiplaquetário).' },
  { k: 'fondaparinux', nome: 'Fondaparinux', re: /FONDAPARINUX|ARIXTRA/, anticoag: 1, orient: 'suspender ~2–4 dias antes conforme função renal.' },
  { k: 'aas', nome: 'AAS', re: /\bAAS\b|ACIDO ACETILSALICILICO|ASPIRINA|SOMALGIN|ECASIL/, anticoag: 1, mapa: 1, orient: 'em geral mantido (prevenção secundária); suspensão só se orientado pela equipe/anestesia.' },
  { k: 'heparina', nome: 'Heparina/enoxaparina', re: /ENOXAPARINA|CLEXANE|HEPARINA|\bHBPM\b|\bHNF\b/, anticoag: 1, mapa: 1, orient: 'última dose profilática ≥12 h antes; terapêutica ≥24 h antes (bloqueio neuroaxial).' },
  { k: 'metformina', nome: 'Metformina', re: /METFORMINA|GLIFAGE|GLUCOFORMIN/, orient: 'suspender no dia da cirurgia (24–48 h se contraste ou disfunção renal).' },
  { k: 'sglt2', nome: 'iSGLT2 (dapagliflozina/empagliflozina)', re: /DAPAGLIFLOZINA|FORXIGA|EMPAGLIFLOZINA|JARDIANCE|CANAGLIFLOZINA|XIGDUO|SYNJARDY/, orient: 'suspender 3 dias antes (risco de cetoacidose euglicêmica).' },
  { k: 'glp1', nome: 'Agonista GLP-1', re: /SEMAGLUTIDA|OZEMPIC|WEGOVY|RYBELSUS|DULAGLUTIDA|TRULICITY|TIRZEPATIDA|MOUNJARO|LIRAGLUTIDA|VICTOZA|SAXENDA/, mapa: 1, orient: 'semanal: suspender 7 dias antes; diário: 1 dia antes (esvaziamento gástrico/aspiração).' },
  { k: 'insulina', nome: 'Insulina', re: /INSULINA|\bNPH\b|GLARGINA|LANTUS|DEGLUDEC|TRESIBA/, orient: 'ajustar dose da noite anterior/manhã conforme protocolo; glicemia capilar na internação.' },
  { k: 'sulfonilureia', nome: 'Sulfonilureia', re: /GLIBENCLAMIDA|GLICLAZIDA|GLIMEPIRIDA|DAONIL|DIAMICRON|AMARYL/, orient: 'não tomar no dia da cirurgia (hipoglicemia em jejum).' },
  { k: 'ieca-bra', nome: 'IECA/BRA', re: /LOSARTANA|VALSARTANA|OLMESARTANA|IRBESARTANA|CANDESARTANA|TELMISARTANA|ENALAPRIL|CAPTOPRIL|RAMIPRIL|LISINOPRIL|PERINDOPRIL|ARADOIS/, orient: 'muitos serviços suspendem no dia da cirurgia (hipotensão na indução) — conforme anestesia.' },
  { k: 'estrogenio', nome: 'Estrogênio (ACO/TRH)', re: /ANTICONCEPCIONAL|ETINILESTRADIOL|ESTRADIOL|TERAPIA HORMONAL|\bTRH\b|DIANE|YASMIN|SELENE|CICLO 21/, orient: 'risco de TEV: discutir suspensão (~4 semanas) em cirurgia de grande porte/imobilização de MMII.' },
  { k: 'fito', nome: 'Fitoterápico', re: /GINKGO|GINSENG|ALHO|OMEGA ?3|CASTANHA DA INDIA/, orient: 'suspender ~7 dias antes (efeito antiplaquetário).' },
  { k: 'dmard', nome: 'Imunossupressor/DMARD', re: /METOTREXATO|LEFLUNOMIDA|UPADACITINIBE|TOFACITINIBE|ADALIMUMABE|ETANERCEPT|INFLIXIMABE|BARICITINIBE/, orient: 'conduta individual (risco de infecção × atividade da doença) — reumatologia/anestesia.' },
  { k: 'corticoide', nome: 'Corticoide crônico', re: /PREDNISONA|PREDNISOLONA|DEXAMETASONA|HIDROCORTISONA|CORTICOIDE/, orient: 'não suspender; avaliar dose de estresse peroperatória.' }
];
// regras encontradas no texto (MUC, CMB, conduta…)
function achar(txt, filtro) { var u = A(txt); return R.filter(function (r) { return (!filtro || r[filtro]) && r.re.test(u); }); }
// nomes (como escritos) de anticoagulantes/antiagregantes no texto — para alerta de sangramento
function anticoag(txt) {
  var u = A(txt), out = {};
  R.filter(function (r) { return r.anticoag; }).forEach(function (r) { var g = new RegExp(r.re.source, 'g'), m; while ((m = g.exec(u))) out[m[0]] = 1; });
  return Object.keys(out);
}
// 1º medicamento que dispara o alerta do mapa (anticoagulante/GLP-1); devolve o trecho original
function alertaMapa(txt) { var s = String(txt || ''), u = A(s), r = R.filter(function (x) { return x.mapa; }).filter(function (x) { return x.re.test(u); })[0]; if (!r) return null; var m = u.match(r.re); return { regra: r, achado: m ? m[0] : r.nome }; }
G.SOTMED = { regras: R, achar: achar, anticoag: anticoag, alertaMapa: alertaMapa, A: A };
})(typeof window !== 'undefined' ? window : globalThis);
