/* SOT — DATAS: leitura e formatação de data num lugar só (dd/mm[/aa[aa]] ⇄ aaaa-mm-dd). */
(function (G) {
'use strict';
function p2(n) { return ('0' + n).slice(-2); }
function hojeISO() { var d = new Date(); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
// "13/11", "13/11/26", "13-11-2026" → aaaa-mm-dd (ano que falta = ano de referência)
function isoDeBR(s, ref) {
  var m = String(s || '').match(/(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?/); if (!m) return '';
  var y = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : String(ref || hojeISO()).slice(0, 4);
  return y + '-' + p2(m[2]) + '-' + p2(m[1]);
}
function br(iso) { if (!iso) return ''; var p = String(iso).slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
function brCurto(iso) { if (!iso) return ''; var p = String(iso).slice(0, 10).split('-'); return p[2] + '/' + p[1]; }
function addDia(iso, n) { var d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
function diasEntre(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5); }
G.SOTDATA = { hojeISO: hojeISO, isoDeBR: isoDeBR, br: br, brCurto: brCurto, addDia: addDia, diasEntre: diasEntre };
})(typeof window !== 'undefined' ? window : globalThis);
