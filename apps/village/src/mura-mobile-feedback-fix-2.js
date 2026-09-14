import {THREE as T} from '@soul/rendering';
import {defs,worldToLocal} from './game/core.js';

const village=window.village;
if(!village)throw new Error('MURAAAAAAA mobile feedback fix 2 requires a booted village');
const {world,view,ui}=village;
const $=id=>document.getElementById(id);

const css=document.createElement('style');
css.dataset.muraMobileFeedbackFix2='1';
css.textContent=`
/* HUD collision guard: information owns the width, actions get their own compact lane. */
@media(max-width:560px){
 .muraCompactHud{grid-template-columns:minmax(0,1fr) auto!important;grid-template-rows:auto auto auto!important;gap:2px 4px!important}
 .muraHudTop{grid-column:1/-1!important;grid-row:1!important}.muraHudStats{grid-column:1!important;grid-row:2!important}.muraHudActions{grid-column:2!important;grid-row:2!important;align-self:center!important}.muraHudResources{grid-column:1/-1!important;grid-row:3!important;border-left:0!important;padding-left:0!important;max-width:100%!important;padding-right:2px!important}
 .muraHudResource:nth-child(n+7){display:none!important}
}
/* Cancel is part of the same felt control family, never a flat red rectangle. */
#muraCancelPlacement{background-color:#dfc9bd!important;background-image:radial-gradient(circle at 30% 20%,#fff8 0 1px,transparent 1.4px),radial-gradient(circle at 72% 72%,#72584c13 0 .8px,transparent 1.4px),linear-gradient(#ead8cd,#d8beb1)!important;background-size:8px 8px,10px 10px,100% 100%!important;border:1px solid #7d5e5034!important;box-shadow:inset 0 1px 0 #fff8,inset 0 -2px 4px #6f514516,0 3px 8px #3d302a12!important;color:#704b43!important;border-radius:11px!important}
/* Selection is a hint, not a boss-fight effect. */
.muraSelectionTag{padding:2px 5px!important;border-radius:7px!important;font-size:7px!important;font-weight:700!important;background:#fff1cb9e!important;border-color:#b9954f38!important;box-shadow:0 2px 6px #44341d12!important}
/* One close glyph only. */
button[data-mura-close-clean='1']{font-size:0!important;padding-left:5px!important;padding-right:5px!important}button[data-mura-close-clean='1'] .muraButtonIcon{margin:0!important;width:16px!important;height:16px!important}button[data-mura-close-clean='1'] svg{width:15px!important;height:15px!important}
/* Village activity is tappable when it points at a resident. */
#muraIdleDetails[data-person-id]{pointer-events:auto!important;cursor:pointer!important}#muraIdleDetails[data-person-id]:active{transform:translateY(0) scale(.985)!important}
/* Resident camera presets. */
.muraPersonCamera{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin:9px 0 4px;padding-top:8px;border-top:1px solid #75644822}.muraPersonCamera button{min-height:31px!important;padding:4px 5px!important;font-size:8px!important;background:#d7e2c9!important;border:1px solid #6d785b2d!important;border-radius:10px!important;box-shadow:inset 0 1px 0 #fff8!important}.muraPersonCamera small{grid-column:1/-1;font-size:7px;opacity:.62}
/* Construction progress lives in-world and stays small. */
#muraConstructionLayer{position:fixed;inset:0;pointer-events:none;z-index:19}.muraBuildProgress{position:absolute;left:0;top:0;min-width:92px;max-width:140px;padding:4px 6px 5px;border-radius:9px;background:linear-gradient(145deg,rgba(247,240,220,.78),rgba(222,229,207,.70));border:1px solid rgba(255,255,238,.62);box-shadow:0 4px 12px rgba(43,55,39,.12),inset 0 1px 0 #fff8;backdrop-filter:blur(5px);transform:translate(-50%,-100%);color:#45574c}.muraBuildProgressHead{display:flex;justify-content:space-between;gap:7px;align-items:center;font-size:7px;line-height:1.2;margin-bottom:3px}.muraBuildProgressHead b{font-size:7px;max-width:92px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.muraBuildProgressTrack{height:4px;border-radius:4px;background:#76846c24;overflow:hidden;box-shadow:inset 0 1px 2px #33412e18}.muraBuildProgressTrack i{display:block;height:100%;border-radius:4px;background:linear-gradient(90deg,#9bb18d,#c5b171);transition:width .18s linear}
/* Compact settings control in the HUD. */
#muraSettingsButton{position:static!important;min-width:22px!important;width:22px!important;height:22px!important;min-height:22px!important;padding:2px!important;border-radius:9px!important;background:rgba(255,250,234,.18)!important;border:1px solid rgba(91,104,78,.09)!important;box-shadow:none!important}#muraSettingsButton svg{width:12px!important;height:12px!important;margin:0!important}.muraTitleAction{width:100%;min-height:36px!important;font-weight:800!important}
`;
document.head.append(css);

function restoreProceduralResidents(){
 const repair=()=>{for(const p of world.people){const root=view.actorNodes?.get?.(p.id);if(!root)continue;root.visible=true;root.traverse?.(node=>{if(!node.isMesh)return;node.visible=true;const mats=Array.isArray(node.material)?node.material:[node.material];for(const m of mats){if(!m)continue;if(m.opacity!==undefined&&m.opacity<=.05){m.opacity=1;m.transparent=false;m.needsUpdate=true;}}});}};
 repair();setInterval(repair,700);
}

function softenSelectionEffect(){
 const soften=()=>view.scene?.traverse?.(node=>{if(!node.isMesh||node.geometry?.type!=='RingGeometry')return;const color=node.material?.color?.getHex?.();if(color!==0xffd47f)return;node.material.opacity=Math.min(node.material.opacity??1,.20);node.material.needsUpdate=true;});
 soften();setInterval(soften,900);
}

function cleanDuplicateCloseButtons(root=document){
 const scan=node=>{const buttons=[];if(node?.matches?.('button'))buttons.push(node);if(node?.querySelectorAll)buttons.push(...node.querySelectorAll('button'));for(const b of buttons){const raw=(b.textContent||'').trim();if(raw!=='×'||!b.querySelector('.muraButtonIcon'))continue;b.dataset.muraCloseClean='1';for(const child of [...b.childNodes])if(child.nodeType===Node.TEXT_NODE)child.remove();}};
 scan(root);new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1)scan(node);}).observe(document.body,{childList:true,subtree:true});
}

function sharpenRoadAgainstTilt(){
 const trail=view.trails,texture=view.trailTexture;if(!trail?.material||!texture)return;
 trail.material.color?.set?.(0x8b7657);trail.material.opacity=.82;trail.material.transparent=true;trail.material.alphaTest=.08;trail.material.roughness=1;trail.material.needsUpdate=true;
 texture.anisotropy=Math.min(8,view.renderer?.capabilities?.getMaxAnisotropy?.()||1);texture.minFilter=T.LinearMipmapLinearFilter;texture.magFilter=T.LinearFilter;texture.needsUpdate=true;
}

function installSingleCommitPlacement(){
 const canvas=$('game');if(!canvas)return;const active=new Map();
 canvas.addEventListener('pointerdown',e=>{if(!ui.pending)return;active.set(e.pointerId,{x:e.clientX,y:e.clientY,moved:false});},{capture:true,passive:true});
 canvas.addEventListener('pointermove',e=>{const p=active.get(e.pointerId);if(!p)return;if(Math.hypot(e.clientX-p.x,e.clientY-p.y)>7)p.moved=true;},{capture:true,passive:true});
 canvas.addEventListener('pointerup',e=>{const p=active.get(e.pointerId);active.delete(e.pointerId);if(!ui.pending||!p||p.moved)return;
  e.stopImmediatePropagation();
  try{canvas.dispatchEvent(new PointerEvent('pointercancel',{pointerId:e.pointerId,pointerType:e.pointerType,bubbles:false}));}catch{}
  const ground=view.ground(e.clientX,e.clientY);if(!ground)return;const pending=ui.pending,q=pending.roomId?worldToLocal(world.object(pending.roomId),ground.x,ground.z):ground;pending.x=q.x;pending.z=q.z;pending.error=world.canPlace(pending.kind,q.x,q.z,pending.rot,pending.roomId,pending.moveId);view.setGhost(pending.kind,q.x,q.z,pending.rot,!pending.error,pending.material);const text=$('placementText');if(text)text.textContent=`${defs[pending.kind]?.label||pending.kind} · ${pending.error||'ここに置けます · 完了で決定'}`;$('placement')?.classList.toggle('invalid',!!pending.error);
 },{capture:true,passive:false});
 canvas.addEventListener('pointercancel',e=>active.delete(e.pointerId),{capture:true,passive:true});
}

function personFromDetail(){
 const detail=$('muraIdleDetails');if(!detail)return null;const text=detail.querySelector('.muraIdleDetailsText')?.textContent||detail.textContent||'';return world.people.find(p=>p.name&&text.includes(p.name))||null;
}
function installActivityFocus(){
 const detail=$('muraIdleDetails');if(!detail)return;const sync=()=>{const p=personFromDetail();if(p)detail.dataset.personId=p.id;else delete detail.dataset.personId;};setInterval(sync,220);
 detail.addEventListener('click',()=>{const p=personFromDetail();if(!p)return;view.followId=p.id;view.pitch=.55;view.focus(p.x,p.z,18);view.lastInteraction=performance.now();});
}

function focusPerson(p,mode){
 if(!p)return;view.followId=p.id;const angle=Number(p.angle)||0;
 if(mode==='front'){view.yaw=angle+Math.PI;view.pitch=.22;view.focus(p.x,p.z,10);}
 else if(mode==='back'){view.yaw=angle;view.pitch=.22;view.focus(p.x,p.z,10);}
 else if(mode==='side'){view.yaw=angle+Math.PI/2;view.pitch=.25;view.focus(p.x,p.z,11);}
 else{view.pitch=.68;view.focus(p.x,p.z,20);}
 view.cameraGoal=null;view.updateCamera?.();view.lastInteraction=performance.now();
}
function installPersonCameraPresets(){
 const host=$('dialogContent');if(!host)return;
 const enhance=()=>{if(host.querySelector('.muraPersonCamera'))return;const name=host.querySelector('h2')?.textContent?.trim();if(!name)return;const p=world.people.find(person=>person.name===name);if(!p)return;const bar=document.createElement('div');bar.className='muraPersonCamera';bar.innerHTML='<small>住人を見る</small><button type="button" data-camera="front">正面</button><button type="button" data-camera="side">横</button><button type="button" data-camera="back">背面</button><button type="button" data-camera="top">俯瞰</button>';host.append(bar);for(const b of bar.querySelectorAll('button'))b.onclick=()=>{$('dialog')?.close();focusPerson(p,b.dataset.camera);};};
 new MutationObserver(()=>queueMicrotask(enhance)).observe(host,{childList:true});enhance();
}

function installConstructionProgress(){
 const layer=document.createElement('div');layer.id='muraConstructionLayer';document.body.append(layer);const nodes=new Map();
 const loop=()=>{const active=[];for(const o of world.objects){let progress=null,label='';if(o.phase==='building'){progress=Math.max(0,Math.min(1,Number(o.progress)||0));label='建築';}else if(o.upgrade){progress=Math.max(0,Math.min(1,Number(o.upgrade.progress)||0));label='増築';}if(progress===null)continue;active.push(o.id);let node=nodes.get(o.id);if(!node){node=document.createElement('div');node.className='muraBuildProgress';node.innerHTML='<div class="muraBuildProgressHead"><b></b><span></span></div><div class="muraBuildProgressTrack"><i></i></div>';layer.append(node);nodes.set(o.id,node);}const point=view.project(o.x,4,o.z);node.hidden=point.x<20||point.x>innerWidth-20||point.y<60||point.y>innerHeight-70;node.style.transform=`translate(${point.x}px,${point.y}px) translate(-50%,-100%)`;node.querySelector('b').textContent=`${defs[o.kind]?.label||o.kind} · ${label}`;node.querySelector('span').textContent=`${Math.round(progress*100)}%`;node.querySelector('i').style.width=`${Math.max(3,progress*100)}%`;}
  for(const[id,node]of nodes)if(!active.includes(id)){node.remove();nodes.delete(id);}requestAnimationFrame(loop);};requestAnimationFrame(loop);
}

function installSettingsAndTitle(){
 const actions=document.querySelector('.muraHudActions');if(!actions||$('muraSettingsButton'))return;const b=document.createElement('button');b.id='muraSettingsButton';b.type='button';b.dataset.muraIcon='native';b.setAttribute('aria-label','設定');b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5L9.2 6a7 7 0 0 0-1.7 1L5 6 3 9.5 5.1 11a7 7 0 0 0 0 2L3 14.5 5 18l2.5-1a7 7 0 0 0 1.7 1l.3 3h5l.3-3a7 7 0 0 0 1.7-1l2.5 1 2-3.5-2.1-1.5a7 7 0 0 0 .1-1Z"/></svg>';actions.append(b);
 b.onclick=()=>{const more=$('more');if(more)more.click();queueMicrotask(()=>{const host=$('dialogContent');if(!host||host.querySelector('.muraTitleAction'))return;const title=document.createElement('button');title.type='button';title.className='wide muraTitleAction';title.textContent='タイトル';host.append(title);title.onclick=async()=>{try{await village.save?.();}catch{}location.reload();};normalizeButtonLabels(host);});};
}

const BUTTON_LABELS=new Map([
 ['この人に、そっとカメラを合わせる','追う'],['この住まいの内装を見る','内装'],['空き住まいへ住み替え','住み替え'],['資材を使って増築する','増築'],['この建物を削除する','削除'],['この設置物を削除する','削除'],['村をファイルに保存','保存'],['保存した村を読み込む','読込'],['いまの景色を撮る','撮影'],['暮らしの記録','記録'],['村のしくみ','ヘルプ'],['オンライン村（参加コード）','オンライン'],['一族の居住を試す（ローカル）','一族デモ'],['カメラがそっと追いかけます。指で動かすと追従を終えます。','追う']
]);
function normalizeButtonLabels(root=document){
 const buttons=[];if(root.matches?.('button'))buttons.push(root);if(root.querySelectorAll)buttons.push(...root.querySelectorAll('button'));for(const b of buttons){if(b.dataset.camera||b.id==='muraSettingsButton'||b.id==='muraResetVillage')continue;const text=(b.textContent||'').trim();let next=BUTTON_LABELS.get(text);if(!next){if(/^この.+を削除する$/.test(text))next='削除';else if(/増築する/.test(text))next='増築';else if(/カメラを合わせる/.test(text))next='追う';else if(/内装を見る/.test(text))next='内装';else if(/住み替え/.test(text)&&text.length>5)next='住み替え';}if(!next||next===text)continue;const icon=b.querySelector('.muraButtonIcon');b.replaceChildren();if(icon)b.append(icon);b.append(document.createTextNode(next));}
}
function installButtonLanguageCleanup(){normalizeButtonLabels();new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes)if(n.nodeType===1)normalizeButtonLabels(n);}).observe(document.body,{childList:true,subtree:true});setInterval(()=>normalizeButtonLabels(),1000);}

restoreProceduralResidents();
softenSelectionEffect();
cleanDuplicateCloseButtons();
sharpenRoadAgainstTilt();
installSingleCommitPlacement();
installActivityFocus();
installPersonCameraPresets();
installConstructionProgress();
installSettingsAndTitle();
installButtonLanguageCleanup();

window.__MURA_MOBILE_FEEDBACK_FIX_2__={version:2};
