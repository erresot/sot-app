/* SOT — MOLDES DO EVOLUIDOR (v86): um motor só para guardar, listar, apagar e juntar os moldes.
   Molde = a "evolução anterior" pronta, montada no Atendimento a partir da ficha do PS (enfermaria dia 0 ou retorno no
   ambulatório). O evoluidor usa o molde no lugar de colar a evolução à mão.
   Guardado primeiro no aparelho (localStorage 'sot-moldes-v1'); o app junta com o Drive (arquivo moldes.json na pasta do app)
   e todos os aparelhos veem os mesmos moldes. Apagado = lápide (some em todos). Some sozinho em 30 dias.
   Item: { id, em (ms da última mudança), criado (ms), pac, tipo:'enf'|'amb', titulo, txt, por, apagado? }   */
(function (G) {
  'use strict';
  var CHAVE = 'sot-moldes-v1', DIAS = 30, MS = 864e5;
  function agora() { return Date.now(); }
  function ler() { try { var L = JSON.parse(localStorage.getItem(CHAVE) || '[]'); return Array.isArray(L) ? L : []; } catch (e) { return []; } }
  function gravar(L) { try { localStorage.setItem(CHAVE, JSON.stringify(L)); } catch (e) {} }
  function avisar() { try { (window.top || window.parent).postMessage({ src: 'molde', type: 'molde-sinc' }, '*'); } catch (e) {} }
  // tira o que passou do prazo: molde com mais de 30 dias; lápide com mais de 45 (já chegou em todos)
  function limpar(L, t) {
    t = t || agora();
    return (L || []).filter(function (x) { return x && x.id && (x.apagado ? t - (x.em || 0) < (DIAS + 15) * MS : t - (x.criado || x.em || 0) < DIAS * MS); });
  }
  // junta duas listas pelo id: vale a mudança mais nova (apagar é uma mudança)
  function juntar(a, b) {
    var M = {};
    [].concat(a || [], b || []).forEach(function (x) { if (!x || !x.id) return; var y = M[x.id]; if (!y || (x.em || 0) > (y.em || 0)) M[x.id] = x; });
    return limpar(Object.keys(M).map(function (k) { return M[k]; })).sort(function (x, y) { return (y.criado || 0) - (x.criado || 0); });
  }
  function listar() { return limpar(ler()).filter(function (x) { return !x.apagado; }); }
  function salvar(m) {
    var t = agora(), x = { id: m.id || ('m' + t.toString(36) + Math.random().toString(36).slice(2, 6)), em: t, criado: m.criado || t,
      pac: String(m.pac || '').trim(), tipo: m.tipo === 'amb' ? 'amb' : 'enf', titulo: String(m.titulo || '').trim(), txt: String(m.txt || ''), por: m.por || '' };
    gravar(juntar(ler(), [x])); avisar(); return x;
  }
  function apagar(id) {
    var L = ler(), x = L.filter(function (y) { return y.id === id; })[0]; if (!x) return false;
    gravar(juntar(L, [{ id: id, em: agora() + 1, criado: x.criado, apagado: true }])); avisar(); return true;
  }
  function diasRestantes(x, t) { return Math.max(0, Math.ceil(((x.criado || x.em || 0) + DIAS * MS - (t || agora())) / MS)); }
  G.SOTMOLDES = { CHAVE: CHAVE, DIAS: DIAS, ler: ler, gravar: gravar, listar: listar, salvar: salvar, apagar: apagar, juntar: juntar, limpar: limpar, diasRestantes: diasRestantes };
  if (typeof module !== 'undefined' && module.exports) module.exports = G.SOTMOLDES;
})(typeof window !== 'undefined' ? window : globalThis);
