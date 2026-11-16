/* SOT — leitura de CMB / MUC / ALERGIA em textos escritos por pessoas (evoluções, fichas, laudos).
   Aceita: "MUC: x" · "MUC x" · "MUC:" com o valor na(s) linha(s) de baixo · "#MUC:", "##MUC", "- MUC -", "• MUC", "**MUC**:",
   "AP: …, NEGA ALERGIAS" · "NEGA ALERGIAS" solto · "**ALÉRGICO A VANCOMICINA**" · "SEM COMORBIDADES OU ALERGIAS CONHECIDAS".
   Uso: SOTCAMPOS.ap(texto) → {cmb, muc, alergia}   (strings; '' quando não achou) */
(function (G) {
  'use strict';
  var A = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase(); };
  // rótulos (sobre o texto sem acento, em maiúsculas)
  var ROT = [
    ['cmbx', /^(?:CMB|COMORBIDADES?|COMORB\.?|HPP|DOENCAS? (?:PREVIAS|DE BASE))\b/],
    ['ap', /^(?:R?AP|ANTECEDENTES(?: PESSOAIS)?(?: PATOLOGICOS)?(?: PESSOAIS)?|A\.P\.?)(?![A-Z])/],
    ['muc', /^(?:MUC|MEDICA(?:COES|CAO|MENTOS?)(?: (?:EM )?USO)?(?: (?:DE )?USO)?(?: CONTINUO| CONTINUA| CONTINUOS| CONTINUAS| DOMICILIAR(?:ES)?)?|MEDS?(?: EM USO)?)(?![A-Z])/],
    ['alergia', /^(?:ALERGI(?:AS?|CA|CO)S?|ALERGIC[OA]S?|AL\.)(?![A-Z])/]
  ];
  // começo de outra seção: encerra a leitura das linhas de baixo
  var OUTRA = /^(?:HMA|HDA|HPMA|QP|EF|EXAME|EVO|EVOLUCAO|CD|CONDUTA|HV|HF|HABITOS|VICIOS|CIRURGIAS?|INTERNA|ORIGEM|RX|RADIOGRAF|LAB|EXAMES|PROGRAMA|PLANO|HD|HIPOTESE|DIAGNOSTICO|ASS\b|CX\b|SOCIAL|TABAG|ETIL|PESO|ALTURA|JEJUM|AVALIO|PACIENTE\s+(?:VEM|DA|REFERE|ENCAMINH|PROVENIENTE)|TESTEMUNH|RELIGI)/;
  function semDecor(l) { return l.replace(/^[\s#*\-–—•·>|]+/, '').replace(/^\d{1,2}[).]\s+/, ''); }
  function limpa(v) {
    return String(v || '').replace(/\*\*/g, '').replace(/^[\s:=\-–—.]+/, '').replace(/[\s:;,.]+$/, '').replace(/\s{2,}/g, ' ').trim();
  }
  function rotulo(l) {   // → {campo, resto} ou null
    var s = semDecor(l), u = A(s);
    for (var i = 0; i < ROT.length; i++) {
      var m = u.match(ROT[i][1]); if (!m) continue;
      var resto = s.slice(m[0].length);
      // separador: ":" "-" "=" "–" ou só espaço; "MUC NEGA", "MUC: x", "MUC - x"
      if (resto && !/^\s*(?:\*\*)?\s*(?:[:=\-–—]|$|\s)/.test(resto)) continue;
      resto = resto.replace(/^\s*(?:\*\*)?\s*[:=\-–—]*\s*(?:\*\*)?\s*/, '');
      if (ROT[i][0] === 'alergia') resto = resto.replace(/^(?:A|À|AO|AOS|AS)\s+/i, '');
      return { campo: ROT[i][0], resto: resto };
    }
    return null;
  }
  function separador(l) { return /^\s*(?:[-–—_=.*]{1,}|#+)\s*$/.test(l); }
  function ap(texto) {
    var L = String(texto || '').replace(/\r/g, '').split('\n'), o = { cmbx: '', ap: '', muc: '', alergia: '' };
    var neg = { cmb: false, muc: false, alergia: false };
    for (var i = 0; i < L.length; i++) {
      var l = L[i], u = A(semDecor(l)).trim();
      if (!u) continue;
      // frases soltas
      if (/^(?:NEGA|SEM|NAO POSSUI|NAO TEM|DESCONHECE)\s+(?:COMORBIDADES?|CMB|DOENCAS)\s+(?:E|OU|,)\s+ALERGIAS?/.test(u)) { neg.cmb = true; neg.alergia = true; continue; }
      if (/^(?:NEGA|SEM|NAO POSSUI|NAO REFERE|NKDA)\s+(?:ALERGIAS?|ALERGIC)/.test(u) && u.length < 60) { neg.alergia = true; continue; }
      if (/^(?:NEGA|SEM)\s+(?:MUC|MEDICA(?:COES|CAO|MENTOS?)(?: (?:DE|EM) USO)?(?: CONTINUO)?)\b/.test(u) && u.length < 60) { neg.muc = true; continue; }
      if (/^(?:NEGA|SEM)\s+(?:COMORBIDADES?|CMB)\b/.test(u) && u.length < 50) { neg.cmb = true; continue; }
      var r = rotulo(l);
      if (!r) {
        var mA = A(l).match(/\bALERGIC[OA]S?\s+(?:A|AO|À|AS)\s+([^.*;\n]{3,60})/);   // "**ALÉRGICO A VANCOMICINA**" no meio do texto
        if (mA && !o.alergia) o.alergia = limpa(l.slice(A(l).indexOf(mA[1]), A(l).indexOf(mA[1]) + mA[1].length));
        continue;
      }
      var v = limpa(r.resto), mais = [];
      if (!v || /^(?:#|$)/.test(v)) {   // valor nas linhas de baixo
        for (var k = i + 1; k < L.length && k < i + 9; k++) {
          var t = L[k], tu = A(semDecor(t)).trim();
          if (!tu) { if (mais.length) break; else continue; }
          if (separador(t) || /^\s*#/.test(t) || rotulo(t) || OUTRA.test(tu)) break;
          if (r.campo !== 'ap' && /^(?:NEGA|SEM)\s+(?:ALERG|MUC|MEDICA|CMB|COMORB)/.test(tu) && mais.length) break;
          if ((r.campo === 'ap' || r.campo === 'cmbx') && /^(?:NEGA\s+(?:TABAG|ETIL|VICIO|DROG|USO DE)|EX[- ]?TABAG|TABAGISTA|ETILISTA|EXPOSICAO)/.test(tu)) continue;
          var item = limpa(semDecor(t)), bala = /^\s*[-–—•·*]/.test(t);
          // linha quebrada no meio da frase (sem marcador e a anterior não terminou): junta com espaço
          if (mais.length && !bala && !/[.;:,/]\s*$/.test(L[k - 1]) && L[k - 1].trim().length > 45) mais[mais.length - 1] += ' ' + item;
          else if (mais.length && !bala && /[,/]\s*$/.test(L[k - 1])) mais[mais.length - 1] += ' ' + item;
          else mais.push(item);
          if (r.campo === 'alergia' && mais.length >= 2) break;
        }
        v = mais.join(' / ').replace(/([,/])\s*\/\s*/g, '$1 ');
      }
      if (!v) continue;
      // "HAS, DM2, NEGA ALERGIAS" · "NEGA COMORBIDADES / NEGA ALERGIAS / NEGA MUC"
      var partes = v.split(/\s*(?:[,;/]|\s-\s|\.\s)\s*(?=(?:NEGA|SEM)\b)/i), fica = [];
      partes.forEach(function (p) {
        var pu = A(p).trim();
        if (/^(?:NEGA|SEM)\s+ALERG/.test(pu) && r.campo !== 'alergia') neg.alergia = true;
        else if (/^(?:NEGA|SEM)\s+(?:MUC|MEDICA)/.test(pu) && r.campo !== 'muc') neg.muc = true;
        else if (/^(?:NEGA|SEM)\s+(?:CMB|COMORB)/.test(pu) && r.campo !== 'cmbx' && r.campo !== 'ap') neg.cmb = true;
        else fica.push(p.trim());
      });
      v = limpa(fica.join(', '));
      if (/^(?:NEGA|NEGO|NEGATIVO|NENHUMA?|NAO|SEM|NKDA)\b\.?(?:\s+(?:ALERGIAS?|ALERGICOS?|COMORBIDADES|MEDICAMENTOS[AO]S?|USO DE MEDICA\w*))*\s*$/i.test(A(v))) v = 'NEGA';
      if (v && !o[r.campo]) o[r.campo] = v;
    }
    var cmb = o.cmbx || o.ap || (neg.cmb ? 'NEGA' : '');
    if (/^(?:POT?\b|\d+\s*PO\b)/.test(A(cmb)) && o.cmbx) cmb = o.cmbx;
    return { cmb: cmb, muc: o.muc || (neg.muc ? 'NEGA' : ''), alergia: o.alergia || (neg.alergia ? 'NEGA' : '') };
  }
  var API = { ap: ap, rotulo: rotulo };
  G.SOTCAMPOS = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof self !== 'undefined' ? self : this);
