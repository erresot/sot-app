/* SOT — LINHA DO INTERNOGRAMA: UM motor para gerar a linha (6 colunas) do internograma. Usado pelo Novo Paciente (tela),
   pela Agenda (paciente da agenda → linha) e pelo AMB Internação. Antes a Agenda abria o Novo Paciente escondido só para chamar build().
   build(estado) → {cols:[6 colunas], bold} · estado(ev, celulaMapa) converte evento da Agenda + célula do mapa no estado do build. */
(function (G) {
'use strict';
var pad = n => String(n).padStart(2, '0');
var cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
var deacc = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
var todayISO = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
var br = iso => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return d + '/' + m + '/' + y; };
var toD = iso => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
var diff = (a, b) => Math.round((toD(b) - toD(a)) / 864e5);
var norm0 = s => String(s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
var temDadosMapa = x => !!(x && (x.dx || x.cmb || x.muc || x.alergia || x.mec || x.cirPrev || (x.labs && Object.keys(x.labs).some(k => x.labs[k]))));
const KEEP=new Set('RCH UTI CC AO OTA TC RM RX OK ATB EV VO HAS DM DM2 DPOC IRA ITU TCE MSD MSE MID MIE MMII MMSS CME GMR LPP PCR CCIH AVC IAM FA ICC DRC HIV DLP SUS TQT IOT VM DVA PTQ ATQ ATJ PTJ LCA LCP SOR APA TEP TVP RAFI DHS DCS PFN TFN HIM PS SNC ECG ECO CROSS UBS UPA SAMU P+E AINE QDE QDD PDE PDD TCG RNM APA ADM FO BEG REG MEG'.split(' '));
const ACC={femur:'fêmur',anatomopatologico:'anatomopatológico',anatomopatologica:'anatomopatológica',umero:'úmero',radio:'rádio',tibia:'tíbia',fibula:'fíbula',clavicula:'clavícula',acetabulo:'acetábulo',calcaneo:'calcâneo',maleolo:'maléolo',olecrano:'olécrano',escapula:'escápula',osteossintese:'osteossíntese',osteosintese:'osteossíntese',propria:'própria',pre:'pré',ate:'até',transtrocanterica:'transtrocantérica',subtrocanterica:'subtrocantérica',diafise:'diáfise',diafisaria:'diafisária',metafise:'metáfise',toracica:'torácica',luxacao:'luxação',internacao:'internação',orientacoes:'orientações',cirurgico:'cirúrgico',cirurgica:'cirúrgica',avaliacao:'avaliação',anestesica:'anestésica',nao:'não',hipertensao:'hipertensão',atraumatica:'atraumática',atraumatico:'atraumático',automobilistico:'automobilístico',agressao:'agressão',pelvico:'pélvico',iliaco:'ilíaco',pubis:'púbis',plato:'platô',pilao:'pilão',cabeca:'cabeça',fisioterapia:'fisioterapia',reducao:'redução',infeccao:'infecção',revisao:'revisão',descompressao:'descompressão',tracao:'tração',profilatica:'profilática',heparina:'heparina',sitio:'sítio',biopsia:'biópsia',vertebra:'vértebra',patelar:'patelar',umeral:'umeral',transfusao:'transfusão',ortopedica:'ortopédica',diagnostico:'diagnóstico',cronica:'crônica',necrose:'necrose',fisaria:'fisária',ulcera:'úlcera',ombro:'ombro',mao:'mão',pe:'pé',tendao:'tendão',lesao:'lesão',solicitacao:'solicitação',equipe:'equipe',medico:'médico',clinica:'clínica',sindrome:'síndrome'};
function fixAcc(t){if(!t)return t;return t.replace(/[A-Za-zÀ-ÿ]+/g,w=>{const k=w.toLowerCase();if(ACC[k]&&k!==ACC[k]){const r=ACC[k];return w===w.toUpperCase()?r.toUpperCase():(w[0]===w[0].toUpperCase()?cap(r):r)}return w})}
function titleTok(p){
  const m=p.match(/^([^A-Za-zÀ-ÿ0-9]*)(.*?)([^A-Za-zÀ-ÿ0-9+]*)$/);if(!m)return p;
  let [,a,core,z]=m;if(!core)return p;
  const U=core.toUpperCase();
  if(KEEP.has(deacc(U))||/\d/.test(core)||/^[IVX]{2,4}$/.test(U))core=U;
  else core=cap(core.toLowerCase());
  return a+core+z;
}
function fmtCase(t,mode){
  if(!t)return'';
  if(mode==='upper')return t.toUpperCase();
  return t.split(/(\s+)/).map(w=>/\s/.test(w)?w:w.split(/([-\/])/).map(p=>/^[-\/]$/.test(p)?p:titleTok(p)).join('')).join('');
}

const PEND=[['aviso','Aviso CC'],['agenda','Agenda'],['preops','Pré-Ops'],['rch','RCH'],['uti','UTI'],['cardio','Av Cardio'],['anest','Av Anestésica'],['termo','Termo']];
function build(s){
  const T=t=>fmtCase(fixAcc(t||''),s.caseMode);
  const ref=s.refDate||todayISO(),inc=+s.cnt;
  const days=iso=>iso?diff(iso,ref)+inc:null;
  const c1=[T(s.local),s.mec?T(s.mec)+(s.dtTrauma&&s.dtTrauma!==s.dih?' '+T('Em')+' '+br(s.dtTrauma):''):'',s.dih?T('Dih')+' '+br(s.dih):'',s.leito,s.marc].filter(Boolean);
  const nDih=days(s.dih);
  const c2=[T(s.nome),s.idade?s.idade+' '+T('Anos'):'',T(s.origem),nDih!==null?T('Dih')+' '+nDih:'',s.reg,s.classif].filter(Boolean);
  const c3=[];
  (s.dx||[]).forEach(d=>{if(d.tipo==='po'){const dt=d.data;const n=dt?diff(dt,ref):null;c3.push((n===null?'':n===0?T('Poi')+' ':n+' '+T('Po')+' ')+T(d.txt)+(dt?' ('+br(dt)+')':''));return}const dt=d.data||s.dtTrauma;const n=dt?days(dt):null;c3.push((n!==null?n+'d ':'')+T(d.txt)+(s.showDt&&dt?' ('+br(dt)+')':''))});
  if(s.ap)c3.push(T('Ap: '+s.ap));if(s.muc)c3.push(T('Muc: '+s.muc));if(s.alergia)c3.push(T('Alergia: '+s.alergia));
  if(s.outros)s.outros.split('\n').filter(x=>x.trim()).forEach(x=>c3.push(T(x.trim())));
  if(s.ass)c3.push(T('Ass '+s.ass));
  const c4=[];let bold=-1;
  const or=s.orienta||s.ass;if(or)c4.push(T(or+' Orienta:'));
  if(s.cx){bold=c4.length;c4.push(T(s.cx)+(s.dtCx?' '+T('Em')+' '+br(s.dtCx):''))}
  if(s.orientaExtra)s.orientaExtra.split('\n').filter(x=>x.trim()).forEach(x=>c4.push(T(x.trim())));
  const c5=[];
  if(s.cdExtra)s.cdExtra.split('\n').filter(x=>x.trim()).forEach(x=>c5.push(T(x.trim())));
  PEND.forEach(([k,l])=>{if(s.pend&&s.pend[k])c5.push(T(l)+' - '+T(s.pend[k]))});
  const c6=(s.exames||'').split('\n').map(x=>x.trimEnd()).filter(Boolean);
  return{cols:[c1,c2,c3,c4,c5,c6],bold};
}
const HEAD=['Local · Mecanismo · DIH · Leito','Nome · Idade · Origem · Internação · Registro','Causa · Ap · Class · Ass','Dr ----- Orienta','Condutas','Exames'];


const HEAD_ = HEAD;
function blank(over) { return Object.assign({ refDate: todayISO(), caseMode: 'title', cnt: '0', setor: 'SAV', local: 'Sala Amarela', dx: [], pend: {} }, over || {}); }
// estado no formato do programa Novo Paciente (mesmos campos de setState/build)
function estado(ev, x) {
  x = x || {}; var ano = ev.data.slice(0, 4);
  var cab = String(x.cab || '').split(',').map(function (s) { return s.trim(); });
  var nome = ev.nome || cab[0] || ev.titulo || '';
  var idade = String(ev.idade || (cab.find(function (s) { return /^\d{1,3}\s*a/i.test(s); }) || '')).replace(/\D/g, '');
  var reg = String(ev.P || ((x.cab || '').match(/P:\s*(\d{4,9})/) || [])[1] || ((ev.titulo || '').match(/\b(\d{5,8})\b/) || [])[1] || '');
  var ass = String(ev.ass || ((x.cab || '').match(/Ass\.?\s*(?:Dr\.?|Dra\.?)?\s*([^,]+)/i) || [])[1] || '').replace(/^\s*(dra?\.?)\s*/i, '').trim();
  var dra = /^\s*dra\b/i.test(ev.ass || '') ? 'Dra ' : 'Dr ';
  var mec = String(x.mec || '').trim(), dtT = '';
  var mm = mec.match(/\(?\s*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s*\)?\s*$/); if (mm) { dtT = SOTDATA.isoDeBR(mm[1], ano); mec = mec.slice(0, mm.index).trim(); }
  mec = mec.replace(/^QPA\b/i, 'Queda da própria altura');
  var itens = String(x.dx || '').split(/\s+\/\s+|\n+/).concat(String(x.cirPrev || '').split(/\s+\/\s+|\n+/)).map(function (t) { return t.replace(/^\s*•\s*/, '').trim(); }).filter(Boolean);
  var vistos = {}, dx = [];
  itens.forEach(function (t) {
    var k = norm0(t).replace(/[^A-Z0-9]/g, ''); if (vistos[k]) return; vistos[k] = 1;
    var data = '', tipo = 'dx', m;
    var dm = t.match(/\(\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*\)/) || t.match(/\s(\d{1,2}\/\d{1,2}\/\d{2,4})\s*$/);
    if (dm) { data = SOTDATA.isoDeBR(dm[1], ano); t = t.replace(dm[0], ' ').trim(); }
    if ((m = t.match(/^(\d+)\s*[º°]?\s*(?:PO|DPO|POT)\b\.?\s*(?:DE\s+)?/i)) || (m = t.match(/^POT?\b\.?\s*(?:DE\s+)?/i)) || (m = t.match(/^POI\b\s*(?:DE\s+)?/i))) {
      tipo = 'po'; t = t.slice(m[0].length); if (/^POI/i.test(m[0]) && !data) data = ev.data;
      // cirurgia antiga (> 90 dias): fica como "Pot ... (data)", como no internograma
      if (data && (new Date(ev.data + 'T12:00:00') - new Date(data + 'T12:00:00')) / 864e5 > 90) { t = 'Pot ' + t.trim() + ' (' + data.split('-').reverse().join('/') + ')'; data = ''; }
    }
    else if ((m = t.match(/^(\d+)\s*D\b\.?\s*(?:DE\s+)?/i))) { t = t.slice(m[0].length); }
    t = t.replace(/\s{2,}/g, ' ').trim(); if (t.length < 3) return;
    dx.push({ txt: t, data: data, tipo: tipo });
  });
  var st = function (v) { v = String(v || ''); return /✓|\bok\b|liberad|apt/i.test(v) ? 'OK' : /solic/i.test(v) ? 'Solicitado' : /—|n[aã]o\s*(precisa|necess)|dispens/i.test(v) ? '' : v ? 'Checar' : ''; };
  var LBK = ['Hb', 'Ht', 'Leuco', 'Plaq', 'TP', 'INR', 'TTPA', 'Fib', 'Cr', 'Ur', 'Na', 'K', 'Glic'];
  var labs = LBK.filter(function (k) { return x.labs && x.labs[k] && !(x.ocultos && x.ocultos['labs.' + k]); }).map(function (k) { return k + ' ' + x.labs[k]; });
  if (x.extras && !(x.ocultos && x.ocultos.extras)) labs.push(String(x.extras).replace(/\s+\/\s*$/, ''));
  var exames = labs.length ? (x.preData ? String(x.preData).split('/').slice(0, 2).map(function (s) { return ('0' + s.trim()).slice(-2); }).join('/') + ': ' : '') + labs.join(' / ') : '';
  var outros = [x.peso && !(x.ocultos && x.ocultos.peso) ? 'Peso: ' + x.peso : ''].filter(Boolean).join('\n');
  var orientaEx = [], cdEx = [];
  if (x.obs && !/^Cx:/i.test(x.obs)) cdEx.push(x.obs);
  if (x.pend) cdEx.push(x.pend);
  if (ev.nota) cdEx.push(ev.nota);
  return {
    refDate: ev.data > SOTDATA.hojeISO() ? ev.data : SOTDATA.hojeISO(), caseMode: 'title', cnt: '0', setor: '', local: '', leito: '', marc: '',
    mec: mec, dtTrauma: dtT, dih: ev.data, nome: nome, nasc: '', idade: idade, reg: reg, origem: x.cidade || '', classif: '',
    ap: x.cmb || '', muc: x.muc || '', alergia: x.alergia || (temDadosMapa(x) ? 'NEGA' : ''), outros: outros,
    ass: ass ? dra + ass : '', orienta: ass ? dra + ass : '', cx: ev.proc || x.cir || '', dtCx: ev.data,
    orientaExtra: orientaEx.join('\n'), cdExtra: cdEx.join('\n'), exames: exames, dx: dx, showDt: false,
    pend: { preops: labs.length ? 'OK' : 'Checar', rch: st(x.rch), uti: st(x.uti), cardio: st(x.cardio), anest: st(x.apa) }
  };
}

G.SOTLINHA = { build, HEAD, PEND, blank, estado, fixAcc, fmtCase, titleTok, KEEP, ACC };
})(typeof window !== 'undefined' ? window : globalThis);
