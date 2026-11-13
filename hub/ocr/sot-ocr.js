/* SOT OCR — leitura de fichas HCFAMEMA (Tesseract local)
   Usado pelo Novo Paciente e pelo Mapa Cirúrgico (Fotos dos ambulatoriais).
   - pré-processamento: escala 2000 px + remoção de sombra/fundo + contraste
   - 2ª leitura só do cabeçalho (ampliado) para nome / registro / idade
   - correção de exames: nomes (POR→PCR…), números (O→0, l→1), vírgula perdida (K48→4,8?)
*/
(function(G){
'use strict';
var S={};
var deacc=S.deacc=function(s){return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'');};
function lev(a,b){var m=a.length,n=b.length,d=[],i,j;for(i=0;i<=m;i++){d[i]=[i];}for(j=1;j<=n;j++)d[0][j]=j;
  for(i=1;i<=m;i++)for(j=1;j<=n;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[m][n];}
S.lev=lev;

/* ---------------- imagem ---------------- */
function boxBlur(src,w,h,r){var out=new Float32Array(w*h),tmp=new Float32Array(w*h),x,y,s,o;
  for(y=0;y<h;y++){s=0;o=y*w;for(x=-r;x<=r;x++)s+=src[o+Math.min(w-1,Math.max(0,x))];
    for(x=0;x<w;x++){tmp[o+x]=s/(2*r+1);s+=src[o+Math.min(w-1,x+r+1)]-src[o+Math.max(0,x-r)];}}
  for(x=0;x<w;x++){s=0;for(y=-r;y<=r;y++)s+=tmp[Math.min(h-1,Math.max(0,y))*w+x];
    for(y=0;y<h;y++){out[y*w+x]=s/(2*r+1);s+=tmp[Math.min(h-1,y+r+1)*w+x]-tmp[Math.max(0,y-r)*w+x];}}
  return out;}
function limpar(p,w,h){
  var n=w*h,g=new Float32Array(n),i,v;
  for(i=0;i<n;i++)g[i]=(p[i*4]*299+p[i*4+1]*587+p[i*4+2]*114)/1000;
  var bg=boxBlur(g,w,h,Math.max(15,Math.round(Math.min(w,h)/40)));
  var hist=new Uint32Array(256);
  for(i=0;i<n;i++){v=g[i]/Math.max(1,bg[i])*235;v=v>255?255:v<0?0:v;g[i]=v;hist[v|0]++;}
  var lo=0,hi=255,a=0;for(i=0;i<256;i++){a+=hist[i];if(a>n*.01){lo=i;break;}}
  a=0;for(i=255;i>=0;i--){a+=hist[i];if(a>n*.03){hi=i;break;}}
  var k=255/Math.max(1,hi-lo);
  for(i=0;i<n;i++){v=(g[i]-lo)*k;v=v<0?0:v>255?255:v;p[i*4]=p[i*4+1]=p[i*4+2]=v;}
}
/* img: HTMLImageElement/Canvas/ImageBitmap; rot em graus; alvo = lado maior */
S.prep=function(img,rot,alvo,semLimpar){
  rot=rot||0;alvo=alvo||2000;
  var sw=img.naturalWidth||img.width,sh=img.naturalHeight||img.height,long=Math.max(sw,sh);
  var sc=alvo/long;if(sc>2.5)sc=2.5;
  var w=Math.round(sw*sc),h=Math.round(sh*sc),c=document.createElement('canvas'),gira=rot%180!==0;
  c.width=gira?h:w;c.height=gira?w:h;
  var g=c.getContext('2d');g.imageSmoothingQuality='high';g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);
  g.translate(c.width/2,c.height/2);g.rotate(rot*Math.PI/180);g.drawImage(img,-w/2,-h/2,w,h);g.setTransform(1,0,0,1,0,0);
  if(!semLimpar){var d=g.getImageData(0,0,c.width,c.height);limpar(d.data,c.width,c.height);g.putImageData(d,0,0);}
  return c;
};
S.cabecalho=function(c,frac,k){
  frac=frac||0.15;k=k||1.6;var hh=Math.round(c.height*frac),cc=document.createElement('canvas');
  cc.width=Math.round(c.width*k);cc.height=Math.round(hh*k);
  var g=cc.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(c,0,0,c.width,hh,0,0,cc.width,cc.height);return cc;
};

/* ---------------- Tesseract ---------------- */
var WK=null,WKp=null;
function loadScript(src){return new Promise(function(ok,er){var e=document.createElement('script');e.src=src;e.onload=ok;e.onerror=er;document.head.appendChild(e);});}
S.base=function(){var s=document.currentScript&&document.currentScript.src;return S._base||(S._base=new URL('ocr/',location.href).href);};
S.worker=function(logger){
  if(WK)return Promise.resolve(WK);if(WKp)return WKp;
  var base=S.base(),local=true;
  WKp=(G.Tesseract?Promise.resolve():loadScript(base+'tesseract.min.js').catch(function(){local=false;return loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');}))
  .then(function(){
    var opt={cacheMethod:'none',logger:function(m){if(S.logger)S.logger(m);}};
    if(local){opt.workerPath=base+'worker-wrap.js';opt.corePath=base+'core/';opt.langPath=base+'lang';opt.workerBlobURL=false;opt.gzip=true;}
    return G.Tesseract.createWorker('por',1,opt);
  }).then(function(w){WK=w;return w;},function(e){WKp=null;throw e;});
  if(logger)S.logger=logger;
  return WKp;
};
/* lê uma imagem já preparada (canvas). Retorna {text,data,hdr} */
S.ler=function(c,opt){
  opt=opt||{};
  return S.worker().then(function(w){
    return w.setParameters({tessedit_pageseg_mode:'3',preserve_interword_spaces:'0'}).then(function(){return w.recognize(c);})
    .then(function(r){
      if(opt.semCab)return {text:r.data.text,data:r.data,hdr:''};
      return w.setParameters({tessedit_pageseg_mode:'6'}).then(function(){return w.recognize(S.cabecalho(c));})
        .then(function(h){return {text:r.data.text,data:r.data,hdr:h.data.text};});
    });
  });
};
/* linhas de identificação do cabeçalho ampliado (Paciente / Idade / Nascimento / Atendimento) */
S.linhasCab=function(hdr){
  return String(hdr||'').split('\n').map(function(l){l=l.replace(/^[^A-Za-zÀ-ÿ0-9]+/,'').trim();return l.replace(/^[A-Za-z]{0,4}iente\s+(?=\d{5,})/i,'Paciente ');})
    .filter(function(l){var u=deacc(l).toUpperCase();return /PACIENTE\s*:?\s*\d{5,}|\bIDADE\s*:?\s*\d|NASCIMENTO\s*:?\s*\d|ATENDIMENTO\s+EM\s+\d/.test(u);});
};
function notaPac(l){var u=deacc(l).toUpperCase(),m=u.match(/PACIENTE\s*:?\s*(\S+)\s+(.*?)(?=\s{2,}|\s+IDADE\b|$)/);if(!m)return 0;
  var n=0;if(/^\d{6,7}$/.test(m[1]))n+=3;else if(/^\d{5,9}$/.test(m[1]))n+=1;
  var nm=m[2].trim();if(nm.length>=6)n+=1;if(/^[A-Z' ]+$/.test(nm))n+=2;n+=Math.min(3,nm.split(' ').length)*0.1;return n;}
function limpaPac(l){
  var m=l.match(/^(.*?Paciente\s*:?\s*)([\dOIl|]{5,9})\s+(.*)$/i);if(!m)return l;
  var resto=m[3],id=resto.match(/\bIdade\s*:?\s*\d{1,3}/i),nome=(id?resto.slice(0,id.index):resto).split(/\s{2,}/)[0];
  var ws=nome.replace(/[^A-Za-zÀ-ÿ' ]/g,' ').trim().split(/\s+/),k=ws.length;
  while(k>1&&(ws[k-1]!==ws[k-1].toUpperCase()||(ws[k-1].length<3&&!/^(DE|DA|DO|DOS|DAS|E)$/.test(ws[k-1]))))k--;
  return 'Paciente '+m[2].replace(/O/g,'0').replace(/[Il|]/g,'1')+'   '+ws.slice(0,k).join(' ')+(id?'   '+id[0]:'');
}
/* junta o cabeçalho ao texto principal: substitui a linha "Paciente ..." ruim pela do cabeçalho */
S.juntar=function(text,hdr){
  var L=S.linhasCab(hdr);if(!L.length)return String(text).split('\n').map(function(l){return /^\W{0,3}Paciente\s*:?\s*[\dOIl|]{5,9}\s/i.test(l)?limpaPac(l):l;}).join('\n');
  var lines=String(text).split('\n'),out=[],trocou=false;
  var pac=L.filter(function(l){return /PACIENTE/i.test(deacc(l));})[0];
  lines.forEach(function(l){
    var u=deacc(l).toUpperCase();
    if(pac&&!trocou&&/PACIENTE\s*\S{0,3}\s*[\d—\-~T]{4,}/.test(u)&&u.indexOf('PACIENTE')<12){var esc=notaPac(l)>=notaPac(pac)?l:pac,id=deacc(pac).toUpperCase().match(/IDADE\s*:?\s*\d{1,3}/);
      if(esc===l&&id&&!/IDADE/.test(u))esc=l.replace(/\s+$/,'')+'   '+id[0].replace(/^IDADE/,'Idade');out.push(limpaPac(esc));trocou=true;return;}
    out.push(l);
  });
  if(pac&&!trocou)out.unshift(limpaPac(pac));
  L.forEach(function(l){if(l===pac)return;var u=deacc(l).toUpperCase().replace(/\s+/g,' ');
    if(!lines.some(function(x){return deacc(x).toUpperCase().replace(/\s+/g,' ').indexOf(u.slice(0,24))>=0;}))out.splice(1,0,l);});
  return out.join('\n');
};

/* limpeza geral do texto lido */
S.limparTexto=function(t){
  return String(t||'').normalize('NFC').replace(/ﬁ/g,'fi').replace(/ﬂ/g,'fl')
    .replace(/([A-ZÀ-Ý]{2})!(?=[\s.,;:)]|$)/gm,'$1I')          // ANTONIASS! → ANTONIASSI
    .replace(/(?<=[A-Za-zÀ-ÿ])\|(?=[A-Za-zÀ-ÿ])/g,'I');
};
/* pipeline de texto completo: cabeçalho + limpeza + exames */
S.posTexto=function(text,hdr){var t=S.limparTexto(hdr?S.juntar(text,S.limparTexto(hdr)):text);return S.corrigirLabs(t);};

/* ---------------- exames ---------------- */
/* chave do mapa, nomes aceitos, faixa plausível (para recolocar vírgula perdida) */
var LAB=[
 ['Hb',['HB','HGB','HEMOGLOBINA','HG'],[3,22]],
 ['Ht',['HT','HCT','HTC','HEMATOCRITO'],[10,65]],
 ['Leuco',['LEUCOCITOS','LEUCOS','LEUCO','LEUC','LEU','GB'],[500,80000]],
 ['Plaq',['PLAQUETAS','PLAQ','PLQ','PLT'],null],
 ['TP',['TAP','TP','RNI%'],[8,150]],
 ['INR',['INR','RNI'],[0.5,9]],
 ['TTPA',['TTPA','TTPAR','KPTT','TTP'],[15,180]],
 ['Fib',['FIBRINOGENIO','FIBRIN','FIBRINO','FIB'],[60,1500]],
 ['Cr',['CREATININA','CREAT','CR'],[0.1,15]],
 ['Ur',['UREIA','UR','U'],[3,400]],
 ['Na',['SODIO','NA'],[110,170]],
 ['K',['POTASSIO','K'],[1.8,8.5]],
 ['Glic',['GLICEMIA','GLICOSE','GLIC','GLI','GJ','DEXTRO','HGT'],[20,700]],
 ['PCR',['PCR'],[0,700]],
 ['TSH',['TSH'],[0.01,15]],
 ['T4L',['T4L','T4 L','T4LIVRE'],[0.1,6]],
 ['TGO',['TGO','AST'],[3,3000]],
 ['TGP',['TGP','ALT'],[3,3000]],
 ['HbA1c',['HBA1C','HB A1C','A1C','HBGLICADA'],[3,20]],
 ['Mg',['MAGNESIO','MG'],[0.5,6]],
 ['Ca',['CALCIO','CAI','CA'],[0.5,16]],
 ['VHS',['VHS'],[0,150]],
 ['Alb',['ALBUMINA','ALB'],[1,6]],
 ['Lac',['LACTATO','LAC'],[0.2,20]],
 ['CPK',['CPK','CK'],[5,100000]]
];
S.MAPA_LABS=['Hb','Ht','Leuco','Plaq','TP','INR','TTPA','Fib','Cr','Ur','Na','K','Glic'];
var ALIAS=[];LAB.forEach(function(l){l[1].forEach(function(a){ALIAS.push([a,l[0],l[2]]);});});
ALIAS.sort(function(a,b){return b[0].length-a[0].length;});
var KEYRANGE={};LAB.forEach(function(l){KEYRANGE[l[0]]=l[2];});
var PALAVRAS_NAO_LAB=/^(EM|DE|DA|DO|PARA|COM|SEM|E|A|O|OK|PRE|OPS?|DIA|MIL|DATA)$/;

/* separa "NOME valor" num segmento; tolera nome colado ao número e 1 erro de letra */
function segmento(seg){
  var s=deacc(seg).toUpperCase().replace(/^[^A-Z0-9]+/,'').replace(/\s+/g,' ').replace(/^([A-Z])\.(?=[A-Z])/,'$1');
  if(!s)return null;
  var i,a,resto,nome=null,key=null,rng=null,fuzzy=false;
  for(i=0;i<ALIAS.length;i++){a=ALIAS[i][0];
    if(s.indexOf(a)===0){var nx=s.charAt(a.length);if(nx===''||/[\s:=.\-0-9OIL|]/.test(nx)){
      // "U" e "K" só se seguidos de número
      resto=s.slice(a.length).replace(/^[\s:=.\-]+/,'');
      if(/^[0-9OIL|]/.test(resto)&&/\d/.test(resto.slice(0,4))){nome=a;key=ALIAS[i][1];rng=ALIAS[i][2];break;}
    }}}
  if(!key){ // fuzzy: palavra de letras + número
    var m=s.match(/^([A-Z][A-Z0-9]{1,9})\s*:?\s*([0-9OIL|][0-9OIL|.,]*.*)$/);
    if(m&&m[1].length>=3&&!PALAVRAS_NAO_LAB.test(m[1])&&/\d/.test(m[2].slice(0,3))){
      var best=null,bd=9;ALIAS.forEach(function(x){if(x[0].length<3||Math.abs(x[0].length-m[1].length)>1)return;var d=lev(m[1],x[0]);if(d<bd){bd=d;best=x;}});
      if(best&&bd===1){nome=best[0];key=best[1];rng=best[2];resto=m[2];fuzzy=true;}
    }
  }
  if(!key)return null;
  // número
  var mv=resto.match(/^([0-9OIL|][0-9OIL|]*(?:[.,][0-9OIL|]+)*)\s*(%|MIL|K\b|S\b|SEG)?/);
  if(!mv)return null;
  var bruto=mv[1].replace(/O/g,'0').replace(/[IL|]/g,'1');
  var mz=resto.match(/^(\d)[ZSB](\d+(?:[.,]\d+)?)/);if(mz&&bruto.length<=1){bruto=mz[1]+mz[2];mv=[mz[0],bruto,''];fuzzy=true;}
  var suf=mv[2]||'',duv=fuzzy;
  return {key:key,nome:nome,val:bruto,suf:suf,rng:rng,duv:duv,resto:resto.slice(mv[0].length)};
}
function num(v){var s=v;if(/^\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,'');return parseFloat(s.replace(',','.'));}
/* confere faixa; recoloca vírgula perdida */
function conferir(o){
  if(!o.rng||o.key==='Plaq')return o;
  var n=num(o.val),lo=o.rng[0],hi=o.rng[1];
  if(o.suf==='%'&&o.key==='TP')return o;
  if(isNaN(n))return o;
  if(n>=lo&&n<=hi)return o;
  var dig=o.val.replace(/[.,]/g,'');
  if(!/[.,]/.test(o.val)||/^\d+[.,]\d+$/.test(o.val)){
    var cands=[];for(var p=1;p<dig.length;p++){var c=dig.slice(0,p)+','+dig.slice(p),x=parseFloat(c.replace(',','.'));if(x>=lo&&x<=hi)cands.push(c);}
    if(cands.length){o.val=cands[0];o.duv=true;return o;}
  }
  o.duv=true;return o;
}
function fmtVal(o){
  var v=o.val;
  if(o.key==='Plaq'){var n=num(v);if(/MIL|K/.test(o.suf))return Math.round(n)+'k';if(n>=1000)return Math.round(n/1000)+'k';if(n>=10&&n<1000)return Math.round(n)+'k';return v;}
  v=v.replace('.',',');
  return v+(o.suf==='%'&&o.key==='TP'?'%':'');
}
var RE_PRE=/^\s*((?:(?:PR[ÉE]\s*-?\s*OPS?|LABS?|LABORAT[ÓO]RIO|EXAMES?)[^:0-9(]*(?:\(?\s*\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s*\)?)?|\(?\s*\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s*\)?(?=\s*[:\-]))\s*[:.\-]?\s*)/i;
function nSeg(l){var n=0,c=l.replace(RE_PRE,'');c.split(/\/|;|\s\|\s/).forEach(function(s){if(segmento(s))n++;});return n;}
/* marca as linhas de exames (inclui continuação da linha anterior) */
S.linhasLab=function(lines){var prev=false;return lines.map(function(l){var ok=S.ehLinhaLab(l)||(prev&&nSeg(l)>=1&&!!segmento(l.replace(RE_PRE,'').split('/')[0]));prev=ok||(prev&&!l.trim());return ok;});};
function sepLab(c){
  var nomes=ALIAS.map(function(a){return a[0];}).filter(function(a){return a.length>=2&&!/\s/.test(a);}).join('|');
  c=c.replace(/\s\|\s/g,' / ');
  c=c.replace(new RegExp('(\\d%?)\\s*[|Il]\\s*(?=(?:'+nomes+')\\s?:?\\s?[0-9OIl])','g'),'$1 / ');
  c=c.replace(new RegExp('(\\d%?)\\s+(?=(?:'+nomes+')\\s?:?\\s?[0-9OIl])','gi'),'$1 / ');
  return c;
}
S.ehLinhaLab=function(l){
  var u=deacc(l).toUpperCase();
  if(/^\s*(PRE\s*-?\s*OPS?|LABS?|LABORATORIO|EXAMES?)\b/.test(u)&&/\d/.test(u))return true;
  var n=nSeg(l);if(n>=3)return true;
  if(n>=2){var tot=l.replace(RE_PRE,'').split(/\/|;|\s\|\s/).filter(function(x){return x.trim().length>1;}).length;return tot===n;}
  return false;
};
/* corrige as linhas de exames do texto (para mostrar ao usuário) */
S.corrigirLabs=function(text){
  var mud={};
  var arr=String(text).split('\n'),lab=S.linhasLab(arr);
  var out=arr.map(function(l,ix){
    if(!lab[ix])return l;
    var pre=l.match(RE_PRE);
    var cab=pre?pre[1]:'',corpo=l.slice(cab.length);
    // nome colado ao número, "|" no lugar de "/"
    corpo=sepLab(corpo);
    var segs=corpo.split('/').map(function(s){
      var o=segmento(s);if(!o)return s.trim();
      o=conferir(o);
      var t=o.nome+' '+(o.key==='Plaq'?o.val:o.val.replace('.',','))+o.suf+(o.duv?'?':'');
      var orig=s.trim();if(deacc(orig).toUpperCase().replace(/\s/g,'')!==deacc(t).toUpperCase().replace(/\s/g,''))mud[t]=orig;
      return t+(o.resto&&o.resto.trim().length>1?' '+o.resto.trim():'');
    });
    return cab+segs.filter(function(s){return s;}).join(' / ');
  });
  return {text:out.join('\n'),fixed:mud};
};
function dataBR(s,ano){
  var m=String(s||'').match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);if(!m)return'';
  var y=m[3]||ano||new Date().getFullYear();y=String(y);if(y.length===2)y='20'+y;
  return ('0'+m[1]).slice(-2)+'/'+('0'+m[2]).slice(-2)+'/'+y;
}
/* extrai exames: {data, labs:{Hb..}, outros:"TSH 2,28 / ...", duv:[chaves]} — mantém o mais recente */
S.exames=function(text,anoRef){
  var res={data:'',labs:{},outros:{},duv:{}},datas=[];
  var arr=String(text).split('\n'),lab=S.linhasLab(arr);
  arr.forEach(function(l,idx){
    if(!lab[idx])return;
    var pm=l.match(RE_PRE),dm=pm&&pm[1].match(/(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/);
    var dt=dm?dataBR(dm[1],anoRef):'';
    var corpo=pm?l.slice(pm[0].length):l;
    sepLab(corpo).split('/').forEach(function(s){
      var o=segmento(s);if(!o)return;o=conferir(o);
      var v=fmtVal(o);
      if(S.MAPA_LABS.indexOf(o.key)>=0){res.labs[o.key]=v;if(o.duv)res.duv[o.key]=1;else delete res.duv[o.key];}
      else{res.outros[o.key]=v+(o.duv?'?':'');}
    });
    if(dt)datas.push(dt);
  });
  res.data=datas[datas.length-1]||'';
  res.outrosTxt=Object.keys(res.outros).map(function(k){return k+' '+res.outros[k];}).join(' / ');
  res.duv=Object.keys(res.duv);
  return res;
};

/* ---------------- ficha HCFAMEMA → campos do mapa ---------------- */
var CHAVES=/^(AP|CMB|HPP|MUC|ALERGIAS?|HABITOS|LABORAL|ORIGEM|EVOLUCAO|EF|EXAME|HDA|HMA|QP|CD|CONDUTA|APA|PRE\s*-?\s*OPS?|AV\.?\s*CARDIO|RCH|UTI|ASS)\b/;
function cap(s){return String(s||'').trim();}
S.ficha=function(text,hdr){
  var T=S.limparTexto(hdr?S.juntar(text,S.limparTexto(hdr)):String(text));
  var lines=T.split('\n').map(function(l){return l.replace(/\s+$/,'');});
  var U=lines.map(function(l){return deacc(l).toUpperCase();});
  var r={nome:'',prontuario:'',idade:'',data_exames:'',duvidas:[],labs:{},outros_exames:'',cmb:'',muc:'',alergia:'',peso:'',dx:'',mec:'',cirPrev:'',fxPrev:'',obs:'',cardio:'',apa:''};
  var m,i,all=U.join('\n');
  // identificação
  for(i=0;i<U.length;i++){
    if(m=U[i].match(/PACIENTE\s*:?\s*([\dOIL|]{5,9})\s+([A-Z][A-Z' ]{4,}?)(?=\s{2,}|\s+IDADE\b|$)/)){
      r.prontuario=m[1].replace(/O/g,'0').replace(/[IL|]/g,'1');
      var st=U[i].indexOf(m[2]);r.nome=lines[i].substr(st,m[2].length).replace(/[^A-Za-zÀ-ÿ' ]/g,'').replace(/\s+/g,' ').trim();
      var ws=r.nome.split(' '),k2=ws.length;while(k2>1&&(ws[k2-1]!==ws[k2-1].toUpperCase()||ws[k2-1].length<2&&!/^[EY]$/.test(ws[k2-1])))k2--;r.nome=ws.slice(0,k2).join(' ');break;}
  }
  if(!r.nome)for(i=0;i<U.length;i++){if(m=U[i].match(/PRONTUARIO\s*:?\s*(\d{5,9})\s+PACIENTE\s*:?\s*([A-Z][A-Z' ]{4,}?)(?=\s{2,}|$)/)){
      r.prontuario=r.prontuario||m[1];r.nome=lines[i].substr(U[i].indexOf(m[2]),m[2].length).trim();break;}}
  if(!r.nome){var nI=U.findIndex(function(u){return /NASCIMENTO\s*:?\s*\d/.test(u);});
    for(i=Math.max(0,(nI<0?12:nI)-8);i<(nI<0?12:nI)&&i<U.length;i++){var t0=U[i].trim();
      if(/^[A-Z' ]{10,60}$/.test(t0)&&t0.split(' ').length>=2&&t0.split(' ').length<=7&&!/HCFAMEMA|SECRETARIA|HOSPITAL|MEDICINA|ANAMNESE|URGENCIA|EMERGENCIA|SISTEMA|ATENDIMENTO|ORTOPEDIA|TRAUMATOLOGIA|FACULDADE|CLINICAS/.test(t0)){r.nome=lines[i].trim();break;}}}
  if(!r.prontuario&&(m=all.match(/(?:PACIENTE|REGISTRO|PRONTUARIO|RGHC)\s*:?\s*(\d{5,9})/)))r.prontuario=m[1];
  if(!r.nome&&(m=T.match(/\bNome\s*:?\s*([A-Za-zÀ-ÿ' ]{6,})/i)))r.nome=m[1].trim();
  if(m=all.match(/\bIDADE\s*:?\s*(\d{1,3})\b/))r.idade=m[1];
  else if(m=all.match(/NASCIMENTO\s*:?\s*\d{2}\/\d{2}\/\d{4}\s*-\s*(\d{1,3})\s*A/))r.idade=m[1];
  if(r.prontuario&&!/^\d{6,7}$/.test(r.prontuario))r.duvidas.push('prontuario');
  var ano=(m=all.match(/ATENDIMENTO\s+EM\s+\d{2}\/\d{2}\/(\d{4})/))?m[1]:String(new Date().getFullYear());
  // campos de linha "CHAVE: valor" (valor pode estar na linha seguinte)
  function campo(re){
    for(var j=0;j<U.length;j++){var mm=U[j].match(re);if(!mm)continue;
      var v=lines[j].slice(lines[j].length-(U[j].length-mm[0].length)).trim();
      var mais=[];for(var k=j+1;k<U.length&&k<j+4;k++){var t=U[k].trim();if(!t||CHAVES.test(t)||/^[#$]/.test(t)||S.ehLinhaLab(lines[k]))break;if(/^NEGA\s+(ALERG|MUC|CMB|COMORB|ETIL|TABAG|HABIT|CIRURG)/.test(t)&&(v||mais.length))break;if(v&&!/^(NEGA|-)/.test(t))break;mais.push(lines[k].trim());}
      return (v+(mais.length?(v?' / ':'')+mais.join(' / '):'')).replace(/^[:\s]+/,'').trim();}
    return '';
  }
  r.cmb=campo(/^\s*(?:AP|CMB|HPP|COMORBIDADES?|ANTECEDENTES(?: PESSOAIS)?)\s*:\s*/);
  var cmb2=campo(/^\s*CMB\s*:\s*/);if(cmb2&&r.cmb.indexOf(cmb2)<0&&!/^AP/.test(r.cmb))r.cmb+=(r.cmb?' / ':'')+cmb2;
  r.muc=campo(/^\s*(?:MUC|MEDICACOES(?: EM USO)?|MEDICAMENTOS)\s*:\s*/);
  r.alergia=campo(/^\s*ALERGIAS?\s*:\s*/);
  // linhas "NEGA CMB / NEGA MUC / NEGA ALERGIAS" soltas
  U.forEach(function(u,j){var t=u.trim();
    if(/^NEGA\s+(CMB|COMORBIDADES)/.test(t)&&!r.cmb)r.cmb='Nega';
    if(/^NEGA\s+MUC/.test(t)&&!r.muc)r.muc='Nega';
    if(/^NEGA\s+ALERGIAS?/.test(t)&&!r.alergia)r.alergia='Nega';});
  // "AP: NEGA COMORBIDADES / NEGA ALERGIAS / NEGA MUC" ou "..., NEGA ALERGIAS"
  if(r.cmb){var partes=r.cmb.split(/\s*(?:\/|,|;)\s*(?=NEGA\b)/i),fica=[];
    partes.forEach(function(pt){var pu=deacc(pt).toUpperCase().trim();
      if(/^NEGA\s+ALERG/.test(pu)){if(!r.alergia)r.alergia='Nega';}
      else if(/^NEGA\s+(MUC|MEDICA)/.test(pu)){if(!r.muc)r.muc='Nega';}
      else if(/^NEGA\s+(CMB|COMORB)/.test(pu)){fica.push('Nega');}
      else fica.push(pt.trim());});
    r.cmb=fica.join(' / ');}
  if(/^NEGA\s+CMB/.test(deacc(r.cmb).toUpperCase()))r.cmb='Nega';
  if(m=all.match(/PESO\s*:?\s*(\d{1,3}(?:[.,]\d)?)\s*KG/))r.peso=m[1].replace('.',',')+' kg';
  // bloco de internação → diagnóstico / mecanismo
  var bI=U.findIndex(function(u){return /^\W*#*\W*(AMB\s+)?INTERNACAO\W*$/.test(u.trim())||/^\W*#+\s*(AMB\s+)?INTERNACAO/.test(u.trim());});
  if(bI>=0){
    var dx=[];
    for(i=bI+1;i<U.length&&dx.length<6;i++){var t=U[i].replace(/^[^A-Z0-9]+/,'').trim();
      if(!t)continue;if(CHAVES.test(t)||/^-{2,}/.test(U[i].trim()))break;
      var L=lines[i].replace(/^[^A-Za-zÀ-ÿ0-9]+/,'').trim();
      if(/\b(QUEDA|ACIDENTE|AGRESSAO|ENTORSE|TRAUMA|ATROPELAMENTO|COLISAO|MOTO|PAF|FAB)\b/.test(t)&&!/FRATURA/.test(t)){if(!r.mec)r.mec=L;continue;}
      dx.push(L);
    }
    r.dx=dx.join(' / ');
  }
  // conduta: avaliações, cirurgia, RCH/UTI
  var obs=[];
  U.forEach(function(u,j){var t=u.trim(),L=lines[j].trim();
    if(/^APA\b/.test(t)&&!r.apa)r.apa=L.replace(/^APA\s*:?\s*/i,'');
    else if(/^(AV\.?\s*CARDIO|AVALIACAO CARDIO|CARDIO(LOGIA)?\b|ECO\b|RISCO CIRURGICO)/.test(t)&&!r.cardio)r.cardio=L;
    else if(/^(RCH|RESERVA)\b/.test(t)||/^UTI\b/.test(t))obs.push(L);
    else if(/\bEM\s+\d{1,2}\/\d{1,2}\/\d{2,4}/.test(t)&&t.length<160&&/^[^A-Z]{0,4}(?:\S+\s+){0,3}?(OSTEOSS|ARTROPLAST|RESSEC|RETIRADA DE MATERIAL|ARTROSCOP|RECONSTRU|BIOPSIA|AMPUTA|ARTRODESE|REDUCAO|LIMPEZA|DESBRID|TENORRAF|EXERESE|OSTEOTOM|ENXERT|FIXAC|SINTESE|CORRECAO|REVISAO)/.test(t))obs.unshift('Cx: '+L);
  });
  r.obs=obs.join(' / ');
  // exames
  var ex=S.exames(T,ano);
  r.labs=ex.labs;r.outros_exames=ex.outrosTxt;r.data_exames=ex.data;
  ex.duv.forEach(function(k){r.duvidas.push(k);});
  if(/\?/.test(ex.outrosTxt))r.duvidas.push('outros_exames');
  return r;
};

G.SOTOCR=S;
if(typeof module!=='undefined'&&module.exports)module.exports=S;
})(typeof self!=='undefined'?self:this);
