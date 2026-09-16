import { createWebPlatform } from '@soul/platform-web';
import { createSharedWorldChannel } from '@soul/platform-web/shared-world';
import { defaultMuraLayout, validateMuraLayout, safeMuraPosition } from '@soul/world/mura';
import { createLife, deserializeLife, serializeLife, setClockRate, setMoving, tickLife, rebirth, LIFE_YEARS, canDepart, depart, advanceFront, returnHome, enterBuilding, leaveBuilding } from './domain.js';
import { buildStations, nearestStation, normalizeLayout } from './locations.js';
import { createWorldRenderer } from './renderer.js';
import { createBirthExperience } from './birth-experience.js';
import { createFront, normalizeFront, tickFront } from './combat.js';
import { guidanceFor } from './guidance.js';
import { RINNE_RUNTIME_PERFORMANCE } from './performance.js';

const $=id=>document.getElementById(id);
const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
const speedForAge=age=>age<4?1.2:age<7?2.15:age<65?4.15:Math.max(2.3,4.15-(age-65)*.035);
const chapterName=stage=>String(stage||'').replace(/^\d+\/6\s*/, '').trim();
const nextPaint=()=>new Promise(resolve=>document.hidden?setTimeout(resolve,0):requestAnimationFrame(()=>resolve()));

function placeState(state,layout){
  if(state.zone==='village'&&!state.interior)state.position=safeMuraPosition(layout,state.position);
  else if(state.zone==='frontier')state.position={x:clamp(state.position.x,-6.8,6.8),z:clamp(state.position.z,-5.9,5.7)};
  return state;
}

export async function prepareRuntime({buildInfo,onProgress,layoutOverride}={}){
  const progress=async message=>{onProgress?.(message);await nextPaint();};
  const environment=String(buildInfo?.environment||'local'),platform=createWebPlatform({gameId:'rinne',environment,playerId:'local'}),saveKey='life-v2';
  await progress('村の地図をひらいています');
  const channel=createSharedWorldChannel({environment,validate:validateMuraLayout});
  let layout=defaultMuraLayout();try{layout=normalizeLayout(channel.read()||layout);}catch(error){console.warn('shared world:',error);}
  if(layoutOverride)layout=normalizeLayout(validateMuraLayout(layoutOverride));
  const stations=buildStations(layout),canvas=$('game'),loading=$('loading-card'),gameScreen=$('game-screen');
  await progress('景色を描いています');
  const view=await createWorldRenderer({canvas,document,layout,stations});
  await progress('旅人を迎えています');
  const preview=placeState(createLife({name:'旅人',seed:0x51f15e,villageIds:[layout.id]}),layout);
  view.syncFront(null);view.renderState(preview,.016);canvas.dataset.runtime='prepared';
  const host={environment,platform,saveKey,channel,layout,stations,canvas,loading,gameScreen,view,active:false,disposed:false};
  host.dispose=()=>{if(host.disposed)return;host.disposed=true;host.active=false;canvas.dataset.runtime='disposed';view.dispose();};
  return host;
}

export async function startRuntime({mode,buildInfo,name,onExit,onProgress,prepared,coop=null}){
  const ownsPrepared=!prepared,host=prepared||await prepareRuntime({buildInfo,onProgress});
  if(host.disposed)throw Error('描画世界は終了済みです');
  if(host.active)throw Error('人生はすでに始まっています');
  host.active=true;
  const {platform,saveKey,channel,layout,stations,canvas,loading,gameScreen,view}=host;
  let state=null;
  try{
    if(coop)state=structuredClone(coop.snapshot().view.me);
    else if(mode==='continue'){
      const raw=await platform.storage.read(saveKey);if(raw)state=deserializeLife(raw);
    }
    if(!state)state=createLife({name,seed:(Date.now()>>>0),villageIds:[layout.id]});
    placeState(state,layout);
  }catch(error){host.active=false;if(ownsPrepared)host.dispose();throw error;}

  let active=true,raf=0,last=performance.now(),saveElapsed=0,uiElapsed=RINNE_RUNTIME_PERFORMANCE.uiSyncInterval,toastTimer=0,endDialog=null,pointer=null,keyboard={x:0,y:0},axis={x:0,y:0},portDwell=0,doorDwell=0,doorStationId='',movementHint=true,movementHintTimer=0,chapterTimer=0,hurtTimer=0,lastChapter='';
  let front=coop?coop.snapshot().view.front:state.zone==='frontier'?normalizeFront(state.frontState,state.front,state.seed):null;if(front)state.frontState=front;
  let coopTick=-1,coopEpoch=0,rebirthPending=false,inputElapsed=0;
  const birth=createBirthExperience({document,canvas,gameScreen,view,stations,getState:()=>state,dialogue});

  const toast=text=>{if(!text)return;$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,1800);};
  const save=async()=>{if(!active||!state)return false;try{if(coop)return await coop.save();state.frontState=front;await platform.storage.write(saveKey,serializeLife(state));return true;}catch(error){toast('保存失敗');console.error(error);return false;}};
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
  function syncMovementHint(){
    $('move-hint').textContent=birth.active()?'スワイプで母を動かせる':'スワイプで移動';
    $('move-hint').hidden=!movementHint||state.down||state.ended;
  }
  function armMovementHint(){
    movementHint=true;syncMovementHint();clearTimeout(movementHintTimer);
    movementHintTimer=setTimeout(()=>{movementHint=false;$('move-hint').hidden=true;},5000);
  }
  function syncUI(){
    $('generation').textContent=`${state.generation}代目`;$('age').textContent=`${Math.min(LIFE_YEARS,Math.floor(state.ageYears))}歳`;
    $('hp-bar').style.width=`${clamp(state.hp/state.maxHp*100,0,100)}%`;$('stamina-bar').style.width=`${clamp(state.stamina/100*100,0,100)}%`;
    const guide=guidanceFor({state,stations,front});$('life-stage').textContent=guide.stage;$('objective').textContent=guide.objective;$('objective-badge').textContent=guide.badge||'';
    gameScreen.dataset.worldTone=worldTone(guide);gameScreen.dataset.birthTour=String(birth.active());gameScreen.dataset.interior=state.interior?.buildingId||'';gameScreen.style.setProperty('--wound',String(clamp(1-state.hp/state.maxHp,0,.85)));showChapter(guide.stage);
    $('clock-rate').value=String(state.clockRate);syncMovementHint();
  }
  function dialogue(speaker,text){$('speaker').textContent=speaker;$('dialogue-text').textContent=text;$('dialogue').hidden=false;clearTimeout(dialogue.timer);dialogue.timer=setTimeout(()=>$('dialogue').hidden=true,4200);}
  function showBirthIntro(){birth.showIntro();}
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
      if(coop){rebirthPending=true;void Promise.resolve(coop.rebirth(select.value||null)).catch(error=>{rebirthPending=false;toast(error.message);});endDialog.remove();endDialog=null;return;}
      state=rebirth(state,{villageId:select.value||null,villageIds:[layout.id]});front=null;state.frontState=null;view.syncFront(null);state.position=safeMuraPosition(layout,state.position);lastChapter='';await save();endDialog.remove();endDialog=null;syncUI();armMovementHint();showBirthIntro();toast(`${state.generation}代目 · 0歳`);
    }else endDialog.showModal();});endDialog.showModal();
  }
  function handleEvents(events){for(const event of events){
    if(event.type==='release'){toast('4歳 · 自立');birth.release();armMovementHint();}
    if(event.type==='equipment')toast(`${event.station.label} 装備`);
    if(event.type==='activity-start')toast(event.station.actionLabel||event.station.label);
    if(event.type==='activity-complete')toast('経験が残った');
    if(event.type==='skills'&&event.ids.length)toast(`閃き · ${(event.names||event.ids).slice(0,2).join('・')}`);
    if(event.type==='birthday'&&[7,15,50,80].includes(event.age))toast(`${event.age}歳`);
    if(event.type==='life-end')endLife();
    if(event.type==='player-hit')gameScreen.classList.add('strike-mark');
    if(event.type==='enemy-hit')pulseHurt();
    if(event.type==='evaded')toast('見切った');
    if(event.type==='enemy-down')toast('撃破');
    if(event.type==='downed'){pulseHurt();toast('行動不能 · 救助待ち');}
    if(event.type==='rescued')toast('救助 · 村');
  }}
  function setAxis(next){axis=next;const len=Math.hypot(axis.x,axis.y);if(len>1){axis={x:axis.x/len,y:axis.y/len};}}
  function onPointerDown(event){if(pointer||!active)return;pointer={id:event.pointerId,x:event.clientX,y:event.clientY};canvas.setPointerCapture?.(event.pointerId);setAxis({x:0,y:0});event.preventDefault();}
  function onPointerMove(event){if(!pointer||pointer.id!==event.pointerId||!active)return;const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y,len=Math.hypot(dx,dy);if(len<12)setAxis({x:0,y:0});else setAxis({x:dx/Math.max(42,len),y:dy/Math.max(42,len)});event.preventDefault();}
  function onPointerUp(event){if(!pointer||pointer.id!==event.pointerId)return;pointer=null;setAxis(keyboard);event.preventDefault();}
  const keys=new Set();function syncKeys(){keyboard={x:(keys.has('ArrowRight')||keys.has('KeyD')?1:0)-(keys.has('ArrowLeft')||keys.has('KeyA')?1:0),y:(keys.has('ArrowDown')||keys.has('KeyS')?1:0)-(keys.has('ArrowUp')||keys.has('KeyW')?1:0)};if(!pointer)setAxis(keyboard);}
  function keydown(e){if(!active||document.querySelector('dialog[open]')||e.target?.closest?.('input,textarea,select'))return;if(['ArrowRight','ArrowLeft','ArrowUp','ArrowDown','KeyW','KeyA','KeyS','KeyD'].includes(e.code)){keys.add(e.code);syncKeys();e.preventDefault();}}
  function keyup(e){keys.delete(e.code);syncKeys();}
  canvas.addEventListener('pointerdown',onPointerDown,{passive:false});canvas.addEventListener('pointermove',onPointerMove,{passive:false});canvas.addEventListener('pointerup',onPointerUp,{passive:false});canvas.addEventListener('pointercancel',onPointerUp,{passive:false});
  window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);
  $('clock-rate').disabled=coop?.role==='guest';
  $('clock-rate').onchange=e=>{try{if(coop)void Promise.resolve(coop.setRate(Number(e.target.value))).catch(error=>toast(error.message));else{setClockRate(state,Number(e.target.value));void save();}}catch(error){toast(error.message);}};
  $('back-title').onclick=async()=>{await save();dispose();await onExit?.();};
  const unsubscribeWorld=channel.subscribe(next=>{if(!next||next.id!==layout.id)return;toast('村更新 · 次回起動');},error=>console.warn(error));

  function renderCoopFrame(dt){
    const snapshot=coop.snapshot(),shared=snapshot.view,open=snapshot.phase==='open';$('coop-darkness').hidden=open;
    inputElapsed+=dt;if(inputElapsed>=.05){inputElapsed=0;const direction=open&&!document.hidden&&!document.querySelector('dialog[open]')?view.cameraVector(axis):{x:0,z:0};coop.input({x:direction.x*Math.min(1,Math.hypot(axis.x,axis.y)),z:direction.z*Math.min(1,Math.hypot(axis.x,axis.y))});}
    if(shared&&(shared.tick!==coopTick||shared.epoch!==coopEpoch)){
      coopTick=shared.tick;coopEpoch=shared.epoch;Object.assign(canvas.dataset,{coopWorld:coop.worldId,coopPlayer:coop.selfId,coopTick:String(shared.tick),coopEpoch:String(shared.epoch),coopSeconds:String(shared.worldSeconds),coopPosition:JSON.stringify(shared.me.position),coopPeers:JSON.stringify(shared.peers.map(peer=>({id:peer.playerId,position:peer.position})))});const oldId=state.id;const previousStage=front?.stage;state=shared.me;front=shared.front;
      if(oldId!==state.id){rebirthPending=false;lastChapter='';showBirthIntro();}
      if(previousStage!==front?.stage)view.syncFront(front);else view.updateFront(front);view.syncPeers(shared.peers);handleEvents(shared.events||[]);
      $('coop-people').textContent=`接続 ${shared.connected||1}人 · ${shared.peers.map(peer=>peer.name).join(' / ')}`;
    }
    uiElapsed+=dt;if(uiElapsed>=RINNE_RUNTIME_PERFORMANCE.uiSyncInterval){uiElapsed=0;syncUI();}
    if(Math.hypot(axis.x,axis.y)>.08&&open&&movementHint){movementHint=false;$('move-hint').hidden=true;}if(state.ended&&!rebirthPending)endLife();view.renderState(state,open?dt:0);birth.afterRender(open?dt:0,{carrierMoving:open&&Math.hypot(axis.x,axis.y)>.08});
  }

  function frame(now){
    if(!active)return;raf=requestAnimationFrame(frame);const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
    if(coop){renderCoopFrame(dt);return;}
    let moved=false,carrierMoving=false;const mag=Math.hypot(axis.x,axis.y),birthStep=birth.step(dt,axis);
    if(birthStep.handled){moved=birthStep.moved;carrierMoving=birthStep.carrierMoving;}
    else if(mag>.08&&!state.ended&&!state.down){const direction=view.cameraVector(axis),speed=speedForAge(state.ageYears)*(state.combat?.72:1),nx=state.position.x+direction.x*speed*dt,nz=state.position.z+direction.z*speed*dt;
      const movementZone=state.interior?'interior':state.zone;if(view.canMoveTo(nx,nz,.32,movementZone,state.interior?.buildingId)){state.position.x=nx;state.position.z=nz;state.yaw=Math.atan2(direction.x,direction.z);moved=true;}}
    if(moved&&movementHint){movementHint=false;$('move-hint').hidden=true;}
    setMoving(state,birthStep.handled?false:moved,state.yaw);const station=state.zone==='village'?nearestStation(stations,state.position,{interiorId:state.interior?.buildingId||null}):null,events=tickLife(state,{realDelta:dt,station,paused:document.hidden});handleEvents(events);
    if(state.zone==='village'&&!moved&&(station?.enterInterior||station?.exitInterior)){
      if(doorStationId!==station.id){doorStationId=station.id;doorDwell=0;}doorDwell+=dt;
      if(doorDwell>=.55){const entering=station.enterInterior,changed=entering?enterBuilding(state,station):leaveBuilding(state);if(changed){toast(entering?`${station.label}へ入る`:'外へ出る');doorDwell=0;doorStationId='';void save();}}
    }else{doorDwell=0;doorStationId='';}
    if(state.zone==='village'&&!state.interior&&station?.port&&canDepart(state)&&!moved){portDwell+=dt;if(portDwell>=1.5&&depart(state)){front=createFront(0,state.seed);state.frontState=front;view.syncFront(front);toast('出航 · 前線');portDwell=0;}}else portDwell=0;
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
    view.renderState(state,dt);birth.afterRender(dt,{carrierMoving});uiElapsed+=dt;if(uiElapsed>=RINNE_RUNTIME_PERFORMANCE.uiSyncInterval){uiElapsed=0;syncUI();}
    saveElapsed+=dt;if(saveElapsed>=2.5){saveElapsed=0;void save();}
  }

  function pagehide(){void save();}
  function visibility(){coop?.pause(document.hidden);if(document.hidden){keys.clear();pointer=null;setAxis({x:0,y:0});}}
  document.addEventListener('visibilitychange',visibility);
  window.addEventListener('pagehide',pagehide);
  if(front)view.syncFront(front);else view.syncFront(null);view.renderState(state,.016);birth.afterRender(.016,{carrierMoving:false});syncUI();uiElapsed=0;loading.hidden=true;canvas.dataset.runtime='active';
  armMovementHint();showBirthIntro();raf=requestAnimationFrame(frame);void save();

  function dispose(){
    if(!active)return;active=false;host.active=false;cancelAnimationFrame(raf);clearTimeout(toastTimer);clearTimeout(movementHintTimer);clearTimeout(chapterTimer);clearTimeout(hurtTimer);clearTimeout(dialogue.timer);birth.dispose();unsubscribeWorld();
    window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('pagehide',pagehide);canvas.removeEventListener('pointerdown',onPointerDown);canvas.removeEventListener('pointermove',onPointerMove);canvas.removeEventListener('pointerup',onPointerUp);canvas.removeEventListener('pointercancel',onPointerUp);
    document.removeEventListener('visibilitychange',visibility);for(const key of Object.keys(canvas.dataset))if(key.startsWith('coop'))delete canvas.dataset[key];view.syncPeers([]);$('coop-darkness').hidden=true;$('coop-people').textContent='';$('clock-rate').disabled=false;
    keys.clear();pointer=null;setAxis({x:0,y:0});endDialog?.remove();endDialog=null;$('dialogue').hidden=true;$('toast').hidden=true;canvas.dataset.runtime='prepared';
    if(ownsPrepared)host.dispose();
  }
  return{dispose,save:()=>save(),snapshot:()=>structuredClone(state),prepared:host};
}
