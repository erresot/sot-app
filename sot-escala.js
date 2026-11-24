/* SOT — ESCALA DO AMBULATÓRIO: a ÚNICA fonte de quem atende, em que dia e com que área.
   Lido por: Condutas (PS), Solicitador de Retornos, Novo Paciente e Programação Pós-Op.
   Ao mudar um nome, um dia ou uma área, mude SÓ ESTE arquivo.

   Uma linha por PESSOA (ou equipe):
     id    identificador fixo — nunca mude (escolhas salvas nos aparelhos usam o id)
     n     nome como aparece na tela ("Dr. Fulano de Tal")
     eq    1 = equipe (não é uma pessoa)
     amb   dias de ambulatório: d (1=segunda … 5=sexta) + áreas daquele dia
   A área só DESCREVE (ajuda a achar o nome e sugerir o dia). Ela nunca impede nada:
   assistentes também atendem casos gerais e pronto-socorro.
   Retorno fora do dia do assistente é permitido — cada programa só avisa na tela. */
(function (G) {
'use strict';

const PESSOAS = [
  { id: 'fernando',   n: 'Dr. Fernando Salgado',          amb: [{ d: 1, areas: ['Pé e tornozelo'] }] },
  { id: 'marcondes',  n: 'Dr. José Marcondes',            amb: [{ d: 1, areas: ['Coluna'] }] },
  { id: 'emilio',     n: 'Dr. Emílio Murade',             amb: [{ d: 1, areas: ['Coluna'] }] },
  { id: 'amilton',    n: 'Dr. Amilton Moreira Fernandes', amb: [{ d: 1, areas: ['Pediátrica'] }] },
  { id: 'maysa',      n: 'Dra. Maysa Romanini',           amb: [{ d: 1, areas: ['Pediátrica'] }] },
  { id: 'eqped',      n: 'Equipe Pediátrica', eq: 1,      amb: [{ d: 1, areas: ['Pediátrica'] }] },
  { id: 'eduardo',    n: 'Dr. Eduardo Jacob',             amb: [{ d: 2, areas: ['Mão'] }] },
  { id: 'eqmao',      n: 'Equipe Mão', eq: 1,             amb: [{ d: 2, areas: ['Mão'] }] },
  { id: 'marcosv',    n: 'Dr. Marcos Vinicius',           amb: [{ d: 2, areas: ['Ombro e cotovelo'] }] },
  { id: 'antoniassi', n: 'Dr. Rodrigo Antoniassi',        amb: [{ d: 3, areas: ['Quadril'] }] },
  { id: 'adriano',    n: 'Dr. Adriano Garcia',            amb: [{ d: 3, areas: ['Quadril'] }] },
  { id: 'silveira',   n: 'Dr. Marcus Silveira',           amb: [{ d: 3, areas: ['Quadril'] }] },
  { id: 'eqquadril',  n: 'Equipe Quadril', eq: 1,         amb: [{ d: 3, areas: ['Quadril'] }] },
  { id: 'laraya',     n: 'Dr. Marcos Laraya',             amb: [{ d: 4, areas: ['Joelho'] }] },
  { id: 'ewerton',    n: 'Dr. Ewerton Gonzalez',          amb: [{ d: 4, areas: ['Joelho'] }] },
  { id: 'eqjoelho',   n: 'Equipe Joelho', eq: 1,          amb: [{ d: 4, areas: ['Joelho'] }] },
  { id: 'toma',       n: 'Dr. Ricardo Toma',              amb: [{ d: 4, areas: ['Tumor'] }] },
  { id: 'ederson',    n: 'Dr. Ederson Kida',              amb: [{ d: 4, areas: ['Tumor'] }, { d: 5, areas: ['Trauma'] }] },
  { id: 'eqtumor',    n: 'Equipe Tumor', eq: 1,           amb: [{ d: 4, areas: ['Tumor'] }] },
  { id: 'gustavo',    n: 'Dr. Gustavo Reinas',            amb: [{ d: 5, areas: ['Coluna', 'Trauma'] }] },
  { id: 'rogerio',    n: 'Dr. Rogério Freitas',           amb: [{ d: 5, areas: ['Trauma'] }] }
];

// ordem em que as áreas aparecem na tela (dentro de um dia, as pessoas seguem esta ordem)
const ORDEM_AREAS = ['Pé e tornozelo', 'Coluna', 'Pediátrica', 'Mão', 'Ombro e cotovelo', 'Quadril', 'Joelho', 'Tumor', 'Trauma'];
const posArea = a => { const i = ORDEM_AREAS.indexOf(a); return i < 0 ? 99 : i; };

const PLURAL = ['', 'SEGUNDAS-FEIRAS', 'TERÇAS-FEIRAS', 'QUARTAS-FEIRAS', 'QUINTAS-FEIRAS', 'SEXTAS-FEIRAS'];
const ORD    = ['', '2ª', '3ª', '4ª', '5ª', '6ª'];
const CURTO  = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const DIAS   = ['DOMINGO', 'SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO'];

const UP = s => (s || '').toLocaleUpperCase('pt-BR');
const norm = s => (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
  .replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
const TIT = /^(DRA?|DOUTORA?|DR\s*A)\s+/;
const semTitulo = s => norm(s).replace(TIT, '');
const nomeSemTitulo = n => UP(n.replace(/^Dra?\.\s*/, ''));          // "FERNANDO SALGADO"
const titulo = n => /^Equipe/i.test(n) ? '' : /^Dra\./.test(n) ? 'DRA' : 'DR';
const areasTxt = a => a.areas.join(' / ');                            // "Coluna / Trauma"

// visão por pessoa (formato usado pelo Condutas): dias [{d, e:'COLUNA / TRAUMA', areas:[...]}]
function pessoas() {
  return PESSOAS.map(p => ({ id: p.id, n: p.n, eq: !!p.eq, amb: p.amb,
    dias: p.amb.map(a => ({ d: a.d, e: UP(areasTxt(a)), areas: a.areas.slice() })) }));
}
const porId = id => pessoas().find(p => p.id === id) || null;
const atendeNoDia = (p, d) => !!p && p.amb.some(a => a.d === d);
const diasDe = p => p ? p.amb.map(a => a.d) : [];
// quem atende no dia d (uma vez por pessoa), na ordem da escala
const pessoasDoDia = d => pessoas().filter(p => atendeNoDia(p, d))
  .map((p, i) => ({ p, i, k: posArea(p.amb.find(a => a.d === d).areas[0]), s: p.amb[0].d === d ? 0 : 1 }))
  .sort((a, b) => a.k - b.k || a.s - b.s || a.i - b.i).map(x => x.p);   // 2º dia de alguém vai depois dos titulares
const areasDoDia = d => { const s = []; PESSOAS.forEach(p => p.amb.forEach(a => { if (a.d === d) a.areas.forEach(x => { if (!s.includes(x)) s.push(x); }); })); return s.sort((x, y) => posArea(x) - posArea(y)); };

// lista plana (compatibilidade): uma linha por pessoa × dia × área, área em maiúsculas
const ESCALA = [];
PESSOAS.forEach(p => p.amb.forEach(a => a.areas.forEach(ar => ESCALA.push({ id: p.id, n: p.n, e: UP(ar), d: a.d, eq: p.eq ? 1 : 0 }))));

// texto digitado ("Dr Fernando", "salgado", "FERNANDO SALGADO") → pessoas que batem
// (todas as palavras com ≥3 letras precisam bater no início de alguma palavra do nome)
function achar(txt) {
  const q = semTitulo(txt).split(' ').filter(w => w.length >= 3 && !['DE', 'DA', 'DO', 'DOS', 'DAS'].includes(w));
  if (!q.length) return [];
  return pessoas().filter(p => {
    const w = semTitulo(p.n).split(' ');
    return q.every(t => w.some(x => x.startsWith(t)));
  });
}
// próxima data no dia da semana dw, com pelo menos minDias a partir de hoje (nunca hoje nem no passado)
function proximaData(dw, minDias, hoje) {
  const d = hoje ? new Date(hoje) : new Date(); d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + Math.max(1, parseInt(minDias, 10) || 0));
  if (dw >= 1 && dw <= 5) while (d.getDay() !== dw) d.setDate(d.getDate() + 1);
  return d;
}
// áreas (MAIÚSCULAS) e os dias em que cada uma tem ambulatório
function especialidades() {
  const m = new Map(); ESCALA.forEach(x => { if (!m.has(x.e)) m.set(x.e, new Set()); m.get(x.e).add(x.d); });
  return [...m.entries()].map(([e, s]) => ({ e, dias: [...s].sort() }));
}
const diasDaEspecialidade = e => [...new Set(ESCALA.filter(x => x.e === UP(e)).map(x => x.d))].sort();
const doDia = d => ESCALA.filter(x => x.d === d);
const fmt = d => String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();

G.SOTESCALA = { PESSOAS, ESCALA, PLURAL, ORD, CURTO, DIAS,
  pessoas, porId, atendeNoDia, diasDe, pessoasDoDia, areasDoDia, areasTxt,
  achar, proximaData, especialidades, diasDaEspecialidade, doDia, nomeSemTitulo, titulo, norm, fmt };
if (typeof module !== 'undefined') module.exports = G.SOTESCALA;
})(typeof window !== 'undefined' ? window : globalThis);
