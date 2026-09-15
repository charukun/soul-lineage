import {defs,localToWorld} from './game/core.js';
import {findPlacementSite,commitPlacement} from './game/placement-guidance.js';

const village=window.village;
if(!village)throw new Error('First-build guidance requires the existing village');
const {world,view,ui}=village,$=id=>document.getElementById(id);
const panel=$('placement'),done=$('cancelPlace'),label=$('placementText'),canvas=view.canvas||$('game');
const actions=panel.querySelector('.actions'),rotateRight=$('rotate'),cancel=$('muraCancelPlacement');
const originalCanvasLabel=canvas.getAttribute('aria-label')||'村';

const rotateLeft=document.createElement('button');
rotateLeft.id='muraRotateLeft';rotateLeft.type='button';rotateLeft.textContent='↺';rotateLeft.setAttribute('aria-label','左へ90度回転');
actions.insertBefore(rotateLeft,rotateRight);
rotateRight.textContent='↻';rotateRight.setAttribute('aria-label','右へ90度回転');
cancel.textContent='×';cancel.setAttribute('aria-label','配置をやめる');

const undo=document.createElement('button');
undo.id='muraPlacementUndo';undo.type='button';undo.className='glass';undo.hidden=true;undo.textContent='↶ 取り消す';
document.body.append(undo);

const css=document.createElement('style');css.dataset.muraPlacement='center-follow';css.textContent=`
body.mura-placement-active #build{opacity:0;pointer-events:none}
body.mura-placement-active #placement{box-sizing:border-box!important;position:fixed!important;z-index:42!important;left:50%!important;top:calc(50% - clamp(94px,14vh,126px))!important;bottom:auto!important;transform:translate(-50%,-100%)!important;width:min(330px,calc(100vw - 24px))!important;max-height:min(44dvh,320px)!important;overflow:auto!important;padding:10px 12px!important;border-radius:17px!important;text-align:center!important}
body.mura-placement-active #placementText{display:block;font-size:11px;line-height:1.45;font-weight:650;letter-spacing:.01em}
body.mura-placement-active #placementCost{margin-top:4px!important}
body.mura-placement-active #placement>.actions{display:flex!important;align-items:center!important;justify-content:center!important;gap:7px!important;flex-wrap:nowrap!important;margin-top:7px!important}
body.mura-placement-active #placement>.actions button{flex:0 0 auto!important;min-width:44px!important;min-height:44px!important;padding:8px 12px!important;font-size:18px!important;background:rgba(113,128,99,.12)!important}
body.mura-placement-active #placement>.actions #cancelPlace{font-size:11px!important;min-width:92px!important}
body.mura-placement-active #placement>.actions #muraCancelPlacement{font-size:18px!important}
body.mura-placement-active #placement .rotationControl{margin-top:6px!important;display:grid!important;grid-template-columns:auto auto 1fr!important;align-items:center!important;gap:6px!important;font-size:9px!important}
body.mura-placement-active #placement #muraRotation{min-width:90px!important;height:32px!important}
body.mura-placement-active #placement #materialChoices{justify-content:center!important;flex-wrap:wrap!important}
body.mura-placement-active #placement.invalid{border-color:rgba(166,88,68,.42)!important}
body.mura-placement-active #placement.invalid #placementText{color:#9b5948!important}
#muraPlacementUndo{position:fixed;z-index:70;left:50%;bottom:max(20px,env(safe-area-inset-bottom));transform:translateX(-50%);min-height:48px;padding:10px 22px;border-radius:26px;font-size:12px;font-weight:700;letter-spacing:.04em;background:rgba(248,242,222,.96);white-space:nowrap}
body.mura-placement-undo-visible #build{opacity:0;pointer-events:none}
#muraSettingsButton{min-width:44px!important;width:44px!important;height:44px!important;min-height:44px!important;padding:10px!important}
#muraSettingsButton svg{width:18px!important;height:18px!important}
#housingMode{box-sizing:border-box}
#housingMode #leaveRoom{position:static!important;inset:auto!important;transform:none!important;flex:0 0 auto;width:auto!important;min-width:44px!important;min-height:44px!important;height:auto!important;margin:0 0 0 auto;padding:8px!important;font-size:11px!important;pointer-events:auto;white-space:nowrap}
@media(pointer:coarse){
 body.mura-placement-active #placement>.actions #cancelPlace{display:none!important}
 body.mura-placement-active #placement .rotationControl{display:none!important}
 body.mura-placement-active #placement{top:calc(50% - clamp(78px,12vh,112px))!important;width:min(300px,calc(100vw - 28px))!important;padding:9px 11px!important}
}
@media(max-height:520px){body.mura-placement-active #placement{top:50%!important;left:16px!important;transform:translateY(-115%)!important;width:min(280px,calc(100vw - 32px))!important}}
`;
document.head.append(css);

let busy=false,toastTimer=0,undoTimer=0,activePending=null,lastCommit=null;
const nativePan=view.pan.bind(view),nativeFocus=view.focus.bind(view);
const tracked=new Map();

function notice(text,ms=3500){
 $('toastText').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,ms);
}
function hideUndo(){
 clearTimeout(undoTimer);undo.hidden=true;document.body.classList.remove('mura-placement-undo-visible');lastCommit=null;
}
function showUndo(commit){
 clearTimeout(undoTimer);lastCommit=commit;undo.hidden=false;document.body.classList.add('mura-placement-undo-visible');undoTimer=setTimeout(hideUndo,6500);
}
function worldPoint(p,point){
 if(!p?.roomId)return point;
 const host=world.object(p.roomId);return host?localToWorld(host,point.x,point.z):null;
}
function setCameraCenter(x,z,span=null){
 view.cameraGoal=null;view.followId=null;view.target.x=x;view.target.z=z;
 if(Number.isFinite(span))view.span=span;
 view.lastInteraction=performance.now();view.updateCamera();
}
function centerCandidate(){
 if(!ui.pending)return false;
 const r=canvas.getBoundingClientRect(),point=view.ground(r.left+r.width/2,r.top+r.height/2);
 if(!point)return false;
 village.previewAt(point.x,point.z);return true;
}
function centerPending(p,site,span=null){
 const point=worldPoint(p,site);if(!point)return false;
 setCameraCenter(point.x,point.z,span);centerCandidate();return true;
}

view.pan=(dx,dy)=>{
 const result=nativePan(dx,dy);
 if(ui.pending)centerCandidate();
 return result;
};
view.focus=(x,z,span=null)=>{
 if(!ui.pending)return nativeFocus(x,z,span);
 setCameraCenter(x,z,span);centerCandidate();return true;
};

function syncHousingExit(){
 const housing=$('housingMode'),leave=$('leaveRoom');
 if(housing&&leave&&leave.parentElement!==housing)housing.append(leave);
}
function placementInstruction(p,error){
 const title=defs[p.kind]?.label||'配置物';
 return error?`${title} · ${error}`:`${title} · スワイプで場所を調整 · タップで配置`;
}
function refresh(){
 syncHousingExit();
 const p=ui.pending,active=!!p;
 document.body.classList.toggle('mura-placement-active',active);
 canvas.dataset.placement=active?'center-follow':'off';
 canvas.setAttribute('aria-label',active?'建築配置。1本指でなぞって場所を調整し、短くタップして配置します。回転は建物上のボタンを使います。':originalCanvasLabel);
 if(!p){activePending=null;done.disabled=false;return;}
 if(p!==activePending){
  activePending=p;hideUndo();
  const site=findPlacementSite(world,p);
  if(site){p.x=site.x;p.z=site.z;p.error=null;centerPending(p,site);}
 }
 const error=world.canPlace(p.kind,p.x,p.z,p.rot,p.roomId,p.moveId);
 p.error=error;done.disabled=busy||!!error;
 panel.classList.toggle('invalid',!!error);
 label.textContent=placementInstruction(p,error);
 const fallback=p.moveId?'ここへ移す':p.roomId?'ここに置く':'ここに建てる';
 if(done.textContent!==fallback){done.textContent=fallback;done.dataset.muraIcon='native';}
 done.setAttribute('aria-describedby','placementText');
}

function rotate(delta){
 const p=ui.pending;if(!p||busy)return;
 p.rot=(p.rot+delta+Math.PI*2)%(Math.PI*2);
 $('muraRotation').value=String(Math.round(p.rot*180/Math.PI));
 village.refreshPreview();refresh();
}
rotateLeft.onclick=()=>rotate(-Math.PI/2);

async function commitCurrentPlacement(){
 const p=ui.pending;if(!p||busy)return false;
 centerCandidate();
 const snapshot={kind:p.kind,x:p.x,z:p.z,rot:p.rot,moveId:p.moveId||null,roomId:p.roomId||null,material:p.material};
 const result=commitPlacement(world,p);
 if(result.error){notice(result.error);refresh();return false;}
 busy=true;
 const id=p.moveId||result.object?.id,room=p.roomId;
 village.cancelPlacement();
 if(id)village.selection(id,room);
 world.notify(result.message,'life');
 try{
  const saved=await village.save();
  notice(saved===false?`${result.message}。保存できません。設定から書き出してください`:result.message,3000);
 }catch(error){notice(`${result.message}。保存できません：${error.message}`,4000);}
 finally{busy=false;showUndo(snapshot);refresh();}
 return true;
}
done.onclick=()=>void commitCurrentPlacement();

function pointerDistance(p,x,y){return Math.hypot(x-p.sx,y-p.sy);}
function markMulti(){if(tracked.size>1)for(const p of tracked.values())p.multi=true;}
function onPointerDown(event){
 if(event.button!==undefined&&event.button!==0)return;
 tracked.set(event.pointerId,{sx:event.clientX,sy:event.clientY,x:event.clientX,y:event.clientY,multi:false});markMulti();
}
function onPointerMove(event){const p=tracked.get(event.pointerId);if(!p)return;p.x=event.clientX;p.y=event.clientY;markMulti();}
function finishPointer(event,cancelled=false){
 const p=tracked.get(event.pointerId);if(!p)return;
 tracked.delete(event.pointerId);p.x=event.clientX;p.y=event.clientY;
 if(cancelled||p.multi||!ui.pending||pointerDistance(p,p.x,p.y)>=7)return;
 queueMicrotask(()=>{if(!ui.pending||busy)return;centerCandidate();void commitCurrentPlacement();});
}
canvas.addEventListener('pointerdown',onPointerDown,{passive:true});
canvas.addEventListener('pointermove',onPointerMove,{passive:true});
canvas.addEventListener('pointerup',event=>finishPointer(event),{passive:true});
canvas.addEventListener('pointercancel',event=>finishPointer(event,true),{passive:true});
canvas.addEventListener('lostpointercapture',event=>finishPointer(event,true),{passive:true});

undo.onclick=()=>{
 const snapshot=lastCommit;if(!snapshot)return;
 hideUndo();
 const result=world.undo();
 if(result.error){notice(result.error);return;}
 village.deselect();void village.save();
 const reopened=village.beginPlacement(snapshot.kind,snapshot.moveId);
 if(reopened&&ui.pending){
  activePending=ui.pending;
  Object.assign(ui.pending,{x:snapshot.x,z:snapshot.z,rot:snapshot.rot,material:snapshot.material});
  $('muraRotation').value=String(Math.round(ui.pending.rot*180/Math.PI));
  village.refreshPreview();centerPending(ui.pending,{x:snapshot.x,z:snapshot.z});refresh();
  notice('取り消しました。位置を調整できます',2600);
 }else notice('取り消しました',2200);
};

function syncHelp(){
 const host=$('dialogContent');if(!host)return;
 const heading=[...host.querySelectorAll('h3')].find(node=>node.textContent.trim()==='建築と内装');
 const paragraph=heading?.nextElementSibling;
 if(paragraph&&paragraph.tagName==='P')paragraph.textContent='つくるで施設や家具を選ぶと、画面中央にゴーストが出ます。1本指でなぞって場所を動かし、短くタップするとその位置へ配置します。置けない場所では理由が表示され、配置されません。回転はゴースト上のボタンを使います。間違えた場合は直後の「取り消す」で戻せます。';
}
const helpObserver=new MutationObserver(syncHelp);helpObserver.observe($('dialogContent'),{childList:true,subtree:true});
const observer=new MutationObserver(refresh);observer.observe(panel,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class']});
refresh();
window.__MURA_CENTER_PLACEMENT__={version:1,centerCandidate,commit:commitCurrentPlacement};
window.addEventListener('pagehide',()=>{
 observer.disconnect();helpObserver.disconnect();clearTimeout(toastTimer);clearTimeout(undoTimer);tracked.clear();
 view.pan=nativePan;view.focus=nativeFocus;
},{once:true});
