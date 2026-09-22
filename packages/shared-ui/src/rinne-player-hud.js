const PLAYER_NAMES=Object.freeze(['ナギ','スイ','トワ','ヒナ','ユラ','ソラ','ミオ','レン','コハク','アオ','ツムギ','サク','リツ','フウ','ノノ','カナデ']);

const hashSeed=value=>{
  if(Number.isFinite(Number(value)))return Number(value)>>>0;
  let hash=2166136261;
  for(const ch of String(value??'')){hash^=ch.codePointAt(0);hash=Math.imul(hash,16777619);}
  return hash>>>0;
};
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

export function rinnePlayerNameFromSeed(seed=1){const n=hashSeed(seed);return PLAYER_NAMES[n%PLAYER_NAMES.length];}
export function rinnePreviewPlayer(seed=Date.now()){
  const n=hashSeed(seed);
  return Object.freeze({name:rinnePlayerNameFromSeed(n),age:18+((n>>>7)%28)});
}

export function createRinnePlayerHud(root,{name='旅人',age=0}={}){
  if(!root)return null;
  root.classList.add('rinne-player-hud-host');
  const card=document.createElement('section');card.className='rinne-player-hud';card.setAttribute('aria-label','プレイヤー情報');
  const portrait=document.createElement('div');portrait.className='rinne-player-hud__portrait';
  const canvas=document.createElement('canvas');canvas.width=96;canvas.height=96;canvas.setAttribute('aria-hidden','true');
  const fallback=document.createElement('span');fallback.className='rinne-player-hud__fallback';fallback.setAttribute('aria-hidden','true');fallback.textContent='✦';
  portrait.append(canvas,fallback);
  const info=document.createElement('div');info.className='rinne-player-hud__text';
  const nameNode=document.createElement('strong'),ageNode=document.createElement('small');nameNode.className='rinne-player-hud__name';ageNode.className='rinne-player-hud__age';info.append(nameNode,ageNode);
  const charm=document.createElement('i');charm.className='rinne-player-hud__charm';charm.setAttribute('aria-hidden','true');charm.textContent='❀';
  card.append(portrait,info,charm);root.replaceChildren(card);
  let raf=0,lastCapture=-Infinity,destroyed=false;
  const update=next=>{if(!next)return;nameNode.textContent=String(next.name||'旅人').trim()||'旅人';const years=clamp(Math.floor(Number(next.age)||0),0,999);ageNode.textContent=years+'歳';card.setAttribute('aria-label',nameNode.textContent+' '+ageNode.textContent);};
  const draw=(source,{x=.5,y=.56,scale=.3}={})=>{
    if(destroyed||!source||!Number.isFinite(source.width)||!Number.isFinite(source.height)||source.width<2||source.height<2)return false;
    const ctx=canvas.getContext('2d');if(!ctx)return false;
    const sw=source.width,sh=source.height,side=Math.max(24,Math.min(sw,sh)*clamp(Number(scale)||.3,.18,.5)),cx=clamp(Number(x)||.5,0,1)*sw,cy=clamp(Number(y)||.56,0,1)*sh;
    const sx=clamp(cx-side*.5,0,Math.max(0,sw-side)),sy=clamp(cy-side*.54,0,Math.max(0,sh-side));
    try{ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(source,sx,sy,side,side,0,0,canvas.width,canvas.height);root.dataset.portrait='live';return true;}catch{return false;}
  };
  const capture=(source,options={})=>{
    const now=globalThis.performance?.now?.()??Date.now();if(destroyed||raf||now-lastCapture<180)return false;
    lastCapture=now;const run=()=>{raf=0;draw(source,options);};
    if(typeof globalThis.requestAnimationFrame==='function')raf=globalThis.requestAnimationFrame(run);else run();
    return true;
  };
  update({name,age});
  return Object.freeze({root,canvas,update,capture,destroy(){destroyed=true;if(raf&&typeof globalThis.cancelAnimationFrame==='function')globalThis.cancelAnimationFrame(raf);root.replaceChildren();root.classList.remove('rinne-player-hud-host');}});
}
