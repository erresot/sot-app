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
/* desentortar: mede a inclinação das linhas de texto em faixas horizontais (folha curvada no celular)
   e corrige cada altura com um cisalhamento suave. Retorna o canvas corrigido. */
function pixelsEscuros(c,lim){
  var k=Math.min(1,lim/Math.max(c.width,c.height)),w=Math.round(c.width*k),h=Math.round(c.height*k);
  var t=document.createElement('canvas');t.width=w;t.height=h;var g=t.getContext('2d');g.drawImage(c,0,0,w,h);
  var d=g.getImageData(0,0,w,h).data,xs=[],ys=[],i,x,y,sd=12345;
  for(y=0;y<h;y++)for(x=0;x<w;x++){i=(y*w+x)*4;if(d[i]<120){sd=(sd*1103515245+12345)&0x7fffffff;xs.push(x-w/2+(sd%1000)/1000-.5);sd=(sd*1103515245+12345)&0x7fffffff;ys.push(y+(sd%1000)/1000-.5);}}
  return {xs:xs,ys:ys,w:w,h:h,k:k};
}
function anguloFaixa(P,y0,y1){
  var xs=[],ys=[],j;for(j=0;j<P.ys.length;j++)if(P.ys[j]>=y0&&P.ys[j]<y1){xs.push(P.xs[j]);ys.push(P.ys[j]-(y0+y1)/2);}
  if(xs.length<150)return null;
  var Hn=Math.ceil((y1-y0)+P.w*0.3)+10;
  function nota(a){var r=a*Math.PI/180,cs=Math.cos(r),sn=Math.sin(r),H=new Float32Array(Hn*2),o=Hn,j2;
    for(j2=0;j2<xs.length;j2++){var yy=Math.round(ys[j2]*cs-xs[j2]*sn)+o;if(yy>=0&&yy<H.length)H[yy]++;}
    var v=0;for(j2=1;j2<H.length;j2++){var df=H[j2]-H[j2-1];v+=df*df;}return v;}
  var best=0,bv=-1,a,v;
  for(a=-7;a<=7;a+=0.5){v=nota(a);if(v>bv){bv=v;best=a;}}
  var b2=best;for(a=best-0.4;a<=best+0.4;a+=0.1){v=nota(a);if(v>bv){bv=v;b2=a;}}
  return b2;
}
S.angulos=function(c){
  var P=pixelsEscuros(c,900),n=6,alt=P.h/n,out=[];
  for(var i=0;i<n;i++){var y0=Math.max(0,(i-0.5)*alt),y1=Math.min(P.h,(i+1.5)*alt);out.push({y:(i+0.5)*alt/P.k,a:anguloFaixa(P,y0,y1)});}
  // faixas vazias herdam a vizinha
  for(var r=0;r<2;r++)out.forEach(function(o,i){if(o.a==null){var v=(out[i-1]&&out[i-1].a!=null)?out[i-1].a:(out[i+1]&&out[i+1].a!=null)?out[i+1].a:null;if(v!=null)o.a=v;}});
  out.forEach(function(o){if(o.a==null)o.a=0;});
  return out;
};
function desentortar(c){
  var A=S.angulos(c);S.ultimaInclinacao=A.map(function(o){return o.a;});
  if(A.every(function(o){return Math.abs(o.a)<0.3;}))return c;
  var w=c.width,h=c.height,g=c.getContext('2d'),src=g.getImageData(0,0,w,h),sp=src.data;
  var m=new Float32Array(h),y,i;
  for(y=0;y<h;y++){ // interpolação linear entre centros das faixas
    var j=0;while(j<A.length-1&&A[j+1].y<y)j++;
    var a0=A[j],a1=A[Math.min(j+1,A.length-1)],t=a1.y===a0.y?0:Math.min(1,Math.max(0,(y-a0.y)/(a1.y-a0.y)));
    if(y<A[0].y)t=0;m[y]=Math.tan((a0.a+(a1.a-a0.a)*t)*Math.PI/180);
  }
  var out=g.createImageData(w,h),dp=out.data,cx=w/2,x;
  for(y=0;y<h;y++){var mm=m[y];for(x=0;x<w;x++){
    var sy=y+mm*(x-cx),y0=Math.floor(sy),f=sy-y0,o=(y*w+x)*4,v;
    if(y0<0||y0>=h-1)v=255;else{var p0=(y0*w+x)*4,p1=p0+w*4;v=sp[p0]*(1-f)+sp[p1]*f;}
    dp[o]=dp[o+1]=dp[o+2]=v;dp[o+3]=255;}}
  g.putImageData(out,0,0);return c;
}
S.desentortar=desentortar;
/* img: HTMLImageElement/Canvas/ImageBitmap; rot em graus; alvo = lado maior */
S.prep=function(img,rot,alvo,semLimpar){
  rot=rot||0;alvo=alvo||2000;
  var sw=img.naturalWidth||img.width,sh=img.naturalHeight||img.height,long=Math.max(sw,sh);
  var sc=alvo/long;if(sc>2.5)sc=2.5;
  var w=Math.round(sw*sc),h=Math.round(sh*sc),c=document.createElement('canvas'),gira=rot%180!==0;
  c.width=gira?h:w;c.height=gira?w:h;
  var g=c.getContext('2d');g.imageSmoothingQuality='high';g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);
  g.translate(c.width/2,c.height/2);g.rotate(rot*Math.PI/180);g.drawImage(img,-w/2,-h/2,w,h);g.setTransform(1,0,0,1,0,0);
  if(!semLimpar){var d=g.getImageData(0,0,c.width,c.height);limpar(d.data,c.width,c.height);g.putImageData(d,0,0);
    c=desentortar(c);}
  return c;
};
S.cabecalho=function(c,frac,k,top){
  frac=frac||0.15;k=k||1.6;top=top||0;var hh=Math.round(c.height*frac),cc=document.createElement('canvas');
  hh=Math.min(hh,c.height-top);cc.width=Math.round(c.width*k);cc.height=Math.round(hh*k);
  var g=cc.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(c,0,top,c.width,hh,0,0,cc.width,cc.height);return cc;
};
/* acha onde está o cabeçalho ("Paciente"/"Prontuário") na leitura principal */
S.posCabecalho=function(data,H){
  var L=(data&&data.lines)||[],i;
  for(i=0;i<L.length;i++){var t=deacc(L[i].text||'').toUpperCase();
    if(/PAC\w{0,3}NTE\s*:?\s*[\dOIL|—\-~]{4,}|PRONTUARIO\s*:?\s*\d|^\W*IENTE\s+\d{5}/.test(t)&&L[i].bbox&&L[i].bbox.y0<H*0.6)
      return {top:Math.max(0,L[i].bbox.y0-Math.round(H*0.035)),frac:0.13};}
  return {top:0,frac:0.18};
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
      var pc=S.posCabecalho(r.data,c.height);
      return w.setParameters({tessedit_pageseg_mode:'6'}).then(function(){return w.recognize(S.cabecalho(c,pc.frac,1.6,pc.top));})
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
  var m=l.match(/^(.*?Paciente\s*:?\s*)([\dOIl|]{5,9})[^\sA-Za-z0-9]{0,2}\s+(.*)$/i);if(!m)return l;
  var resto=m[3],id=resto.match(/\bIdade\s*:?\s*\d{1,3}/i),nome=(id?resto.slice(0,id.index):resto).split(/\s{2,}/)[0];
  var ws=nome.replace(/[^A-Za-zÀ-ÿ' ]/g,' ').trim().split(/\s+/),k=ws.length;
  while(k>1&&(ws[k-1]!==ws[k-1].toUpperCase()||(ws[k-1].length<3&&!/^(DE|DA|DO|DOS|DAS|E)$/.test(ws[k-1]))))k--;
  return 'Paciente '+m[2].replace(/O/g,'0').replace(/[Il|]/g,'1')+'   '+ws.slice(0,k).join(' ')+(id?'   '+id[0]:'');
}
/* junta o cabeçalho ao texto principal: substitui a linha "Paciente ..." ruim pela do cabeçalho */
S.juntar=function(text,hdr){
  var L=S.linhasCab(hdr);if(!L.length)return String(text).split('\n').map(function(l){return /^\W{0,3}Paciente\s*:?\s*[\dOIl|]{5,9}[^\sA-Za-z0-9]{0,2}\s/i.test(l)?limpaPac(l):l;}).join('\n');
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
/* ---------- padrões de diagnóstico das fichas HCFAMEMA (evolução, anamnese de urgência, internograma) ---------- */
function ehMarca(t){ if(!/INTERNACAO/.test(t)||t.length>40)return false;
  var r=t.replace(/INTERNACAO/,' ').replace(/\bH?AMB(ULATORIO)?\.?/,' ').replace(/[^A-Z ]/g,' ').trim();
  return !r||r.split(/\s+/).every(function(w){return w.length<=2;}); }
var RE_MARCA={test:ehMarca};
var RE_INICIO=/^\W*(DESCRICAO DA EVOLUCAO|HISTORIA CLINICA|QUEIXA E DURACAO|HISTORIA DA MOLESTIA)/;
var RE_FIM=/^[^A-Z0-9]{0,3}R?(AP|CMB|HPP|MUC|ALERGIAS?|COMORBIDADES|ANTECEDENTES|HDA|HMA|HPMA|QP|EVOLUCAO|AVALIO|VICIOS|HABITOS|EXAME FISICO|EF|CD|CONDUTAS?|PESO|SUBJETIVO|PACIENTE|ENCAMINHAD[OA]|REFERE|RELATA|VITIMA|TRAZID[OA]|NEGA (CMB|MUC|ALERG|COMORB|ETIL|TABAG|HAS|DM)|SOU CHAMAD|CHAMADO)\b\s*[:.\-]?/;
var RE_LIXO=/^(PS ORTOPEDIA|FICHA INCLUIDA|ANAMNESE EM|EVOLUCAO EM|POR\b|S?INTERCONSULTA|SEM TEMPO|ORTOPEDIA|TRAUMATOLOGIA|ATENDIMENTO|SUS\b|PRESTADORA|CONVENIO|DESCRICAO)/;
var RE_ITEM=/^(\d+\s*[º°]?\s*(D|DIAS?|PO|DPO|POI|POT|M|MESES|A|ANOS?|SEM)\b|POT?\b|POI\b|PO\b|DPO\b|FX\b|FRATURA|LUXA|TCG|TUMOR|INFEC|LESAO|DISPLASIA|PSEUDO|OSTEO|ARTRO|PROTESE|REVIS|QUEDA|QPA\b|ACIDENTE|TRAUMA|ATROPEL|AGRESS|LOMBO|HERNIA|ESPONDIL|RUPTURA|ROTURA|LCA\b|SEQUELA|DEFORM|HALUX|SINDROME|NEOPLASIA|METAST|CONTUS|ENTORSE|AMPUTA|ESCOLIOSE|CANAL|ESTENOSE|GONARTROSE|COXARTROSE|ARTROSE|EPIFISIOLISE|DDQ|PE TORTO|CERVICALGIA|LOMBALGIA|TENDIN|BURSITE|CAPSULITE|SINOVITE|CISTO|ENCONDROMA|OSTEOCONDROMA|SARCOMA|MIELOMA|DMMO|POLITRAUMA|FERIMENTO|PAF\b|FAB\b|EXPOSICAO|NECROSE|OSTEONECROSE|SOLTURA)/;
var RE_MEC=/\b(QUEDA|QPA|ACIDENTE|ATROPELAMENTO|ATROPELAD|AGRESS[AO]|COLIS[AO]|ENTORSE|TORCAO|PAF|FAB|CAPOTAMENTO|MOTO X|CARRO X|BICICLETA|TRAUMA (DIRETO|INDIRETO|TORCIONAL|DE ALTA|DE BAIXA)|ESMAGAMENTO|PRENSAMENTO|MORDEDURA|COICE)\b/;
function limpaItem(l){return l.replace(/^[^A-Za-zÀ-ÿ0-9(]+/,'').replace(/^[ÍIl|\[](?=[A-ZÀ-Ý]{2})/,'').replace(/\s+[^A-Za-zÀ-ÿ0-9()\/]{1,3}$/,'').replace(/\s{2,}/g,' ').trim();}
S.blocoDx=function(lines,U){
  var res={dx:[],po:[],mec:'',duv:false,mecDuv:false},i,ini=-1,fim=-1;
  for(i=0;i<U.length&&i<80;i++){var t=U[i].trim();if(RE_MARCA.test(t)||RE_INICIO.test(t)){ini=i;break;}}
  if(ini>=0){
    // se a marca de internação vem logo depois, começa nela
    for(var j=ini+1;j<Math.min(U.length,ini+4);j++)if(RE_MARCA.test(U[j].trim())){ini=j;break;}
    var itens=[];
    for(i=ini+1;i<U.length&&i<ini+16;i++){
      var t2=U[i].trim();if(!t2)continue;
      if(RE_MARCA.test(t2))continue;
      if(RE_FIM.test(t2))break;
      if(RE_LIXO.test(t2.replace(/^\W+/,''))||/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}/.test(t2))continue;
      var al=(t2.match(/[A-Z0-9]/g)||[]).length;if(al<4||al/t2.length<.55)continue;
      var L=limpaItem(lines[i]),LU=deacc(L).toUpperCase();
      if(!L)continue;
      if(L.length>110&&/,|\bHA \d+|\bPACIENTE\b/.test(LU))break;
      var novo=RE_ITEM.test(LU)||!itens.length||(itens[itens.length-1].length+L.length>220)||/[)]\s*$|\d{2}\/\d{2}\/?\d{0,4}\)?\s*$/.test(itens[itens.length-1]);
      if(novo)itens.push(L);else itens[itens.length-1]+=' '+L;
    }
    // linha anterior à marca com PO/POT (ex.: POT antes de "# AMB INTERNAÇÃO")
    for(i=Math.max(0,ini-2);i<ini;i++){var tp=U[i].trim();if(/^\W*(\d+\s*[º°]?\s*(PO|DPO|D)\b|POT?\b|POI\b)/.test(tp)&&!RE_INICIO.test(tp))itens.unshift(limpaItem(lines[i]));}
    itens.forEach(function(it){
      var u=deacc(it).toUpperCase();
      if(RE_MEC.test(u)&&!/FRATURA|\bFX\b|LUXA|\bPO\b|\bPOT\b/.test(u)){if(!res.mec)res.mec=(it.length>70?it.substr(u.search(RE_MEC),60):it).replace(/^QPA\b/i,'Queda da própria altura');return;}
      res.dx.push(it);
      if(/^(\d+\s*[º°]?\s*(PO|DPO|POI|POT)\b|POT?\b|POI\b)/.test(u))res.po.push(it);
    });
  }
  // sem bloco: HD / hipótese / diagnóstico; senão fratura citada no texto (marcada com ?)
  if(!res.dx.length){
    for(i=0;i<U.length;i++){var m=U[i].match(/^\W*(HD|HIPOTESES?(?: DIAGNOSTICAS?)?|DIAGNOSTICOS?|IMPRESSAO)\s*[:\-]\s*(.+)$/);if(m){res.dx.push(limpaItem(lines[i].slice(lines[i].length-m[2].length)));}}
    if(!res.dx.length)for(i=0;i<U.length;i++){var u2=U[i];if(/^\W*(NEGA|SEM)\b/.test(u2))continue;var mf=u2.match(/\b(FRATURA|FX|LUXACAO|FRATURA-LUXACAO)\s+(DE|DO|DA|EM)\s+[A-Z ]{4,60}?(A DIREITA|A ESQUERDA|DIREIT[OA]|ESQUERD[OA]|BILATERAL)/);
      if(mf){res.dx.push(lines[i].substr(u2.indexOf(mf[0]),mf[0].length));res.duv=true;break;}}
  }
  // mecanismo no texto corrido
  if(!res.mec){var all=U.join('\n'),mm=all.match(/\b(QUEDA\s+(?:DA|DE)\s+PROPRIA\s+ALTURA|QUEDA (?:DE|DO|DA) [A-Z]+(?: [A-Z]+){0,3}|ACIDENTE (?:DE |)(?:MOTO|CARRO|BICICLETA|TRANSITO|TRABALHO|AUTOMOBILISTICO|MOTOCICLISTICO)(?: X [A-Z]+)?|ATROPELAMENTO(?: POR [A-Z]+)?|AGRESSAO(?: FISICA)?|ENTORSE (?:DE|DO|DA) [A-Z]+|TRAUMA (?:DIRETO|TORCIONAL|INDIRETO)(?: EM [A-Z]+(?: [A-Z]+)?)?|PAF|FAB)\b/);
    if(mm){var k=all.indexOf(mm[0]),ln=all.slice(0,k).split('\n').length-1,st=U[ln].indexOf(mm[0]);res.mec=(st>=0&&mm[0].indexOf('\n')<0)?lines[ln].substr(st,mm[0].length):mm[0].replace(/\s+/g,' ');res.mecDuv=true;}}
  return res;
};
var CHAVES=/^[^A-Z0-9]{0,3}(AP|CMB|HPP|MUC|ALERGIAS?|HABITOS|LABORAL|ORIGEM|EVOLUCAO|EF|EXAME|HDA|HMA|QP|CD|CONDUTA|APA|PRE\s*-?\s*OPS?|AV\.?\s*CARDIO|RCH|UTI|ASS)\b/;
function cap(s){return String(s||'').trim();}
S.ficha=function(text,hdr){
  var T=S.limparTexto(hdr?S.juntar(text,S.limparTexto(hdr)):String(text));
  var lines=T.split('\n').map(function(l){return l.replace(/\s+$/,'');});
  var U=lines.map(function(l){return deacc(l).toUpperCase();});
  var r={nome:'',prontuario:'',idade:'',data_exames:'',duvidas:[],labs:{},outros_exames:'',cmb:'',muc:'',alergia:'',peso:'',dx:'',mec:'',cirPrev:'',fxPrev:'',obs:'',cardio:'',apa:''};
  var m,i,all=U.join('\n');
  // identificação
  for(i=0;i<U.length;i++){
    if(m=U[i].match(/PACIENTE\s*:?\s*([\dOIL|]{5,9})[^\sA-Z0-9]{0,2}\s+([A-Z][A-Z' ]{4,}?)(?=\s{2,}|\s+IDADE\b|$)/)){
      r.prontuario=m[1].replace(/O/g,'0').replace(/[IL|]/g,'1');
      var st=U[i].indexOf(m[2]);r.nome=lines[i].substr(st,m[2].length).replace(/[^A-Za-zÀ-ÿ' ]/g,'').replace(/\s+/g,' ').trim();
      var ws=r.nome.split(' '),k2=ws.length;while(k2>1&&(ws[k2-1]!==ws[k2-1].toUpperCase()||(ws[k2-1].length<3&&!/^(E|Y|DA|DE|DO)$/.test(ws[k2-1]))||/^(DA|DE|DO|DOS|DAS|E)$/.test(ws[k2-1])))k2--;r.nome=ws.slice(0,k2).join(' ');break;}
  }
  if(!r.nome)for(i=0;i<U.length;i++){if(m=U[i].match(/PRONTUARIO\s*:?\s*(\d{5,9})\s+PACIENTE\s*:?\s*([A-Z][A-Z' ]{4,}?)(?=\s{2,}|$)/)){
      r.prontuario=r.prontuario||m[1];r.nome=lines[i].substr(U[i].indexOf(m[2]),m[2].length).trim();break;}}
  if(!r.nome)for(i=0;i<Math.min(U.length,15);i++){if(m=U[i].match(/^\W*(\d{6,7})\s+([A-Z][A-Z' ]{8,60})\s*$/)){r.prontuario=r.prontuario||m[1];r.nome=lines[i].substr(U[i].indexOf(m[2]),m[2].length).trim();break;}}
  if(!r.nome){var nI=U.findIndex(function(u){return /NASCIMENTO\s*:?\s*\d/.test(u);});
    for(i=Math.max(0,(nI<0?12:nI)-8);i<(nI<0?12:nI)&&i<U.length;i++){var t0=U[i].trim();
      if(/^[A-Z' ]{10,60}$/.test(t0)&&t0.split(' ').length>=2&&t0.split(' ').length<=7&&!/HCFAMEMA|SECRETARIA|HOSPITAL|MEDICINA|ANAMNESE|URGENCIA|EMERGENCIA|SISTEMA|ATENDIMENTO|ORTOPEDIA|TRAUMATOLOGIA|FACULDADE|CLINICAS/.test(t0)){r.nome=lines[i].trim();break;}}}
  if(!r.prontuario&&(m=all.match(/(?:PACIENTE|REGISTRO|PRONTUARIO|RGHC)\s*:?\s*(\d{5,9})/)))r.prontuario=m[1];
  if(!r.nome&&(m=T.match(/\bNome\s*:?\s*([A-Za-zÀ-ÿ' ]{6,})/i)))r.nome=m[1].trim();
  var allH=all+'\n'+deacc(String(hdr||'')).toUpperCase();
  if(m=allH.match(/\bIDADE\s*:?\s*(\d{1,3})\b/))r.idade=m[1];
  else if(m=allH.match(/NASCIMENTO\s*:?\s*\d{2}\/\d{2}\/\d{4}\s*-\s*(\d{1,3})\s*A/))r.idade=m[1];
  if(r.nome){var ws0=r.nome.split(/\s+/),k0=ws0.length;while(k0>2&&((ws0[k0-1].length<3&&!/^(E|Y)$/i.test(ws0[k0-1]))||/^(DA|DE|DO|DOS|DAS|E)$/i.test(ws0[k0-1])))k0--;r.nome=ws0.slice(0,k0).join(' ');}
  if(r.prontuario&&!/^\d{6,7}$/.test(r.prontuario))r.duvidas.push('prontuario');
  var ano=(m=all.match(/ATENDIMENTO\s+EM\s+\d{2}\/\d{2}\/(\d{4})/))?m[1]:String(new Date().getFullYear());
  // campos de linha "CHAVE: valor" (valor pode estar na linha seguinte)
  function campo(re){
    for(var j=0;j<U.length;j++){var mm=U[j].match(re);if(!mm)continue;
      var v=lines[j].slice(lines[j].length-(U[j].length-mm[0].length)).trim();
      var mais=[];for(var k=j+1;k<U.length&&k<j+4;k++){var t=U[k].trim();if(!t&&!v&&!mais.length)continue;if(!t||CHAVES.test(t)||/^[#$]/.test(t)||S.ehLinhaLab(lines[k]))break;if(/^NEGA\s+(ALERG|MUC|CMB|COMORB|ETIL|TABAG|HABIT|CIRURG)/.test(t)&&(v||mais.length))break;if(v&&!/^(NEGA|-)/.test(t))break;mais.push(lines[k].trim());}
      return (v+(mais.length?(v?' / ':'')+mais.join(' / '):'')).replace(/^[:\s]+/,'').trim();}
    return '';
  }
  r.cmb=campo(/^[^A-Z0-9]{0,3}R?(?:AP|CMB|HPP|COMORBIDADES?|ANTECEDENTES(?: PESSOAIS)?)\s*[:.]\s*/);
  var cmb2=campo(/^\s*CMB\s*:\s*/);if(cmb2&&r.cmb.indexOf(cmb2)<0&&!/^AP/.test(r.cmb))r.cmb+=(r.cmb?' / ':'')+cmb2;
  r.muc=campo(/^[^A-Z0-9]{0,3}(?:MUC|MEDICACOES(?: EM USO)?|MEDICAMENTOS)\s*[:.]\s*/);
  r.alergia=campo(/^[^A-Z0-9]{0,3}ALERGIAS?\s*[:.]?\s*(?=\S|$)/);
  // linhas "NEGA CMB / NEGA MUC / NEGA ALERGIAS" soltas
  U.forEach(function(u,j){var t=u.trim();
    if(/^NEGA\s+(CMB|COMORBIDADES)/.test(t)&&!r.cmb)r.cmb='NEGA';
    if(/^NEGA\s+MUC/.test(t)&&!r.muc)r.muc='NEGA';
    if(/^NEGA\s+ALERGIAS?/.test(t)&&!r.alergia)r.alergia='NEGA';});
  // "AP: NEGA COMORBIDADES / NEGA ALERGIAS / NEGA MUC" ou "..., NEGA ALERGIAS"
  if(r.cmb){var partes=r.cmb.split(/\s*(?:\/|,|;)\s*(?=NEGA\b)/i),fica=[];
    partes.forEach(function(pt){var pu=deacc(pt).toUpperCase().trim();
      if(/^NEGA\s+ALERG/.test(pu)){if(!r.alergia)r.alergia='NEGA';}
      else if(/^NEGA\s+(MUC|MEDICA)/.test(pu)){if(!r.muc)r.muc='NEGA';}
      else if(/^NEGA\s+(CMB|COMORB)/.test(pu)){fica.push('NEGA');}
      else fica.push(pt.trim());});
    r.cmb=fica.join(' / ');}
  if(/^NEGA\s+CMB/.test(deacc(r.cmb).toUpperCase()))r.cmb='NEGA';
  if(m=all.match(/PESO\s*:?\s*(\d{1,3}(?:[.,]\d{1,3})?)\s*(KG|KILOS?|QUILOS?|K\b)/))r.peso=m[1].replace('.',',')+' kg';
  // bloco de diagnóstico → Dx / Cir. prévias / Mecanismo
  var bl=S.blocoDx(lines,U);
  r.dx=bl.dx.join(' / ');r.cirPrev=bl.po.join(' / ');r.mec=bl.mec;
  if(bl.duv)r.duvidas.push('dx');if(bl.mecDuv)r.duvidas.push('mec');
  // conduta: avaliações, cirurgia, RCH/UTI
  var obs=[];
  U.forEach(function(u,j){var t=u.trim(),L=lines[j].trim();
    if(/^APA\b/.test(t)&&!r.apa)r.apa=L.replace(/^APA\s*:?\s*/i,'');
    else if(/^(AV\.?\s*CARDIO|AVALIACAO CARDIO|CARDIO(LOGIA)?\b|ECO\b|RISCO CIRURGICO)/.test(t)&&!r.cardio)r.cardio=L;
    else if(/^(RCH|RESERVA)\b/.test(t)||/^UTI\b/.test(t))obs.push(L);
    else if(/\bEM\s+\d{1,2}\/\d{1,2}\/\d{2,4}/.test(t)&&t.length<160&&/^[^A-Z]{0,4}(?:\S+\s+){0,3}?(OSTEOSS|ARTROPLAST|RESSEC|RETIRADA DE MATERIAL|ARTROSCOP|RECONSTRU|BIOPSIA|AMPUTA|ARTRODESE|REDUCAO|LIMPEZA|DESBRID|TENORRAF|EXERESE|OSTEOTOM|ENXERT|FIXAC|SINTESE|CORRECAO|REVISAO)/.test(t))obs.unshift('Cx: '+L);
  });
  r.obs=obs.join(' / ');
  if(!r.alergia)r.alergia='NEGA';
  // exames
  var ex=S.exames(T,ano);
  r.labs=ex.labs;r.outros_exames=ex.outrosTxt;r.data_exames=ex.data;
  ex.duv.forEach(function(k){r.duvidas.push(k);});
  if(/\?/.test(ex.outrosTxt))r.duvidas.push('outros_exames');
  return r;
};

/* ---------------- laudos (RX, TC, RM, USG, anatomopatológico) ---------------- */
var SEC=/^\s*(T[ÉE]CNICA|M[ÉE]TODO|INDICA[ÇC][ÃA]O|INFORMA[ÇC][ÕO]ES CL[ÍI]NICAS|HIST[ÓO]RIA CL[ÍI]NICA|RELAT[ÓO]RIO|AN[ÁA]LISE|ACHADOS|DESCRI[ÇC][ÃA]O|EXAME|MACROSCOPIA|MICROSCOPIA|COMPARA[ÇC][ÃA]O|CONCLUS[ÃA]O|IMPRESS[ÃA]O(?: DIAGN[ÓO]STICA)?|OPINI[ÃA]O|DIAGN[ÓO]STICO|NOTA|OBSERVA[ÇC][ÕO]ES?)\s*[:.\-]?\s*(.*)$/i;
S.laudo=function(text){
  var L=S.limparTexto(text).split('\n').map(function(l){return l.replace(/\s+/g,' ').trim();});
  // tira linhas de ruído (poucas letras, só símbolos)
  L=L.filter(function(l){if(!l)return true;var al=(l.match(/[A-Za-zÀ-ÿ0-9]/g)||[]).length;return al>=3&&al/l.length>=.6;});
  var blocos=[],cur={tit:'',txt:[]},titulo='',data='',m;
  L.forEach(function(l,i){
    if(!data&&(m=l.match(/\b(\d{2}\/\d{2}\/\d{4})\b/)))data=m[1];
    if(!titulo&&/^(RADIOGRAFIA|RX|TOMOGRAFIA|TC|RESSON[AÂ]NCIA|RM|RNM|ULTRASSONOGRAFIA|USG|US\b|DENSITOMETRIA|CINTILOGRAFIA|ANGIO|ELETRO|ANATOMOPATOL|EXAME ANATOMO|BI[ÓO]PSIA)/i.test(deacc(l).toUpperCase())&&l.length<90){titulo=l;return;}
    var sm=l.match(SEC);
    if(sm&&sm[1].length>=4&&(l.length<60||/:/.test(l))){if(cur.tit||cur.txt.length)blocos.push(cur);cur={tit:sm[1].toUpperCase(),txt:sm[2]?[sm[2]]:[]};return;}
    if(!l){cur.txt.push('');return;}
    cur.txt.push(l);
  });
  if(cur.tit||cur.txt.length)blocos.push(cur);
  // junta linhas quebradas em parágrafos
  blocos.forEach(function(b){
    var par=[],at='';
    b.txt.forEach(function(l){
      if(!l){if(at)par.push(at);at='';return;}
      if(/^[-•*·]\s|^\d+[.)]\s/.test(l)){if(at)par.push(at);at=l;return;}
      at=at?(/[-]$/.test(at)?at.slice(0,-1)+l:at+' '+l):l;
      if(/[.:;]$/.test(l)&&l.length<70){par.push(at);at='';}
    });
    if(at)par.push(at);b.par=par;
  });
  var ASS=/\bCRM\b|ASSINAD|RESPONS[AÁ]VEL|^DRA?\.?\s|M[EÉ]DIC[OA] RADIOLOG|LIBERADO EM|DIGITADO/i;
  blocos.forEach(function(b){var k=b.par.findIndex(function(x){return ASS.test(x);});b.ass=k>=0?b.par.slice(k):[];if(k>=0)b.par=b.par.slice(0,k);});
  var concl=blocos.filter(function(b){return /CONCLUS|IMPRESS|OPINI|DIAGN/.test(deacc(b.tit));}).map(function(b){return b.par.join(' ');}).join(' ');
  var txt=(titulo?titulo.toUpperCase()+(data?' ('+data+')':'')+'\n\n':'')+blocos.map(function(b){return (b.tit?b.tit+':\n':'')+b.par.concat(b.ass).join('\n');}).join('\n\n');
  return {titulo:titulo,data:data,conclusao:concl,texto:txt.trim()};
};

G.SOTOCR=S;
if(typeof module!=='undefined'&&module.exports)module.exports=S;
})(typeof self!=='undefined'?self:this);
