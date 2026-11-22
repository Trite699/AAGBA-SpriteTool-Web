/* GBA ROM mode for the AA sprite tool. Load it with a script tag (in the head or at the end of the body; it waits for the page).
   Format (decoded from Gyakuten Saiban 3 GBA): patch table = 12-byte entries {u32 ptr(LZ77, 8bpp tiles), u16 x, u16 y, u16 w, u16 h} (tiles);
   a sequence = 4-byte entries {u8 first patch, u8 count, 0, 0}, ended by count 0. A frame draws `count` consecutive patches onto the BG. */
(function(){
const SW=512,SH=256;
const CP=[286580, 289584, 302128, 1448596, 1455932, 1457924, 1459040, 1572864, 1599520, 1613600, 1616160, 1624832, 1630976, 1632000, 1632032, 1673456, 1674000, 1674448, 1674480, 1674512, 1675056, 1675088, 1675120, 2350568, 2352520, 3330780, 3838348, 4626996, 6932724, 7207820],CB=[[1641632, 16384], [1649000, 10420], [1650644, 12124], [1652552, 10928], [1657536, 13800], [1659604, 13800], [3365484, 16384], [3833320, 14720], [3838860, 19200], [4627444, 16384], [7232452, 75460], [7264236, 88316], [7300576, 24614], [7312104, 81910], [7347744, 88142], [7386208, 71714], [7417872, 44582], [7436816, 67612], [7466236, 60426], [7491728, 41010], [7508920, 64726], [7536540, 66520], [7565556, 42284], [7583920, 59118], [7609992, 81710], [7645412, 75600], [7677212, 29016], [7689760, 56318], [7713268, 72154], [7744288, 50064], [7765464, 79798], [7798976, 84718], [7834244, 31804], [7847764, 69808], [7877904, 41302], [7895436, 60028], [7921096, 41218], [7938444, 66526], [7966824, 70742], [7997364, 54340], [8020116, 96318], [8060256, 87964], [8096832, 55954], [8121800, 52198], [8144176, 51128], [8167072, 101668], [8210976, 68722], [8239664, 59488], [8264960, 76530], [8297040, 82984], [8331412, 28022], [8343496, 63910], [8370860, 18046], [8378772, 12176]],DC=[[1457376, 3], [1457412, 4], [1457460, 2], [1457484, 2], [1457508, 3], [1457544, 1], [1457556, 1], [1457788, 3], [1457788, 6], [1458004, 7], [1458088, 3], [1458124, 1], [1458136, 6], [1458208, 2], [1458208, 11], [1458232, 9], [1458340, 13], [1458496, 5], [1458556, 2], [1458556, 4], [1458580, 2], [1458592, 2], [1458616, 1], [1458700, 1], [1458904, 1], [1458916, 2]]; // palette candidates, base-image candidates (LZ77 blocks >=9600 B), scene draw calls {patch address,count} found in the game code
function lz(r,o){ if(r[o]!==0x10)return null; const n=r[o+1]|r[o+2]<<8|r[o+3]<<16; if(n<1||n>0x100000)return null;
  const out=new Uint8Array(n); let p=o+4,q=0;
  while(q<n){ if(p>=r.length)return null; const f=r[p++];
    for(let i=0;i<8&&q<n;i++){
      if(f&(0x80>>i)){ const a=r[p++],b=r[p++],l=(a>>4)+3,d=((a&15)<<8|b)+1; if(d>q)return null; for(let k=0;k<l&&q<n;k++,q++)out[q]=out[q-d]; }
      else out[q++]=r[p++]; } }
  return out; }
function patches(r,off,count){ const dv=new DataView(r.buffer,r.byteOffset,r.byteLength),a=[];
  for(let i=0;i<count;i++){ const p=off+i*12,ptr=dv.getUint32(p,true);
    a.push({ptr:ptr>=0x08000000&&ptr<0x0A000000?ptr-0x08000000:-1,x:dv.getUint16(p+4,true),y:dv.getUint16(p+6,true),w:dv.getUint16(p+8,true),h:dv.getUint16(p+10,true)}); }
  return a; }
function discover(r,np,lo,hi){ // runs of >=3 plausible {idx,count,0,0} entries
  const res=[]; for(let p=lo;p<hi;p+=4){ let q=p,n=0;
    for(;q+4<=hi;q+=4){ const i=r[q],c=r[q+1]; if(r[q+2]||r[q+3]||c<1||c>8||i+c>np)break; n++; }
    if(n>=3&&r[q+1]===0&&!r[q+2]&&!r[q+3]){ res.push({off:p,n}); p=q; } else if(n>=3){ res.push({off:p,n}); p=q; } }
  return res; }
function seq(r,off,max=256){ const a=[]; for(let i=0;i<max;i++){ const p=off+i*4; if(p+4>r.length||!r[p+1]||r[p+2]||r[p+3])break; a.push({i:r[p],c:r[p+1]}); } return a; }
function pal(r,off,n=256){ const dv=new DataView(r.buffer,r.byteOffset,r.byteLength),p=[]; for(let i=0;i<n;i++){ const v=dv.getUint16(off+i*2,true); p.push([(v&31)*255/31|0,(v>>5&31)*255/31|0,(v>>10&31)*255/31|0]); } return p; }
function blit(img,tiles,bpp,P,x,y,w,h,tr){ // tiles in raster order inside a w*h tile rectangle
  const bs=bpp===8?64:32;
  for(let t=0;t<w*h&&(t+1)*bs<=tiles.length;t++){ const tx=x*8+(t%w)*8,ty=y*8+((t/w)|0)*8;
    for(let yy=0;yy<8;yy++)for(let xx=0;xx<8;xx++){ let v; if(bpp===8)v=tiles[t*64+yy*8+xx]; else{ const b=tiles[t*32+yy*4+(xx>>1)]; v=xx&1?b>>4:b&15; }
      if(tr&&!v)continue; const X=tx+xx,Y=ty+yy; if(X<0||Y<0||X>=SW||Y>=SH)continue; const c=P[v],o=(Y*SW+X)*4; img.data[o]=c[0];img.data[o+1]=c[1];img.data[o+2]=c[2];img.data[o+3]=255; } } }
if(typeof document==='undefined'){ module.exports={lz,patches,discover,seq,pal,blit}; return; }
const boot=()=>{ // runs after the page exists, so the script works from <head> or the end of <body>
  { const q=x=>document.querySelector(x); // update the main page's wording so it mentions .gba support
    const sub=q('.sub'); if(sub&&!sub.dataset.gba){ sub.dataset.gba=1; sub.innerHTML+=' It also opens a Gyakuten Saiban 3 <code>.gba</code> ROM directly (see “GBA ROM mode” below).'; }
    const dl=q('#drop .drop-label'); if(dl)dl.textContent='Click or drop .pix and .seq files (matching names are paired), or a .gba ROM';
    const dh=q('#drop .drop-hint'); if(dh)dh.textContent='e.g. animation01.pix + animation01.seq, or Gyakuten Saiban 3 (Japan).gba';
    const ft=q('.foot'); if(ft&&!ft.dataset.gba){ ft.dataset.gba=1; ft.innerHTML+='<br><br>GBA ROM mode — .gba: no .pix/.seq files exist, so the ROM is read directly. Graphics are BIOS-LZ77 blocks. A patch table holds 12-byte entries (pointer to 8bpp tiles, x, y, w, h in tiles); a sequence is a list of 4-byte entries (first patch, count) that draw consecutive patches onto the background. Palettes and base images are not linked to scenes yet, so pick them manually.'; } }

const $=id=>document.getElementById(id),hex=s=>parseInt(String(s).trim().replace(/^0x/i,''),16)||0;
let R=null,P=[],seqs=[],fr=0,play=true,acc=0,last=0,cache=new Map();
const card=document.createElement('div'); card.className='card';
card.innerHTML=`<div class="card-title">GBA ROM mode <span class="card-title-right" id="g_info"></span></div>
<label class="drop"><span class="drop-label">Click or drop a .gba ROM (Gyakuten Saiban 3)</span><span class="drop-hint">Patch sequences are found automatically; palette and base image are picked by hand</span><input type="file" id="g_file" accept=".gba"></label>
<div id="g_ui" style="display:none">
<div class="opts"><label>Patch table offset<input class="sel" id="g_pt" value="163F54" size="8"></label><label>Patch count<input class="sel" id="g_pn" value="83" size="4"></label>
<label>Sequence<select class="sel" id="g_seq"></select></label><label>Scene draws (from code)<select class="sel" id="g_dc"></select></label><label>Manual sequence offset<input class="sel" id="g_so" placeholder="164338" size="8"></label></div>
<div class="opts"><label>Palette offset (256 colours)<input class="sel" id="g_po" value="3A918C" size="8"></label>
<label>Palette candidates<select class="sel" id="g_pc"></select></label><div class="btn-row"><button class="btn btn-sm" id="g_pm">◀ −0x200</button><button class="btn btn-sm" id="g_pp">+0x200 ▶</button></div>
<label>Base image offset (LZ77, optional)<input class="sel" id="g_bo" placeholder="3A938C" size="8"></label>
<label>Base candidates<select class="sel" id="g_bc"></select></label><label>Base bpp<select class="sel" id="g_bb"><option>8</option><option>4</option></select></label><label>Base width (tiles)<input class="sel" id="g_bw" value="30" size="3"></label></div>
<div class="opts"><label>Frame time (1/60 s)<input type="number" class="sel" id="g_dur" value="8" min="1" max="120" style="width:70px"></label>
<label class="chk"><input type="checkbox" id="g_tr" checked> Index 0 transparent</label><label class="chk"><input type="checkbox" id="g_sw"> Swap w/h</label>
<label class="chk"><input type="checkbox" id="g_cr" checked> Crop to content</label><label class="chk"><input type="checkbox" id="g_cu"> Keep earlier patches</label><label>Zoom<select class="sel" id="g_z"><option>1</option><option selected>2</option><option>3</option><option>4</option></select></label></div>
<div class="stage" id="g_stage"><canvas id="g_cv" width="${SW}" height="${SH}"></canvas></div>
<div class="btn-row" style="margin-top:10px"><button class="btn btn-primary" id="g_play">Pause</button><button class="btn" id="g_prev">◀ Step</button><button class="btn" id="g_next">Step ▶</button>
<button class="btn btn-sm" id="g_png">Frame PNG</button><button class="btn btn-sm btn-primary" id="g_gif">Export GIF</button></div>
<div class="status" id="g_st"><span class="dot"></span><span>Load a ROM.</span></div></div>`;
const vw=$('viewer'); (vw?vw.parentNode:document.querySelector('.wrap')).insertBefore(card,vw||null);
const st=(t,c)=>{$('g_st').className='status '+(c||'');$('g_st').lastChild.textContent=t;};
function tilesAt(o){ const k='t'+o; if(!cache.has(k))cache.set(k,o>=0?lz(R,o):null); return cache.get(k); }
function frameCanvas(f){ const cv=document.createElement('canvas');cv.width=SW;cv.height=SH; const x=cv.getContext('2d'),img=x.createImageData(SW,SH);
  const tr=$('g_tr').checked,sw=$('g_sw').checked,pt=hex($('g_pt').value),np=+$('g_pn').value,pa=patches(R,pt,np);
  const bo=hex($('g_bo').value); if(bo){ const b=tilesAt(bo); if(b){ const bpp=+$('g_bb').value,w=+$('g_bw').value||30; blit(img,b,bpp,P,0,0,w,Math.ceil(b.length/(bpp===8?64:32)/w),false); } }
  const list=$('g_cu').checked?seqs.cur.slice(0,f+1):[seqs.cur[f]];
  for(const e of list)for(let k=0;k<e.c;k++){ const p=e.b!==undefined?patches(R,e.b+k*12,1)[0]:pa[e.i+k]; if(!p||p.ptr<0)continue; const t=tilesAt(p.ptr); if(!t)continue; blit(img,t,8,P,p.x,p.y,sw?p.h:p.w,sw?p.w:p.h,tr); }
  x.putImageData(img,0,0);
  if(!$('g_cr').checked||hex($('g_bo').value))return cv; let X0=1e9,Y0=1e9,X1=0,Y1=0; for(const e of seqs.cur)for(let k=0;k<e.c;k++){ const p=e.b!==undefined?patches(R,e.b+k*12,1)[0]:pa[e.i+k]; if(!p)continue; const w=sw?p.h:p.w,h=sw?p.w:p.h; X0=Math.min(X0,p.x*8);Y0=Math.min(Y0,p.y*8);X1=Math.max(X1,(p.x+w)*8);Y1=Math.max(Y1,(p.y+h)*8); }
  X1=Math.min(X1,SW);Y1=Math.min(Y1,SH); if(X1<=X0||Y1<=Y0)return cv; const o=document.createElement('canvas');o.width=X1-X0;o.height=Y1-Y0;o.getContext('2d').drawImage(cv,-X0,-Y0); return o; }
function show(){ if(!seqs.cur||!seqs.cur.length)return; fr=(fr+seqs.cur.length)%seqs.cur.length; const z=+$('g_z').value,cv=$('g_cv'); const fc=frameCanvas(fr); cv.width=fc.width*z;cv.height=fc.height*z;
  const x=cv.getContext('2d');x.imageSmoothingEnabled=false;x.drawImage(fc,0,0,cv.width,cv.height);
  $('g_info').textContent='frame '+(fr+1)+' / '+seqs.cur.length+' · patches '+seqs.cur[fr].i+'…'+(seqs.cur[fr].i+seqs.cur[fr].c-1); }
function loadPal(){ try{ P=pal(R,hex($('g_po').value)); }catch(e){ P=[];st('Palette offset is outside the ROM.','err'); } cache.clear(); }
function pick(off){ seqs.cur=seq(R,off); fr=0;acc=0; if(!seqs.cur.length)st('No valid sequence at 0x'+off.toString(16).toUpperCase()+'.','warn'); else st(seqs.cur.length+' frames. If the picture looks wrong, step the palette, set a base image, or toggle Swap w/h.','ok'); show(); }
function setup(){ const np=+$('g_pn').value; seqs.found=discover(R,np,0x160000,0x170000);
  $('g_seq').innerHTML=seqs.found.map(s=>`<option value="${s.off}">0x${s.off.toString(16).toUpperCase()} · ${s.n} entries</option>`).join('')||'<option value="">(none found — use manual offset)</option>';
  const h=n=>'0x'+n.toString(16).toUpperCase();
  $('g_dc').innerHTML='<option value="">—</option>'+DC.map(d=>`<option value="${d[0]},${d[1]}">${h(d[0])} × ${d[1]}</option>`).join('');
  $('g_pc').innerHTML='<option value="">—</option>'+CP.map(o=>`<option value="${o.toString(16)}">${h(o)}</option>`).join('');
  $('g_bc').innerHTML='<option value="">none</option>'+CB.map(b=>`<option value="${b[0].toString(16)}">${h(b[0])} (${b[1]} B)</option>`).join('');
  loadPal(); const f=seqs.found[0]; if(f)pick(f.off); }
const loadRom=async f=>{ R=new Uint8Array(await f.arrayBuffer()); cache.clear();
  const t=String.fromCharCode(...R.subarray(0xA0,0xAC)); $('g_ui').style.display=''; setup();
  if(t!=='GYAKUTEN_SA3')st('Header says "'+t.trim()+'", not GYAKUTEN_SA3 — offsets are for the Japanese GS3 ROM and may not apply.','warn'); if(card.scrollIntoView)card.scrollIntoView({behavior:'smooth',block:'start'}); };
$('g_file').onchange=e=>{ if(e.target.files[0])loadRom(e.target.files[0]); };
// A .gba dropped or picked in the tool's own "Load files" box is sent here instead of being rejected.
const isRom=fs=>[...(fs||[])].find(f=>/\.gba$/i.test(f.name));
document.addEventListener('change',e=>{ if(e.target.id==='fin'){ const f=isRom(e.target.files); if(f){ e.stopImmediatePropagation(); loadRom(f); e.target.value=''; } } },true);
document.addEventListener('drop',e=>{ const f=isRom(e.dataTransfer&&e.dataTransfer.files); if(f){ e.preventDefault(); e.stopImmediatePropagation(); loadRom(f); } },true);
$('g_seq').onchange=()=>$('g_seq').value&&pick(+$('g_seq').value);
$('g_dc').onchange=()=>{ const v=$('g_dc').value; if(!v)return; const [a,n]=v.split(',').map(Number); seqs.cur=[{b:a,i:0,c:n}]; fr=0; st('Scene draw: '+n+' patch(es) at 0x'+a.toString(16).toUpperCase()+' (single frame).','ok'); show(); };
$('g_pc').onchange=()=>{ if($('g_pc').value){$('g_po').value=$('g_pc').value.toUpperCase();loadPal();show();} };
$('g_bc').onchange=()=>{ $('g_bo').value=$('g_bc').value.toUpperCase(); cache.clear(); show(); };
$('g_so').onchange=()=>pick(hex($('g_so').value));
for(const id of ['g_pt','g_pn'])$(id).onchange=setup;
for(const id of ['g_bo','g_bb','g_bw','g_tr','g_sw','g_cu','g_cr','g_z'])$(id).onchange=()=>{cache.size>1e4&&cache.clear();show();};
$('g_po').onchange=()=>{loadPal();show();};
const stepPal=d=>{ $('g_po').value=Math.max(0,hex($('g_po').value)+d).toString(16).toUpperCase(); loadPal(); show(); };
$('g_pm').onclick=()=>stepPal(-0x200); $('g_pp').onclick=()=>stepPal(0x200);
$('g_play').onclick=()=>{play=!play;$('g_play').textContent=play?'Pause':'Play';acc=0;};
$('g_prev').onclick=()=>{play=false;$('g_play').textContent='Play';fr--;show();}; $('g_next').onclick=()=>{play=false;$('g_play').textContent='Play';fr++;show();};
$('g_png').onclick=()=>frameCanvas(fr).toBlob(b=>dl(b,'gba_frame_'+fr+'.png'));
function tick(ts){ requestAnimationFrame(tick); if(!R||!seqs.cur||!seqs.cur.length||!play||card.offsetParent===null){last=ts;return;}
  acc+=(ts-last)*0.06;last=ts; const d=Math.max(1,+$('g_dur').value||8); if(acc>=d){acc-=d;fr++;show();} }
requestAnimationFrame(tick);
$('g_gif').onclick=async()=>{ if(typeof getFF!=='function'){st('ffmpeg export needs the main tool page.','err');return;} const b=$('g_gif'); b.disabled=true; const w=[];
  try{ const f=await getFF(),d=(Math.max(1,+$('g_dur').value||8)/60).toFixed(5); let l='';
    for(let i=0;i<seqs.cur.length;i++){ const bl=await new Promise(r=>frameCanvas(i).toBlob(r)),n='g'+i+'.png'; await f.writeFile(n,new Uint8Array(await bl.arrayBuffer())); w.push(n); l+="file '"+n+"'\nduration "+d+"\n"; }
    l+="file 'g"+(seqs.cur.length-1)+".png'\n"; await f.writeFile('gl.txt',l); w.push('gl.txt');
    const c=await f.exec(['-f','concat','-i','gl.txt','-vf','split[a][b];[a]palettegen=reserve_transparent=1[p];[b][p]paletteuse=alpha_threshold=128','-vsync','vfr','-loop','0','go.gif']); if(c!==0)throw new Error('ffmpeg exit '+c);
    w.push('go.gif'); dl(new Blob([(await f.readFile('go.gif')).buffer],{type:'image/gif'}),'gba_sequence.gif'); st('GIF exported.','ok');
  }catch(e){st('Export failed: '+e.message,'err');} finally{ if(typeof ff!=='undefined'&&ff)for(const n of w){try{await ff.deleteFile(n);}catch(_){}} b.disabled=false; } };
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
