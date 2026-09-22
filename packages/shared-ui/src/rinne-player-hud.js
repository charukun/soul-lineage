const PLAYER_NAMES=Object.freeze(['ナギ','スイ','トワ','ヒナ','ユラ','ソラ','ミオ','レン','コハク','アオ','ツムギ','サク','リツ','フウ','ノノ','カナデ']);
const AVATAR_SKIN=Object.freeze(['#e8b891','#d9a177','#c78c67','#b77d59']);
const AVATAR_HAIR=Object.freeze(['#342a29','#4a332b','#5a4637','#26333a','#3d2d49','#665033']);
const AVATAR_CLOTH=Object.freeze(['#355f59','#596b48','#6a4a3b','#40566f','#68475f','#6a633f']);

const hashSeed=value=>{
  if(Number.isFinite(Number(value)))return Number(value)>>>0;
  let hash=2166136261;
  for(const ch of String(value??'')){hash^=ch.codePointAt(0);hash=Math.imul(hash,16777619);}
  return hash>>>0;
};
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const avatarPalette=seed=>{const n=hashSeed(seed);return{skin:AVATAR_SKIN[(n>>>2)%AVATAR_SKIN.length],hair:AVATAR_HAIR[(n>>>7)%AVATAR_HAIR.length],cloth:AVATAR_CLOTH[(n>>>12)%AVATAR_CLOTH.length],bang:(n>>>17)%3};};
function createStaticAvatar(doc,seed){
  const {skin,hair,cloth,bang}=avatarPalette(seed),svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.classList.add('rinne-player-hud__avatar');svg.setAttribute('viewBox','0 0 96 96');svg.setAttribute('aria-hidden','true');
  const fringe=bang===0?'M25 39c5-18 42-22 48 1-12-9-28-13-48-1Z':bang===1?'M24 40c4-18 43-22 49 1-17-8-29-8-49-1Z':'M24 40c4-18 43-22 49 1-11-10-32-11-49-1Z';
  svg.innerHTML='<circle cx="48" cy="48" r="44" fill="#14201e"/><path d="M16 90c3-18 16-28 32-28s29 10 32 28" fill="'+cloth+'"/><circle cx="48" cy="44" r="22" fill="'+skin+'"/><path d="'+fringe+'" fill="'+hair+'"/><path d="M27 41c1-16 9-25 21-25 13 0 21 9 22 25-7-7-13-12-22-12-8 0-15 4-21 12Z" fill="'+hair+'"/><circle cx="40" cy="47" r="2.1" fill="#17201e"/><circle cx="56" cy="47" r="2.1" fill="#17201e"/><path d="M43 56c3 2 7 2 10 0" fill="none" stroke="#8d5b4f" stroke-width="1.8" stroke-linecap="round"/><path d="M30 68c7 5 29 5 36 0" fill="none" stroke="rgba(238,215,170,.46)" stroke-width="2"/>';
  return svg;
}

export function rinnePlayerNameFromSeed(seed=1){const n=hashSeed(seed);return PLAYER_NAMES[n%PLAYER_NAMES.length];}
export function rinnePreviewPlayer(seed=Date.now()){
  const n=hashSeed(seed);
  return Object.freeze({name:rinnePlayerNameFromSeed(n),age:18+((n>>>7)%28),avatarSeed:n});
}

export function createRinnePlayerHud(root,{name='旅人',age=0,avatarSeed=null,portraitMode='live'}={}){
  if(!root)return null;
  root.classList.add('rinne-player-hud-host');
  const card=document.createElement('section');card.className='rinne-player-hud';card.setAttribute('aria-label','プレイヤー情報');
  const portrait=document.createElement('div');portrait.className='rinne-player-hud__portrait';
  const canvas=document.createElement('canvas');canvas.width=96;canvas.height=96;canvas.setAttribute('aria-hidden','true');
  const fallback=document.createElement('span');fallback.className='rinne-player-hud__fallback';fallback.setAttribute('aria-hidden','true');fallback.textContent='✦';
  const staticPortrait=portraitMode==='static',avatar=staticPortrait?createStaticAvatar(root.ownerDocument||document,avatarSeed??name):null;
  portrait.append(canvas,fallback);if(avatar)portrait.append(avatar);
  const info=document.createElement('div');info.className='rinne-player-hud__text';
  const nameNode=document.createElement('strong'),ageNode=document.createElement('small');nameNode.className='rinne-player-hud__name';ageNode.className='rinne-player-hud__age';info.append(nameNode,ageNode);
  const charm=document.createElement('i');charm.className='rinne-player-hud__charm';charm.setAttribute('aria-hidden','true');charm.textContent='❀';
  card.append(portrait,info,charm);root.replaceChildren(card);
  let lastCapture=-Infinity,destroyed=false;if(staticPortrait)root.dataset.portrait='static';
  const update=next=>{if(!next)return;nameNode.textContent=String(next.name||'旅人').trim()||'旅人';const years=clamp(Math.floor(Number(next.age)||0),0,999);ageNode.textContent=years+'歳';card.setAttribute('aria-label',nameNode.textContent+' '+ageNode.textContent);};
  const draw=(source,{x=.5,y=.56,scale=.3}={})=>{
    if(staticPortrait||destroyed||!source||!Number.isFinite(source.width)||!Number.isFinite(source.height)||source.width<2||source.height<2)return false;
    const ctx=canvas.getContext('2d');if(!ctx)return false;
    const sw=source.width,sh=source.height,side=Math.max(24,Math.min(sw,sh)*clamp(Number(scale)||.3,.18,.5)),cx=clamp(Number(x)||.5,0,1)*sw,cy=clamp(Number(y)||.56,0,1)*sh;
    const sx=clamp(cx-side*.5,0,Math.max(0,sw-side)),sy=clamp(cy-side*.54,0,Math.max(0,sh-side));
    try{ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(source,sx,sy,side,side,0,0,canvas.width,canvas.height);root.dataset.portrait='live';return true;}catch{delete root.dataset.portrait;return false;}
  };
  const capture=(source,options={})=>{
    if(staticPortrait)return false;
    const now=globalThis.performance?.now?.()??Date.now();if(destroyed||now-lastCapture<180)return false;
    lastCapture=now;
    return draw(source,options);
  };
  update({name,age});
  return Object.freeze({root,canvas,update,capture,destroy(){destroyed=true;delete root.dataset.portrait;root.replaceChildren();root.classList.remove('rinne-player-hud-host');}});
}
