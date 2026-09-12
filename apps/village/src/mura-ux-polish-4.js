import {THREE as T} from '@soul/rendering';
import {World,defs,isPlayer,ready} from './game/core.js';

const village=window.village;
if(!village)throw new Error('MURAAAAAAA UX polish 4 requires a booted village');
const {world,view,ui}=village;
const $=id=>document.getElementById(id);

const css=document.createElement('style');
css.dataset.muraUxPolish4='1';
css.textContent=`
/* Entry title always fits narrow phones. */
#muraEntryCard h2{font-size:clamp(31px,9vw,58px)!important;letter-spacing:.018em!important;text-indent:.018em!important;white-space:nowrap!important;max-width:100%!important;overflow:visible!important}

/* Compact header that expands on demand. */
#idleStatus{cursor:pointer!important;overflow:hidden!important;transition:max-height .28s ease,padding .28s ease,box-shadow .28s ease!important;max-height:58px!important}
#idleStatus.muraHudExpanded{max-height:150px!important;box-shadow:0 16px 40px rgba(35,50,39,.16),inset 0 1px 0 rgba(255,255,255,.45)!important}
#idleStatus:not(.muraHudExpanded) .muraHudResources{display:none!important}
#idleStatus:not(.muraHudExpanded) .muraHudClock{max-width:50vw!important}
.muraHudChevron{margin-left:auto;font-size:10px;opacity:.55;transition:transform .2s ease}.muraHudExpanded .muraHudChevron{transform:rotate(180deg)}
#focusMode,#housingMode{top:calc(var(--mura-hud-bottom,64px) + 6px)!important;right:8px!important;z-index:25!important;max-width:min(250px,calc(100vw - 16px))!important}
#housingMode{top:calc(var(--mura-hud-bottom,64px) + 48px)!important}

/* Resident moments bloom in the center, independent of the header. */
#muraIdleDetails{left:50%!important;top:50%!important;transform:translate(-50%,-46%) scale(.96)!important;width:min(390px,calc(100vw - 36px))!important;text-align:center!important;opacity:0!important;z-index:34!important;pointer-events:none!important;background-color:rgba(239,232,210,.88)!important;background-image:radial-gradient(circle at 25% 25%,#fff8 0 1px,transparent 1.5px),linear-gradient(145deg,rgba(250,243,223,.90),rgba(219,228,200,.82))!important;border:1px solid rgba(91,103,76,.20)!important;border-radius:20px!important;box-shadow:0 18px 50px rgba(37,51,40,.18),inset 0 1px 0 #fff9!important;backdrop-filter:blur(12px) saturate(.9)!important;transition:opacity .28s ease,transform .28s ease!important}
#muraIdleDetails.muraIdleDetailsVisible{opacity:1!important;transform:translate(-50%,-50%) scale(1)!important}
#muraIdleDetails[data-person-id]{pointer-events:auto!important}
.muraIdleDetailsLabel{font-size:7px!important;letter-spacing:.16em!important}.muraIdleDetailsText{font-size:11px!important;line-height:1.55!important}.muraIdleDetailsMeta{font-size:8px!important}

/* Speech lives over the speaker's head instead of their body. */
#speechLayer .speech{translate:0 -30px!important;transform-origin:50% 100%!important}
#speechLayer.muraBubbleMicro .speech{translate:0 -22px!important}

/* Person details and toast messages belong to the felt world. */
#dialog.muraPersonDialog{background-color:rgba(239,232,210,.96)!important;background-image:radial-gradient(circle at 25% 25%,#fff8 0 1px,transparent 1.5px),radial-gradient(circle at 72% 68%,#6d5a4114 0 .8px,transparent 1.4px),linear-gradient(145deg,#f8efdc,#dce4ca)!important;background-size:9px 9px,11px 11px,100% 100%!important;border:1px solid rgba(89,103,75,.22)!important;border-radius:24px!important;box-shadow:0 24px 66px rgba(31,45,35,.25),inset 0 1px 0 #fff9!important;color:#405147!important;backdrop-filter:blur(15px) saturate(.9)!important}
#dialog.muraPersonDialog .personMeters{background:rgba(255,250,232,.34)!important;border:1px solid rgba(91,102,77,.10)!important;border-radius:14px!important;padding:8px!important}.muraPersonCamera button{background-image:radial-gradient(circle at 25% 25%,#fff7 0 1px,transparent 1.4px),linear-gradient(#dce7cd,#c8d6b7)!important;box-shadow:inset 0 1px 0 #fff9,0 3px 8px rgba(45,58,43,.08)!important}
#toast{background-color:rgba(239,232,210,.92)!important;background-image:radial-gradient(circle at 25% 25%,#fff8 0 1px,transparent 1.5px),linear-gradient(145deg,#f8efdc,#dce4ca)!important;border:1px solid rgba(88,102,75,.18)!important;border-radius:16px!important;box-shadow:0 12px 36px rgba(35,50,39,.16),inset 0 1px 0 #fff9!important;color:#405147!important;backdrop-filter:blur(10px)!important}

/* Tutorial target guidance. */
#catalog .card.muraTutorialTarget{position:relative!important;z-index:2!important;animation:muraTutorialGlow 1s ease-in-out infinite alternate!important;border-color:rgba(147,117,64,.40)!important}
#catalog .card.muraTutorialTarget:after{content:'';position:absolute;inset:-5px;border-radius:15px;border:2px solid rgba(226,190,112,.55);box-shadow:0 0 18px rgba(226,190,112,.32);pointer-events:none}
@keyframes muraTutorialGlow{from{filter:brightness(1)}to{filter:brightness(1.08)}}
#drawer footer #more{display:none!important}

/* Selection halo: tactile felt glow, not flat double rings. */
.muraSelectionTag{background-image:radial-gradient(circle at 28% 24%,#fff7 0 1px,transparent 1.4px),linear-gradient(#f4e7c8,#dfcfaa)!important;box-shadow:0 5px 14px rgba(69,55,34,.13),inset 0 1px 0 #fff8!important;border-color:rgba(128,102,54,.22)!important}

/* Lightweight press/ripple feedback. */
.muraUiRipple{position:fixed;z-index:120;width:10px;height:10px;border-radius:50%;border:2px solid rgba(255,239,185,.8);box-shadow:0 0 16px rgba(255,218,128,.55);pointer-events:none;transform:translate(-50%,-50%) scale(.35);animation:muraUiRipple .38s ease-out forwards}
@keyframes muraUiRipple{to{transform:translate(-50%,-50%) scale(2.6);opacity:0}}
button.muraPressedFx,.card.muraPressedFx{transform:scale(.975)!important;filter:brightness(1.04)!important}
`;
document.head.append(css);

function installUiFeedback(){
 let ctx=null;
 const context=()=>ctx||(ctx=new (window.AudioContext||window.webkitAudioContext)());
 const ping=(kind='tap')=>{try{const c=context();if(c.state==='suspended')void c.resume();const o=c.createOscillator(),g=c.createGain(),now=c.currentTime;o.connect(g).connect(c.destination);o.type='sine';o.frequency.setValueAtTime(kind==='confirm'?690:kind==='open'?510:430,now);o.frequency.exponentialRampToValueAtTime(kind==='confirm'?880:kind==='open'?610:490,now+.055);g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(kind==='confirm'?.055:.032,now+.008);g.gain.exponentialRampToValueAtTime(.0001,now+.09);o.start(now);o.stop(now+.1);}catch{}};
 document.addEventListener('pointerdown',e=>{const target=e.target.closest?.('button,.card');if(!target||target.disabled)return;const kind=/完了|開始|入る|増築|決定/.test(target.textContent||'')?'confirm':/設定|詳細|内装|つくる/.test(target.textContent||'')?'open':'tap';ping(kind);target.classList.add('muraPressedFx');setTimeout(()=>target.classList.remove('muraPressedFx'),120);const r=document.createElement('span');r.className='muraUiRipple';r.style.left=e.clientX+'px';r.style.top=e.clientY+'px';document.body.append(r);setTimeout(()=>r.remove(),420);},{capture:true,passive:true});
}

function installExpandableHud(){
 const hud=$('idleStatus');if(!hud)return;let top=hud.querySelector('.muraHudTop');if(top&&!top.querySelector('.muraHudChevron')){const c=document.createElement('span');c.className='muraHudChevron';c.textContent='⌄';top.append(c);}
 hud.addEventListener('click',e=>{if(e.target.closest('button'))return;hud.classList.toggle('muraHudExpanded');view.lastInteraction=performance.now();});
}

function stylePersonDialog(){
 const dialog=$('dialog'),host=$('dialogContent');if(!dialog||!host)return;const apply=()=>{const name=host.querySelector('h2')?.textContent?.trim();dialog.classList.toggle('muraPersonDialog',!!name&&world.people.some(p=>p.name===name));};new MutationObserver(()=>queueMicrotask(apply)).observe(host,{childList:true,subtree:true});apply();
}

function installTutorialGuidance(){
 const button=$('tutorialAction');if(!button)return;button.addEventListener('click',()=>{const step=world.tutorialStep?.();if(!step)return;setTimeout(()=>{view.focus?.(step.at?.[0]??view.target.x,step.at?.[1]??view.target.z,40);const target=document.querySelector(`#catalog .card[data-kind="${CSS.escape(step.kind)}"]`);for(const card of document.querySelectorAll('#catalog .card.muraTutorialTarget'))card.classList.remove('muraTutorialTarget');if(target){target.hidden=false;target.classList.add('muraTutorialTarget');target.scrollIntoView({block:'nearest',inline:'nearest',behavior:'smooth'});}},80);});
}

function softenWorldSelection(){
 const tick=()=>{const t=performance.now()/1000;let index=0;view.scene?.traverse?.(node=>{if(!node.isMesh||node.geometry?.type!=='RingGeometry')return;const mat=node.material;if(!mat)return;const hex=mat.color?.getHex?.();if(hex!==0xffd47f&&hex!==0xffe3a4)return;index++;mat.transparent=true;mat.opacity=.09+.025*Math.sin(t*2.2+index);mat.color?.set?.(0xd6b572);mat.depthWrite=false;node.scale.setScalar(1+.018*Math.sin(t*1.7+index));});requestAnimationFrame(tick);};requestAnimationFrame(tick);
}

function decorateFacilities(){
 const original=view.getBuilding.bind(view),done=new Set();
 const wood=new T.MeshStandardMaterial({color:0x8c6848,roughness:.95}),leaf=new T.MeshStandardMaterial({color:0x748b5f,roughness:1}),gold=new T.MeshStandardMaterial({color:0xc5a460,roughness:1}),stone=new T.MeshStandardMaterial({color:0x8f9388,roughness:1}),cloth=new T.MeshStandardMaterial({color:0x8d9f91,roughness:.95});
 const box=(g,x,y,z,w,h,d,m)=>{const n=new T.Mesh(new T.BoxGeometry(w,h,d),m);n.position.set(x,y,z);n.castShadow=n.receiveShadow=true;g.add(n);};
 view.getBuilding=(kind,material='base',level=1)=>{const g=original(kind,material,level);const key=`${kind}:${material}:${level}`;if(done.has(key))return g;done.add(key);
  if(kind==='logging'){for(let i=0;i<5;i++){const log=new T.Mesh(new T.CylinderGeometry(.28,.32,4.4,8),wood);log.rotation.z=Math.PI/2;log.position.set((i%2)*.5-.25,.35+Math.floor(i/2)*.5,-1.4+i%2*.55);g.add(log);}box(g,2.2,.55,1.7,.25,2.5,.25,cloth);}
  if(kind==='storage'){for(const [x,z] of[[-2,-1],[0,-1],[2,-1],[-1,1],[1,1]])box(g,x,.55,z,1.5,1.1,1.5,wood);}
  if(kind==='wheat'){for(let z=-4;z<=4;z+=1.35)for(let x=-4;x<=4;x+=1.35){const stalk=new T.Mesh(new T.CylinderGeometry(.035,.05,.9,5),gold);stalk.position.set(x,.45,z);g.add(stalk);}}
  if(kind==='quarry'){for(const [x,z,s] of[[-2,-1,1.1],[1,-1,.9],[2,2,1.3],[-1,2,.7]]){const rock=new T.Mesh(new T.DodecahedronGeometry(s),stone);rock.position.set(x,s*.55,z);g.add(rock);}}
  if(kind==='carpenter'){box(g,0,.85,-1,4.5,.45,1.5,wood);box(g,-1.7,1.7,-1,.18,1.8,.18,cloth);}
  if(kind==='guardpost'){box(g,0,2.2,0,.22,4.4,.22,wood);box(g,.65,3.4,0,1.3,.8,.08,cloth);}
  return g;};
 view.buildingCache?.clear?.();view.rebuild?.();
}

function enableMayorFacilityHousing(){
 const originalAdd=World.prototype.add,originalMove=World.prototype.move,originalRemove=World.prototype.remove;
 const withFacility=(self,roomId,fn)=>{const host=roomId&&self.object(roomId);if(!host||!defs[host.kind]?.building)return fn();const d=defs[host.kind],old=d.clanOnly;d.clanOnly=true;try{return fn();}finally{d.clanOnly=old;}};
 World.prototype.add=function(kind,x,z,rot=0,roomId=null,options={}){return withFacility(this,roomId,()=>originalAdd.call(this,kind,x,z,rot,roomId,options));};
 World.prototype.move=function(id,x,z,rot,roomId=null){return withFacility(this,roomId,()=>originalMove.call(this,id,x,z,rot,roomId));};
 World.prototype.remove=function(id,roomId=null){return withFacility(this,roomId,()=>originalRemove.call(this,id,roomId));};
 const refresh=()=>{const host=view.roomId&&world.object(view.roomId);const build=$('build');if(host&&defs[host.kind]?.building&&build)build.hidden=false;for(const card of document.querySelectorAll('#catalog .card')){const kind=card.dataset.kind;if(view.roomId&&defs[kind]?.furniture)card.hidden=false;}};setInterval(refresh,300);
}

function protectClanHomes(){
 const manor=defs.clanManor;if(manor){manor.w=Math.max(manor.w||0,28);manor.d=Math.max(manor.d||0,26);manor.capacity=Math.max(manor.capacity||0,4);}
 const originalAssign=World.prototype.assign;if(originalAssign)World.prototype.assign=function(personId,homeId){const p=this.people.find(n=>n.id===personId),h=this.object(homeId);if(p&&h&&defs[h.kind]?.clanOnly&&!isPlayer(p))return{error:'一族の家にはNPCは入居できません'};return originalAssign.call(this,personId,homeId);};
 for(const p of world.people){const home=world.object(p.homeId);if(home&&defs[home.kind]?.clanOnly&&!isPlayer(p)){p.homeId=world.objects.find(o=>ready(o)&&!defs[o.kind]?.clanOnly&&defs[o.kind]?.capacity)?.id||p.homeId;}}
}

installUiFeedback();
installExpandableHud();
stylePersonDialog();
installTutorialGuidance();
softenWorldSelection();
decorateFacilities();
enableMayorFacilityHousing();
protectClanHomes();

window.__MURA_UX_POLISH_4__={version:1};
