/* SOT — identidade do paciente: UMA regra para o app todo (Agenda × internograma, foto × célula do mapa,
   troca de paciente no mesmo horário, reaproveitar dados). Na dúvida, NÃO junta: é melhor um paciente
   aparecer duas vezes do que os dados de um irem para o outro.
   - registro dos dois lados: vale o registro (diferente = outra pessoa)
   - idade dos dois lados com diferença > 1 ano: outra pessoa
   - nome: o 1º nome tem de ser igual (BENEDITA × BENEDITO, MARIA × MARIO = pessoas diferentes; só aceita
     erro de 1 letra em nome com 5+ letras que não seja troca de A/O no fim) e TODOS os nomes do nome mais
     curto têm de estar no outro (mínimo 2 nomes de cada lado). */
(function (G) {
  'use strict';
  var A = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase(); };
  var PART = /^(DE|DA|DO|DOS|DAS|E|DI|DU|DEL|VAN|VON|JR|JUNIOR|FILHO|NETO|SOBRINHO)$/;
  function tokens(nome) {
    return A(nome).replace(/[^A-Z ]/g, ' ').split(/\s+/).filter(function (w) { return w.length >= 2 && !PART.test(w); });
  }
  function genero(a, b) { return a.length === b.length && a.slice(0, -1) === b.slice(0, -1) && /[AO]/.test(a.slice(-1)) && /[AO]/.test(b.slice(-1)) && a !== b; }
  function lev1(a, b) {
    if (a === b) return true; if (Math.abs(a.length - b.length) > 1 || Math.min(a.length, b.length) < 5) return false;
    var i = 0, j = 0, d = 0;
    while (i < a.length && j < b.length) { if (a[i] === b[j]) { i++; j++; continue; } if (++d > 1) return false; if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; } }
    return d + (a.length - i) + (b.length - j) <= 1;
  }
  function igualPalavra(a, b) { return a === b || (lev1(a, b) && !genero(a, b)); }
  // 'mesmo' | 'diferente' | 'incerto'
  function mesmoNome(na, nb) {
    var a = tokens(na), b = tokens(nb);
    if (a.length < 2 || b.length < 2) {
      if (!a.length || !b.length) return 'incerto';
      return igualPalavra(a[0], b[0]) ? 'incerto' : 'diferente';
    }
    if (!igualPalavra(a[0], b[0])) return 'diferente';
    var curto = a.length <= b.length ? a : b, longo = curto === a ? b : a;
    var ok = curto.every(function (w) { return longo.some(function (z) { return igualPalavra(w, z); }); });
    return ok ? 'mesmo' : 'diferente';
  }
  function soDig(x) { return String(x || '').replace(/\D/g, ''); }
  function idadeDe(x) { var m = String(x || '').match(/\d{1,3}/); return m ? +m[0] : null; }
  /* a, b = {nome, reg (ou regs: []), idade}. Resposta: 'mesmo' | 'diferente' | 'conflito' (nome e idade iguais, registro diferente) | 'incerto' */
  function comparar(a, b) {
    var ra = [].concat(a.regs || [], a.reg || []).map(soDig).filter(function (n) { return n.length >= 4; });
    var rb = [].concat(b.regs || [], b.reg || []).map(soDig).filter(function (n) { return n.length >= 4; });
    var ia = idadeDe(a.idade), ib = idadeDe(b.idade);
    var idadeDif = ia != null && ib != null && Math.abs(ia - ib) > 1;
    var nm = mesmoNome(a.nome, b.nome);
    if (ra.length && rb.length) {
      if (ra.some(function (n) { return rb.indexOf(n) > -1; })) return nm === 'diferente' ? 'diferente' : 'mesmo';   // mesmo registro com nome de outra pessoa: não junta
      return nm === 'mesmo' && ia != null && ia === ib ? 'conflito' : 'diferente';
    }
    if (idadeDif) return 'diferente';
    return nm;
  }
  /* cabeçalho do mapa → {nome, reg, idade} ("NOME, 70a, P: 123456, cirurgia, Ass…") */
  function deCab(cab) {
    var u = A(cab);
    var m = u.match(/\bP\s*[:.]?\s*(\d{4,9})\b/) || u.match(/\b(?:REG(?:ISTRO)?|PRONT\w*|RGHC|HC)\s*[:.]?\s*(\d{4,9})\b/) || u.match(/\b\d{1,3}\s*(?:A|ANOS?)\b\.?\s*[,;\-]?\s*(\d{4,8})\b/) || u.match(/,\s*(\d{5,8})\s*(?:[,.]|$)/) || u.match(/\b(\d{6,7})\b/);
    var mi = u.match(/\b(\d{1,3})\s*(?:A|ANOS?)\b/);
    var nome = String(cab || '').split(/[,;(]|\s\d/)[0];
    return { nome: nome, reg: m ? m[1] : '', idade: mi ? mi[1] : '' };
  }
  /* identidade guardada na célula: "P123456|NMARIA APARECIDA LOPES|I73" (aceita os formatos antigos "P123456" e "NMARIA APARECIDA") */
  function ident(cab) { var o = deCab(cab); return [o.reg ? 'P' + o.reg : '', tokens(o.nome).length ? 'N' + tokens(o.nome).join(' ') : '', o.idade ? 'I' + o.idade : ''].filter(Boolean).join('|'); }
  function deIdent(s) { var o = { nome: '', reg: '', idade: '' }; String(s || '').split('|').forEach(function (p) { if (p[0] === 'P') o.reg = p.slice(1); else if (p[0] === 'N') o.nome = p.slice(1); else if (p[0] === 'I') o.idade = p.slice(1); }); return o; }
  var API = { tokens: tokens, mesmoNome: mesmoNome, comparar: comparar, deCab: deCab, ident: ident, deIdent: deIdent, lev1: lev1, genero: genero };
  G.SOTPESSOA = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof self !== 'undefined' ? self : this);
