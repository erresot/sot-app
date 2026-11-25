/* SOT — CONTADORES PELA DATA (v66). Um motor só para "N PO", "POI", "N d" (fratura, queda, déficit…), usado em:
   (1) conferência do internograma (o número escrito à mão bate com a data?),
   (2) mapa cirúrgico / linha de dados (texto já sai com o número do DIA DA CIRURGIA),
   (3) painel do internograma na Agenda.
   Regra: com data na linha → conta pela data. Sem data → soma os dias entre o internograma (ref) e o dia-alvo, e marca dúvida.
   Data sem ano só vale entre parênteses ou no fim da linha (nunca "1/3 distal"). */
(function (G) {
'use strict';
function dia0(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function dias(a, b) { return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 864e5); }
function data(s, ref) {
  var m = String(s).match(/(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?/); if (!m) return null;
  var y = m[3] ? +m[3] : ref.getFullYear(); if (y < 100) y += 2000;
  var d = new Date(y, +m[2] - 1, +m[1]); if (d.getMonth() !== +m[2] - 1) return null;
  if (!m[3] && dias(ref, d) > 200) d.setFullYear(y - 1);
  return d;
}
// data da linha, pela regra (com ano em qualquer lugar; sem ano só entre parênteses ou no fim)
// v67: só olha os 90 primeiros caracteres depois do contador (no PDF duas linhas podem vir grudadas); aceita dd-mm-aaaa
// v71: e, se não achou, a data entre parênteses no FIM da linha (descrições longas: "34 Po Rms … Quadril Esquerdo (21/10/2026)")
function dataDaLinha(resto, ref) {
  var fimL = String(resto).match(/\(\s*(\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?)\s*\)\s*\.?\s*$/);
  resto = resto.slice(0, 90);
  var h = resto.match(/\(?\s*(\d{1,2}-\d{1,2}-\d{4})/); if (h) return data(h[1], ref);
  var m = resto.match(/\(?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/) || resto.match(/\(\s*(\d{1,2}\/\d{1,2})\s*(?:\)|$)/) || resto.match(/(?:^|\s|-)(\d{1,2}\/\d{1,2})\s*\)?\s*\.?\s*$/);
  return m ? data(m[1], ref) : (fimL ? data(fimL[1], ref) : null);
}
var R_PO = /^(\s*[-–•]?\s*)(\d{1,3})(\s*d?\s*[º°]?\s*)(DPO|PO)\b/i, R_POI = /^(\s*[-–•]?\s*)(POI)\b/i, R_D = /^(\s*[-–•]?\s*)(\d{1,3})(\s*)(d)\b/i;
// lê o contador de UM trecho (linha). Devolve null se o trecho não começa com contador.
function ler(seg, ref) {
  var m, tipo, n, pre, fim;
  if ((m = seg.match(R_PO))) { tipo = 'po'; n = +m[2]; pre = m[1]; fim = m[0].length; }
  else if ((m = seg.match(R_POI))) { tipo = 'poi'; n = 0; pre = m[1]; fim = m[0].length; }
  else if ((m = seg.match(R_D))) { tipo = 'd'; n = +m[2]; pre = m[1]; fim = m[0].length; }
  else return null;
  return { tipo: tipo, n: n, m: m, pre: pre, fim: fim, d: dataDaLinha(seg.slice(fim), ref) };
}
// valor do contador no dia-alvo
// v67: data implausível (longe demais do número escrito) é tratada como "sem data" — evita "672º PO" de data da linha vizinha
function valor(c, ref, alvo) {
  var semData = { n: c.n + dias(ref, alvo), pelaData: false };
  if (c.d) {
    var n = dias(c.d, alvo);
    if (n < 0 || Math.abs(n - semData.n) > 10) return { n: semData.n, pelaData: false, dataEstranha: true };
    return { n: n, pelaData: true };
  }
  return semData;
}
function escrever(seg, c, n) {
  var m = c.m;
  if (c.tipo === 'poi') { if (n === 0) return seg; return m[1] + n + ' ' + (m[2] === 'POI' ? 'PO' : 'Po') + seg.slice(c.fim); }
  if (c.tipo === 'po' && n === 0) return m[1] + (m[4] === m[4].toUpperCase() ? 'POI' : 'Poi') + seg.slice(c.fim);
  return m[1] + n + seg.slice(m[1].length + m[2].length);
}
var SEP = /(\s+·\s+|\s+\/\s+|\n|\s+\|\s+)/;
// reescreve todos os contadores de um texto para o dia-alvo
function atualizarTexto(txt, ref, alvo) {
  var out = { txt: String(txt || ''), mudou: [], duvida: false };
  if (!txt || !ref || !alvo) return out;
  var partes = String(txt).split(SEP);
  for (var i = 0; i < partes.length; i += 2) {
    var seg = partes[i], c = ler(seg, ref); if (!c) continue;
    var v = valor(c, ref, alvo); if (!v || v.n === c.n && c.tipo !== 'poi') continue;
    var novo = escrever(seg, c, v.n); if (novo === seg) continue;
    partes[i] = novo; out.mudou.push({ de: seg, para: novo, pelaData: v.pelaData });
    if (!v.pelaData) out.duvida = true;
  }
  out.txt = partes.join('');
  return out;
}
// conferência: número escrito × número pela data, no dia do internograma (só linhas com data)
function conferir(linhas, ref) {
  var out = [];
  (linhas || []).forEach(function (l) {
    String(l).split(SEP).forEach(function (seg, i) {
      if (i % 2) return; var c = ler(seg, ref); if (!c || !c.d) return;
      var v = valor(c, ref, ref); if (!v || !v.pelaData || v.n === c.n) return;
      out.push({ seg: seg.trim(), tipo: c.tipo, escrito: c.tipo === 'poi' ? 'POI' : String(c.n), certo: v.n, data: c.d });
    });
  });
  return out;
}
G.SOTCONT = { atualizarTexto: atualizarTexto, conferir: conferir, ler: ler, dias: dias, data: data, dia0: dia0 };
})(typeof window !== 'undefined' ? window : this);
