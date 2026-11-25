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
// v71→v72: rótulo da data de internação (no motor: usado pelo leitor do internograma e pelo motor)
var RX_ROT_DIH = '(?:dih|d\\.?\\s?i\\.?|data\\s+(?:de\\s+)?interna[cç][aã]o|interna[cç][aã]o|internou(?:\\s+em)?)';
var RE_DIH_DATA = new RegExp('(?:^|\\s)' + RX_ROT_DIH + '\\s*:?\\s*(\\d{1,2}\\/\\d{1,2}(?:\\/\\d{2,4})?)', 'i');
var RE_DIH_DATA_LINHA = new RegExp('^' + RX_ROT_DIH + '\\s*:?\\s*(\\d{1,2}\\/\\d{1,2}(?:\\/\\d{2,4})?)$', 'i');
// v72: linha de trauma (mecanismo) e fim de bloco
var RX_TRAUMA = /\b(?:queda|qda|qpa|caiu|acid|acidente|atropel\w*|preens[aã]o|agress\w*|colis[aã]o|ferimento|paf|faf|trauma\w*|capot\w*|mordedura|entorse|tor[cç][aã]o|esmagamento|chute|coice|pisote\w*)\b/i;
var RX_FX = /^\s*(?:fx|fratura|luxa[cç][aã]o)\b/i;
var RX_FIM_BLOCO = /^\s*(?:[-–—_.]+\s*$|$|pot\b|po\b|p[oó]s[- ]?op|ap\b|ap:|muc\b|muc:|alergi|comorb|ass\b|ass\.|hda\b|hpp\b|cd\b|cd:|conduta|programa|orienta|nega\b)/i;
// todas as datas de um texto, em ordem (mesma regra: com ano em qualquer lugar; sem ano só entre parênteses ou no fim)
function datasDe(t, ref) {
  t = String(t || ''); var out = [], m, rx = /(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?/g;
  while ((m = rx.exec(t))) {
    var antes = t.slice(0, m.index), depois = t.slice(m.index + m[0].length);
    if (/\d$/.test(antes) || /^[\d\/-]/.test(depois)) continue;
    if (!m[3] && !(/\(\s*$/.test(antes) && /^\s*\)/.test(depois)) && !/^\s*\)?\s*\.?\s*$/.test(depois)) continue;   // sem ano: só (dd/mm) ou no fim
    var d = data(m[0], ref); if (d) out.push(d);
  }
  return out;
}
var R_PO = /^(\s*[-–•]?\s*)(\d{1,3})(\s*d?\s*[º°]?\s*)(DPO|P[OÓ])(?![A-Za-zÀ-ÿ])/i,   // v72: "Pó" (acento) também é PO
    R_POI = /^(\s*[-–•]?\s*)(POI)\b/i, R_D = /^(\s*[-–•]?\s*)(\d{1,3})(\s*)(d)\b/i;
// lê o contador de UM trecho (linha). Devolve null se o trecho não começa com contador.
function ler(seg, ref) {
  var m, tipo, n, pre, fim;
  if ((m = seg.match(R_PO))) { tipo = 'po'; n = +m[2]; pre = m[1]; fim = m[0].length; }
  else if ((m = seg.match(R_POI))) { tipo = 'poi'; n = 0; pre = m[1]; fim = m[0].length; }
  else if ((m = seg.match(R_D))) { tipo = 'd'; n = +m[2]; pre = m[1]; fim = m[0].length; }
  else return null;
  return { tipo: tipo, n: n, m: m, pre: pre, fim: fim, d: dataDaLinha(seg.slice(fim), ref) };
}
// v72: lê os contadores de uma CÉLULA (linhas em ordem). Contador sem data na própria linha procura a data:
//  (1) no seu BLOCO — linhas de baixo até: linha vazia, "-", outro contador ou rótulo (Ap:, Muc:, Ass…); limite de segurança 12 linhas
//      (listas longas de fraturas terminam na data do trauma);
//      contador de PO não atravessa linha de trauma/fratura (essa data não é a da cirurgia);
//  (2) só para "N d": na data do mecanismo do trauma (opc.mecanismo: linhas da 1ª coluna; nunca a data de internação).
//  O bloco é UMA coisa só (fraturas + trauma do mesmo evento): a data do bloco vale como a da própria linha (±10, avisa atraso).
//  Bloco para também em "Pot…", "Po…", "Pós-op…" (outro item). Validado nos internogramas reais: a equipe corrigiu para a data do bloco.
//  Trava estrita: a data da 1ª coluna (fora da célula) só vale se bater com o escrito: ±1 na própria linha do trauma; data SOZINHA
//  na linha de baixo (pode ser a de internação sem rótulo) só se bater exato. Senão: "confira" + nota.
function ddmm(d) { return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2); }
function partes(x) { return [].concat(x || []).reduce(function (a, t) { return a.concat(String(t == null ? '' : t).split(/\s+·\s+|\s+\/\s+|\n|\s+\|\s+/)); }, []); }
function analisar(linhas, ref, opc) {
  opc = opc || {}; var L = [].concat(linhas || []).map(function (t) { return String(t == null ? '' : t); }), out = [];
  for (var i = 0; i < L.length; i++) {
    var c = ler(L[i], ref); if (!c) continue;
    c.i = i; c.fonte = c.d ? 'linha' : null; c.nota = '';
    if (!c.d) {
      var cand = null, fonte = null, outra = false;
      for (var j = i + 1; j < L.length && j <= i + 12; j++) {
        var t = L[j]; if (!t.trim() || ler(t, ref) || RX_FIM_BLOCO.test(t)) break;
        if (c.tipo !== 'd' && (RX_TRAUMA.test(t) || RX_FX.test(t))) break;   // PO: a data do trauma/fratura não é a da cirurgia
        var ds = datasDe(t.replace(RE_DIH_DATA, ' '), ref); if (ds.length) { cand = ds[0]; fonte = 'bloco'; break; }
      }
      if (!cand && c.tipo === 'd') { var M = partes(opc.mecanismo);   // mecanismo da 1ª coluna: linha do trauma + até 2 linhas (quebra de linha)
        M.some(function (t, k) { if (!RX_TRAUMA.test(t)) return false;
          for (var q = k; q < M.length && q <= k + 2; q++) {
            var u = M[q]; if (q > k && (!u.trim() || RE_DIH_DATA_LINHA.test(u.trim()) || /^\s*\d{3,4}[a-z]?\s*$/i.test(u) || RE_DIH_DATA.test(u))) break;
            var ds = datasDe(u.replace(RE_DIH_DATA, ' '), ref); if (ds.length) { cand = ds[0]; fonte = 'mecanismo'; outra = q > k ? 'exato' : true; return true; }
          } return false; }); }
      if (cand) {
        var nRef = dias(cand, ref), dif = nRef - c.n;
        // data sozinha abaixo do mecanismo pode ser a de internação: só se bater exato
        if (nRef >= 0 && Math.abs(dif) <= (outra === 'exato' ? 0 : outra ? 1 : 10)) { c.d = cand; c.fonte = fonte; if (dif) c.nota = 'escrito ' + c.n + ', pela data (' + ddmm(cand) + ') seria ' + nRef; }
        else c.nota = (fonte === 'bloco' ? 'data na linha de baixo ' : 'data do trauma ') + ddmm(cand) + ' daria ' + nRef + ' (escrito ' + c.n + ') — não usei';
      }
    } else {
      var nR = dias(c.d, ref); if (nR >= 0 && nR !== c.n && Math.abs(nR - c.n) <= 10) c.nota = 'escrito ' + c.n + ', pela data (' + ddmm(c.d) + ') seria ' + nR;
    }
    out.push(c);
  }
  return out;
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
// v72: atualiza as linhas de uma célula para o dia-alvo → [{ i, de, para, pelaData, fonte, nota }] (só as que mudam)
function atualizarLinhas(linhas, ref, alvo, opc) {
  var L = [].concat(linhas || []).map(String), out = [];
  if (!ref || !alvo) return out;
  analisar(L, ref, opc).forEach(function (c) {
    var v = valor(c, ref, alvo); if (!v || v.n === c.n && c.tipo !== 'poi') return;
    var novo = escrever(L[c.i], c, v.n); if (novo === L[c.i]) return;
    out.push({ i: c.i, de: L[c.i], para: novo, pelaData: v.pelaData, fonte: v.pelaData ? c.fonte : null, nota: c.nota, dataEstranha: !!v.dataEstranha });
  });
  return out;
}
// reescreve todos os contadores de um texto para o dia-alvo (o texto é uma célula: lê por bloco)
function atualizarTexto(txt, ref, alvo, opc) {
  var out = { txt: String(txt || ''), mudou: [], duvida: false };
  if (!txt || !ref || !alvo) return out;
  var pt = String(txt).split(SEP), segs = [];
  for (var i = 0; i < pt.length; i += 2) segs.push(pt[i]);
  atualizarLinhas(segs, ref, alvo, opc).forEach(function (x) {
    pt[x.i * 2] = x.para; out.mudou.push(x); if (!x.pelaData) out.duvida = true;
  });
  out.txt = pt.join('');
  return out;
}
// conferência: número escrito × número pela data, no dia do internograma (só linhas com data)
function conferir(linhas, ref, opc) {   // v72: lê por bloco (data na linha de baixo / do trauma, com as travas do analisar)
  var out = [], L = partes(linhas);
  analisar(L, ref, opc).forEach(function (c) {
    if (!c.d) return; var v = valor(c, ref, ref); if (!v || !v.pelaData || v.n === c.n) return;
    out.push({ seg: L[c.i].trim(), tipo: c.tipo, escrito: c.tipo === 'poi' ? 'POI' : String(c.n), certo: v.n, data: c.d, fonte: c.fonte });
  });
  return out;
}
G.SOTCONT = { atualizarTexto: atualizarTexto, atualizarLinhas: atualizarLinhas, analisar: analisar, conferir: conferir, ler: ler, dias: dias, data: data, dia0: dia0, datasDe: datasDe,
  RE_DIH_DATA: RE_DIH_DATA, RE_DIH_DATA_LINHA: RE_DIH_DATA_LINHA, RX_TRAUMA: RX_TRAUMA };
})(typeof window !== 'undefined' ? window : this);
