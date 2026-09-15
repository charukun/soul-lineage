import { createWebPlatform } from '@soul/platform-web';
import { createSharedWorldChannel } from '@soul/platform-web/shared-world';
import { defaultMuraLayout, validateMuraLayout, safeMuraPosition } from '@soul/world/mura';
import { createLife, deserializeLife, serializeLife, setClockRate, setMoving, tickLife, rebirth, LIFE_YEARS, canDepart, depart, advanceFront, returnHome } from './domain.js';
import { buildStations, nearestStation, normalizeLayout } from './locations.js';
import { createWorldRenderer } from './renderer.js';
import { createFront, normalizeFront, tickFront } from './combat.js';
import { guidanceFor } from './guidance.js';
import { RINNE_RUNTIME_PERFORMANCE } from './performance.js';

const $=id=>document.getElementById(id);
const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
const speedForAge=age=>age<4?1.2:age<7?2.15:age<65?4.15:Math.max(2.3,4.15-(age-65)*.035);
const chapterName=stage=>String(stage||'').replace(/^\d+\/6\s*/, '').trim();

export async function startRuntime({mode,buildInfo,name,onExit}){
  const environment=String(buildInfo.environment||'local'), platform=createWebPlatform({gameId:'rinne',environment,playerId:'local'}), saveKey='life-v2';
  const channel=createSharedWorldChannel({environment,validate:validateMuraLayout});
  let layout=defaultMuraLayout();try{layout=normalizeLayout(channel.read()||layout);}catch(error){console.warn('shared world:',error);}
  let state=null;
  if(mode==='continue'){
    const raw=await platform.storage.read(saveKey);if(raw)state=deserializeLife(raw);
  }
  if(!state)state=createLife({name,seed:(Date.now()>>>0),villageIds:[layout.id]});

  if(state.zone==='village')state.position=safeMuraPosition(layout,state.position);
  else state.position={x:clamp(state.position.x,-6.8,6.8),z:clamp(state.position.z,-5.9,5.7)};
  const stations=buildStations(layout),canvas=$('game'),loading=$('loading-card'),gameScreen=$('game-screen');
  $('loading-message').textContent='村を描画中';
  const view=createWorldRenderer({canvas,document,layout,stations});
  let alive=true,raf=0,last=performance.now(),saveElapsed=0,uiElapsed=RINNE_RUNTIME_PERFORMANCE.uiSyncInterval,toastTimer=0,endDialog=null,pointer=null,keyboard={x:0,y:0},axis={x:0,y:0},portDwell=0,movementHint=true,movementHintTimer=0,chapterTimer=0,hurtTimer=0,lastChapter='';
  let front=state.zone==='frontier'?normalizeFront(state.frontState,state.front,state.seed):null;if(front)state.frontState=front;

  const toast=text=>{if(!text)return;$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,1800);};
  const save=async()=>{if(!alive)return false;try{state.frontState=front;await platform.storage.write(saveKey,serializeLife(state));return true;}catch(error){toast('保存失敗');console.error(error);return false;}};
  function talkContext(){return state.zone==='village'&&!state.down&&!state.ended&&state.phase==='birth'?{speaker:'母',text:'焦らなくていいよ。あなたの歩幅で大きくなりなさい。'}:null;}
  function worldTone(guide){if(state.ended||guide.tone==='rebirth')return'rebirth';if(state.zone==='frontier')return'frontier';if(guide.tone==='home')return'home';return'village';}
  function showChapter(stage){
    if(!stage||stage===lastChapter)return;lastChapter=stage;
    const mark=$('chapter-mark');$('chapter-title').textContent=chapterName(stage);mark.hidden=false;
    clearTimeout(chapterTimer);chapterTimer=setTimeout(()=>{mark.hidden=true;},2200);
  }
  function pulseHurt(){
    gameScreen.classList.remove('hurt-pulse');void gameScreen.offsetWidth;gameScreen.classList.add('hurt-pulse');
    clearTimeout(hurtTimer);hurtTimer=setTimeout(()=>gameScreen.classList.remove('hurt-pulse'),460);
  }
  function syncUI(){
    $('generation').textContent=`${state.generation}代目`;$('age').textContent=`${Math.min(LIFE_YEARS,Math.floor(state.ageYears))}歳`;
    $('hp-bar').style.width=`${clamp(state.hp/state.maxHp*100,0,100)}%`;$('stamina-bar').style.width=`${clamp(state.stamina/100*100,0,100)}%`;
    const guide=guidanceFor({state,stations,front});$('life-stage').textContent=guide.stage;$('objective').textContent=guide.objective;$('objective-badge').textContent=guide.badge||'';
    gameScreen.dataset.worldTone=worldTone(guide);gameScreen.style.setProperty('--wound',String(clamp(1-state.hp/state.maxHp,0,.85)));showChapter(guide.stage);
    const waypoint=$('waypoint');waypoint.dataset.tone=guide.tone||'';
    if(guide.target){
      const direction=view.screenDirection(state.position,guide.target),angle=Math.atan2(direction.x,-direction.y)*180/Math.PI;
      waypoint.hidden=false;$('waypoint-label').textContent=guide.target.label;$('waypoint-distance').textContent=direction.distance<1.2?'ここ':`${Math.ceil(direction.distance)}m`;$('waypoint-arrow').style.transform=`rotate(${angle.toFixed(1)}deg)`;
    }else waypoint.hidden=true;
    $('clock-rate').value=String(state.clockRate);$('talk').hidden=!talkContext();$('move-hint').hidden=!movementHint||state.down||state.ended;
  }
  function dialogue(speaker,text){$('speaker').textContent=speaker;$('dialogue-text').textContent=text;$('dialogue').hidden=false;clearTimeout(dialogue.timer);dialogue.timer=setTimeout(()=>$('dialogue').hidden=true,4200);}
  function talk(){const context=talkContext();if(context)dialogue(context.speaker,context.text);}
  function endLife(){
    if(endDialog?.open)return;
    endDialog=document.createElement('dialog');endDialog.className='life-end-dialog';
    endDialog.innerHTML='<form method="dialog"><p>100年</p><h2 id="life-end-name"></h2><p class="life-end-summary"><span id="life-end-defeats"></span>撃破 · 凱旋<span id="life-end-returns"></span>回 · 技<span id="life-end-skills"></span></p><label>次の出生<select id="rebirth-village"></select></label><p class="life-end-help">次の人生は0歳・基礎装備から。残るのは一族の記録と、帰還して刻んだ故郷だけ。</p><button value="rebirth" id="rebirth">次の人生へ</button></form>';
    endDialog.querySelector('#life-end-name').textContent=`${state.name} · ${state.generation}代`;
    endDialog.querySelector('#life-end-defeats').textContent=String(state.defeats);endDialog.querySelector('#life-end-returns').textContent=String(state.returns);endDialog.querySelector('#life-end-skills').textContent=String(state.knownSkills.length);
    const select=endDialog.querySelector('#rebirth-village'),random=document.createElement('option');random.value='';random.textContent='ランダムな村';select.append(random);
    if(state.homelands.includes(layout.id)){const o=document.createElement('option');o.value=layout.id;o.textContent=`故郷 · ${layout.name}`;select.append(o);}
    document.body.append(endDialog);
    endDialog.addEventListener('close',async()=>{if(endDialog.returnValue==='rebirth'){
      state=rebirth(state,{villageId:select.value||null,villageIds:[layout.id]});front=null;state.frontState=null;view.syncFront(null);state.position=safeMuraPosition(layout,state.position);lastChapter='';await save();endDialog.remove();endDialog=null;toast(`${state.generation}代目 · 0歳`);
    }else endDialog.showModal();});endDialog.showModal();
  }
  function handleEvents(events){for(const event of events){
    if(event.type==='release')toast('4歳 · 自立');
    if(event.type==='equipment')toast(`${event.station.label} 装備`);
    if(event.type==='activity-start')toast(event.station.actionLabel||event.station.label);
    if(event.type==='activity-complete')toast('経験 +1');
    if(event.type==='skills'&&event.ids.length)toast('技 閃き');
    if(event.type==='birthday'&&[7,15,50,80].includes(event.age))toast(`${event.age}歳`);
    if(event.type==='life-end')endLife();
    if(event.type==='player-hit')gameScreen.classList.add('strike-mark');
    if(event.type==='enemy-hit')pulseHurt();
    if(event.type==='enemy-down')toast('撃破');
    if(event.type==='downed'){pulseHurt();toast('行動不能 · 救助待ち');}
    if(event.type==='rescued')toast('救助 · 村');
  }}
  function setAxis(next){axis=next;const len=Math.hypot(axis.x,axis.y);if(len>1){axis={x:axis.x/len,y:axis.y/len};}}
  function onPointerDown(event){if(pointer)return;pointer={id:event.pointerId,x:event.clientX,y:event.clientY};canvas.setPointerCapture?.(event.pointerId);setAxis({x:0,y:0});event.preventDefault();}
  function onPointerMove(event){if(!pointer||pointer.id!==event.pointerId)return;const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y,len=Math.hypot(dx,dy);if(len<12)setAxis({x:0,y:0});else setAxis({x:dx/Math.max(42,len),y:dy/Math.max(42,len)});event.preventDefault();}
  function onPointerUp(event){if(!pointer||pointer.id!==event.pointerId)return;pointer=null;setAxis(keyboard);event.preventDefault();}
  const keys=new Set();function syncKeys(){keyboard={x:(keys.has('ArrowRight')||keys.has('KeyD')?1:0)-(keys.has('ArrowLeft')||keys.has('KeyA')?1:0),y:(keys.has('ArrowDown')||keys.has('KeyS')?1:0)-(keys.has('ArrowUp')||keys.has('KeyW')?1:0)};if(!pointer)setAxis(keyboard);}
  function keydown(e){if(['ArrowRight','ArrowLeft','ArrowUp','ArrowDown','KeyW','KeyA','KeyS','KeyD'].includes(e.code)){keys.add(e.code);syncKeys();e.preventDefault();}}
  function keyup(e){keys.delete(e.code);syncKeys();}
  canvas.addEventListener('pointerdown',onPointerDown,{passive:false});canvas.addEventListener('pointermove',onPointerMove,{passive:false});canvas.addEventListener('pointerup',onPointerUp,{passive:false});canvas.addEventListener('pointercancel',onPointerUp,{passive:false});
  window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);
  $('talk').onclick=talk;
  $('clock-rate').onchange=e=>{try{setClockRate(state,Number(e.target.value));void save();}catch(error){toast(error.message);}};
  $('back-title').onclick=async()=>{await save();dispose();onExit?.();};
  const unsubscribeWorld=channel.subscribe(next=>{if(!next||next.id!==layout.id)return;toast('村更新 · 次回起動');},error=>console.warn(error));

  function frame(now){
    if(!alive)return;raf=requestAnimationFrame(frame);const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
    let moved=false;const mag=Math.hypot(axis.x,axis.y);
    if(mag>.08&&!state.ended&&!state.down){const direction=view.cameraVector(axis),speed=speedForAge(state.ageYears)*(state.combat?.72:1),nx=state.position.x+direction.x*speed*dt,nz=state.position.z+direction.z*speed*dt;
      if(view.canMoveTo(nx,nz,state.phase==='birth'?.42:.32,state.zone)){state.position.x=nx;state.position.z=nz;state.yaw=Math.atan2(direction.x,direction.z);moved=true;}}
    if(moved&&movementHint){movementHint=false;$('move-hint').hidden=true;}
    setMoving(state,moved,state.yaw);const station=state.zone==='village'?nearestStation(stations,state.position):null,events=tickLife(state,{realDelta:dt,station,paused:document.hidden});handleEvents(events);
    if(state.zone==='village'&&station?.port&&canDepart(state)&&!moved){portDwell+=dt;if(portDwell>=1.5&&depart(state)){front=createFront(0,state.seed);state.frontState=front;view.syncFront(front);toast('出航 · 前線');portDwell=0;}}else portDwell=0;
    if(state.zone==='frontier'){
      if(!front){front=normalizeFront(state.frontState,state.front,state.seed);state.frontState=front;view.syncFront(front);}
      const battle=tickFront(state,front,dt);handleEvents(battle);view.updateFront(front);
      if(front.cleared&&state.position.z<=-5.85&&state.front<5&&advanceFront(state)){front=createFront(state.front,state.seed);state.frontState=front;view.syncFront(front);toast(`第${state.front+1}前線`);}
      else if(front.cleared&&state.front>=5&&state.position.z>=4.8){
        const wasHomeland=state.homelands.includes(state.birthVillageId);
        if(returnHome(state)){state.position=safeMuraPosition(layout,{x:166,z:0});front=null;state.frontState=null;view.syncFront(null);toast(wasHomeland?'凱旋':'凱旋 · 故郷解放');}
      }
      if(state.zone==='village'&&battle.some(e=>e.type==='rescued')){state.position=safeMuraPosition(layout,{x:0,z:0});front=null;state.frontState=null;view.syncFront(null);}
    }
    view.renderState(state,dt);uiElapsed+=dt;if(uiElapsed>=RINNE_RUNTIME_PERFORMANCE.uiSyncInterval){uiElapsed=0;syncUI();}
    saveElapsed+=dt;if(saveElapsed>=2.5){saveElapsed=0;void save();}
  }
  if(front)view.syncFront(front);view.renderState(state,.016);syncUI();uiElapsed=0;loading.hidden=true;movementHintTimer=setTimeout(()=>{movementHint=false;$('move-hint').hidden=true;},5000);raf=requestAnimationFrame(frame);void save();
  function pagehide(){void save();}
  window.addEventListener('pagehide',pagehide);
  function dispose(){if(!alive)return;alive=false;cancelAnimationFrame(raf);clearTimeout(toastTimer);clearTimeout(movementHintTimer);clearTimeout(chapterTimer);clearTimeout(hurtTimer);unsubscribeWorld();window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('pagehide',pagehide);canvas.removeEventListener('pointerdown',onPointerDown);canvas.removeEventListener('pointermove',onPointerMove);canvas.removeEventListener('pointerup',onPointerUp);canvas.removeEventListener('pointercancel',onPointerUp);view.dispose();endDialog?.remove();endDialog=null;}
  return{dispose,save:()=>save(),snapshot:()=>structuredClone(state)};
}
