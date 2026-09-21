import { createWebPlatform } from '@soul/platform-web';
import { createSharedWorldChannel } from '@soul/platform-web/shared-world';
import { defaultMuraLayout, validateMuraLayout, safeMuraPosition } from '@soul/world/mura';
import { createLife, deserializeLife, serializeLife, setClockRate, setMoving, tickLife, rebirth, LIFE_YEARS, canDepart, depart, advanceFront, returnHome, enterBuilding, leaveBuilding } from './domain.js';
import {combatBodyOutcome} from './combat-choreography.js';
import { buildStations, nearestStation, normalizeLayout } from './locations.js';
import { createWorldRenderer } from './combat-effects-renderer.js';
import { createBirthExperience } from './birth-experience.js';
import { createFront, normalizeFront, tickFront } from './combat.js';
import { createVillageSkirmish, tickVillageSkirmish, villageSkirmishAnchor } from './village-skirmish.js';
import { guidanceFor } from './guidance.js';
import { RINNE_RUNTIME_PERFORMANCE } from './performance.js';
import { splitRuntimeFrameDelta } from './runtime-clock.js';
import { SwipeInput } from '@soul/input';
import { startRinneFirstRunGuide } from '../first-run-guide.js';

const $=id=>document.getElementById(id);
const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
const speedForAge=age=>age<4?1.2:age<7?2.15:age<65?4.15:Math.max(2.3,4.15-(age-65)*.035);
const interiorSpeedForAge=age=>Math.max(.95,speedForAge(age)*.58);
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
  const stations=buildStations(layout),skirmishAnchor=villageSkirmishAnchor(stations);stations.push({id:'village-skirmish',label:'村外の戦場',x:skirmishAnchor.x,z:skirmishAnchor.z,radius:2.5,danger:true});
  const canvas=$('game'),loading=$('loading-card'),gameScreen=$('game-screen');
  await progress('景色を描いています');
  const view=await createWorldRenderer({canvas,document,layout,stations});
  await progress('旅人を迎えています');
  const preview=placeState(createLife({name:'旅人',seed:0x51f15e,villageIds:[layout.id]}),layout);
  view.syncFront(null);view.syncSkirmish(null);view.renderState(preview,.016,{titlePreview:true,titleTime:0,titleIdleTime:0});canvas.dataset.runtime='prepared';
  const host={environment,platform,saveKey,channel,layout,stations,skirmishAnchor,canvas,loading,gameScreen,view,active:false,disposed:false};
  let titlePreviewRaf=0,titlePreviewStart=0,titlePreviewLast=0,titlePreviewCinematic=true;
  const stopTitlePreview=()=>{if(titlePreviewRaf)cancelAnimationFrame(titlePreviewRaf);titlePreviewRaf=0;titlePreviewStart=0;titlePreviewLast=0;};
  const titlePreviewFrame=now=>{
    if(host.disposed||host.active){titlePreviewRaf=0;return;}
    if(!titlePreviewStart){titlePreviewStart=now;titlePreviewLast=now;}
    const dt=Math.min(.05,Math.max(0,(now-titlePreviewLast)/1000));titlePreviewLast=now;const elapsed=Math.max(0,(now-titlePreviewStart)/1000),titleTime=titlePreviewCinematic?Math.min(16,elapsed):16,titleIdleTime=titlePreviewCinematic?Math.max(0,elapsed-16):elapsed;
    if(titlePreviewCinematic){
      const p=Math.min(1,titleTime/16),baseX=0,baseZ=0;
      if(p<.18){preview.ageYears=7;preview.position.x=baseX-2+p/.18*3;preview.position.z=baseZ+3-p/.18*4;preview.yaw=.5;}
      else if(p<.38){const q=(p-.18)/.20;preview.ageYears=18+q*16;preview.position.x=baseX+1+q*6;preview.position.z=baseZ-1+q*3;preview.yaw=1.2;}
      else if(p<.58){const q=(p-.38)/.20;preview.ageYears=34+q*12;preview.position.x=baseX+7-q*4;preview.position.z=baseZ+2+q*4;preview.yaw=-1.1;}
      else if(p<.76){const q=(p-.58)/.18;preview.ageYears=46+q*43;preview.position.x=baseX+3-q*5;preview.position.z=baseZ+6-q*2;preview.yaw=-.5;}
      else if(p<.90){const q=(p-.76)/.14;preview.ageYears=89+q*11;preview.position.x=baseX-2+q*2;preview.position.z=baseZ+4-q*4;preview.yaw=.2;}
      else{const q=(p-.90)/.10;preview.generation=2;preview.ageYears=q*7;preview.position.x=baseX;preview.position.z=baseZ;preview.yaw=0;}
    }
    view.renderState(preview,dt,{titlePreview:true,titleTime,titleIdleTime});titlePreviewRaf=requestAnimationFrame(titlePreviewFrame);
  };
  host.startTitlePreview=({cinematic=true,lowResolution=false}={})=>{if(host.disposed||host.active)return;stopTitlePreview();titlePreviewCinematic=Boolean(cinematic);host.view.setTitlePreviewQuality?.(Boolean(lowResolution));titlePreviewRaf=requestAnimationFrame(titlePreviewFrame);};
  host.stopTitlePreview=()=>{stopTitlePreview();host.view.setTitlePreviewQuality?.(false);};
  host.dispose=()=>{if(host.disposed)return;host.disposed=true;host.active=false;stopTitlePreview();canvas.dataset.runtime='disposed';view.dispose();};
  return host;
}
export async function startRuntime({mode,buildInfo,name,onExit,onProgress,prepared,coop=null,family=null,expectedSave=undefined}={}){
  const ownsPrepared=!prepared,host=prepared||await prepareRuntime({buildInfo,onProgress});
  if(host.disposed)throw Error('描画世界は終了済みです');
  if(host.active)throw Error('人生はすでに始まっています');
  host.active=true;host.stopTitlePreview?.();
  const {platform,saveKey,channel,layout,stations,skirmishAnchor,canvas,loading,gameScreen,view}=host;
  let state=null;
  try{
    if(coop)state=structuredClone(coop.snapshot().view.me);
    else if(mode==='continue'){
      const raw=await platform.storage.read(saveKey);
      if(!raw)throw Error('続きから遊べる保存データがありません');
      state=deserializeLife(raw);
    }else if(mode==='new'&&expectedSave!==undefined){
      const current=await platform.storage.read(saveKey);
      if((current||null)!==expectedSave)throw Error('保存が更新されました。タイトルに戻って、もう一度お選びください。');
    }
    if(!state)state=createLife({name,seed:(Date.now()>>>0),villageIds:[layout.id],family});
    placeState(state,layout);
    // Confirmed identity is durable before the first frame. Storage failure does not silently start a disposable life.
    if(!coop&&mode==='new')await platform.storage.write(saveKey,serializeLife(state));
  }catch(error){host.active=false;if(ownsPrepared)host.dispose();throw error;}

  let active=true,raf=0,last=performance.now(),saveElapsed=0,uiElapsed=RINNE_RUNTIME_PERFORMANCE.uiSyncInterval,toastTimer=0,endDialog=null,keyboard={x:0,y:0},axis={x:0,y:0},portDwell=0,doorDwell=0,doorStationId='',movementHint=true,movementHintTimer=0,chapterTimer=0,hurtTimer=0,lastChapter='',firstRunGuide=null;
  const swipe=new SwipeInput();
  let front=coop?coop.snapshot().view.front:state.zone==='frontier'?normalizeFront(state.frontState,state.front,state.seed):null;if(front)state.frontState=front;
  let skirmish=coop?null:createVillageSkirmish(skirmishAnchor,state.seed);view.syncSkirmish(skirmish);
  let coopTick=-1,coopEpoch=0,coopHistoryRevision=-1,rebirthPending=false,inputElapsed=0;
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
    $('move-hint').textContent=birth.active()?'スワイプで母を動かせる':'スワイプで移動 · フリックでダッシュ';
    $('move-hint').hidden=!movementHint||state.down||state.ended;
  }
  function armMovementHint(){
    movementHint=true;syncMovementHint();clearTimeout(movementHintTimer);
    movementHintTimer=setTimeout(()=>{movementHint=false;$('move-hint').hidden=true;},5000);
  }
  function syncUI(){
    $('generation').textContent=`${state.generation}代目`;$('age').textContent=`${Math.min(LIFE_YEARS,Math.floor(state.ageYears))}歳`;
    $('stamina-bar').style.width=`${clamp(state.stamina/100*100,0,100)}%`;
    const guide=guidanceFor({state,stations,front}),body=combatBodyOutcome(state);$('life-stage').textContent=guide.stage;$('objective').textContent=guide.objective;$('objective-badge').textContent=guide.badge||'';
    gameScreen.dataset.worldTone=worldTone(guide);gameScreen.dataset.frontierCombat=String(Boolean(state.zone==='frontier'&&state.combat));gameScreen.dataset.birthTour=String(birth.active());gameScreen.dataset.interior=state.interior?.buildingId||'';gameScreen.style.setProperty('--wound',String(clamp(body.severity,0,.85)));showChapter(guide.stage);
    $('clock-rate').value=String(state.clockRate);syncMovementHint();
  }
  function dialogue(speaker,text){$('speaker').textContent=speaker;$('dialogue-text').textContent=text;$('dialogue').hidden=false;clearTimeout(dialogue.timer);dialogue.timer=setTimeout(()=>$('dialogue').hidden=true,4200);}
  function showBirthIntro(){birth.showIntro();}
  function endLife(){
    view.clearCombatEffects?.();
    if(endDialog?.open)return;
    endDialog=document.createElement('dialog');endDialog.className='life-end-dialog';
    endDialog.innerHTML='<form method="dialog"><p id="life-end-age"></p><h2 id="life-end-name"></h2><p class="life-end-summary"><span id="life-end-defeats"></span>撃破 · 凱旋<span id="life-end-returns"></span>回 · 技<span id="life-end-skills"></span></p><label>次の出生<select id="rebirth-village"></select></label><p class="life-end-help">次の人生は0歳・基礎装備から。一族の家伝と記録、帰還して刻んだ故郷を受け継ぎます。</p><button value="rebirth" id="rebirth">次の人生へ</button></form>';
    endDialog.querySelector('#life-end-age').textContent=state.ageYears>=LIFE_YEARS?'100年の生涯':`${Math.floor(state.ageYears)}歳の生涯`;
    endDialog.querySelector('#life-end-name').textContent=`${state.name} · ${state.generation}代`;
    endDialog.querySelector('#life-end-defeats').textContent=String(state.defeats);endDialog.querySelector('#life-end-returns').textContent=String(state.returns);endDialog.querySelector('#life-end-skills').textContent=String(state.knownSkills.length);
    const select=endDialog.querySelector('#rebirth-village'),random=document.createElement('option');random.value='';random.textContent='ランダムな村';select.append(random);
    if(state.homelands.includes(layout.id)){const o=document.createElement('option');o.value=layout.id;o.textContent=`故郷 · ${layout.name}`;select.append(o);}
    document.body.append(endDialog);
    endDialog.addEventListener('close',async()=>{if(endDialog.returnValue==='rebirth'){
      if(coop){rebirthPending=true;void Promise.resolve(coop.rebirth(select.value||null)).catch(error=>{rebirthPending=false;toast(error.message);});endDialog.remove();endDialog=null;return;}
      state=rebirth(state,{villageId:select.value||null,villageIds:[layout.id]});front=null;state.frontState=null;view.syncFront(null);skirmish=createVillageSkirmish(skirmishAnchor,state.seed);view.syncSkirmish(skirmish);state.position=safeMuraPosition(layout,state.position);lastChapter='';await save();endDialog.remove();endDialog=null;syncUI();armMovementHint();showBirthIntro();toast(`${state.generation}代目 · 0歳`);
    }else endDialog.showModal();});endDialog.showModal();
  }
  function handleEvents(events,eventKey){view.presentCombatEvents?.(events,{state,front,eventKey});for(const event of events){
    if(event.type==='release'){toast('4歳 · 自立');birth.release();armMovementHint();}
    if(event.type==='equipment')toast(`${event.station.label} 装備`);
    if(event.type==='activity-start')toast(event.station.actionLabel||event.station.label);
    if(event.type==='activity-complete')toast('経験が残った');
    if(event.type==='skills'&&event.ids.length)toast(`閃き · ${(event.names||event.ids).slice(0,2).join('・')}`);
    if(event.type==='village-news'&&event.text)toast(`村報 · ${event.text}`);
    if(event.villageAnnouncement)toast(`村報 · ${event.villageAnnouncement}`);
    if(event.type==='birthday'&&[7,15,50,80].includes(event.age))toast(`${event.age}歳`);
    if(event.type==='life-end')endLife();
    if(event.type==='player-hit')gameScreen.classList.add('strike-mark');
    if(event.type==='enemy-hit'){pulseHurt();gameScreen.dispatchEvent?.(new CustomEvent('rinne:combat-feedback',{detail:{type:'enemy-hit'}}));}
    if(event.type==='evaded')toast('見切った');
    if(event.type==='enemy-downed')toast('戦闘不能 · 近づいてとどめ');
    if(event.type==='finisher-start')toast('とどめ');
    if(event.type==='enemy-down')toast('撃破');
    if(event.type==='downed'){pulseHurt();toast('行動不能 · 救助待ち');}
    if(event.type==='rescued')toast('衛兵に救助された');
  }}
  function setAxis(next){axis=next;const len=Math.hypot(axis.x,axis.y);if(len>1){axis={x:axis.x/len,y:axis.y/len};}}
  function movementAxis(){
    if((swipe.id!==null||swipe.dash)&&state.stamina>2&&!document.querySelector('dialog[open]')){
      const input=swipe.vector(0);return{x:input.screenX*input.amount,y:input.screenY*input.amount};
    }
    return axis;
  }
  function onPointerDown(event){if(!active||(event.pointerType==='mouse'&&event.button!==0))return;swipe.cancel();if(!swipe.down(event.pointerId,event.clientX,event.clientY,performance.now()))return;canvas.setPointerCapture?.(event.pointerId);event.preventDefault();}
  function onPointerMove(event){if(!active||!swipe.move(event.pointerId,event.clientX,event.clientY,performance.now()))return;event.preventDefault();}
  function onPointerUp(event){
    if(swipe.id!==event.pointerId)return;
    event.preventDefault();const flick=event.type==='pointerup'&&!birth.active()&&state.stamina>2?swipe.up(event.pointerId,event.clientX,event.clientY,performance.now()):(swipe.cancel(),false);
    if(canvas.hasPointerCapture?.(event.pointerId))canvas.releasePointerCapture(event.pointerId);
    if(flick)canvas.dispatchEvent(new CustomEvent('rinne:flick-dash',{detail:{sharedInput:true}}));
    setAxis(keyboard);
  }
  const keys=new Set();function syncKeys(){keyboard={x:(keys.has('ArrowRight')||keys.has('KeyD')?1:0)-(keys.has('ArrowLeft')||keys.has('KeyA')?1:0),y:(keys.has('ArrowDown')||keys.has('KeyS')?1:0)-(keys.has('ArrowUp')||keys.has('KeyW')?1:0)};if(swipe.id===null)setAxis(keyboard);}
  function keydown(e){if(!active||document.querySelector('dialog[open]')||e.target?.closest?.('input,textarea,select'))return;if(['ArrowRight','ArrowLeft','ArrowUp','ArrowDown','KeyW','KeyA','KeyS','KeyD'].includes(e.code)){swipe.cancel();keys.add(e.code);syncKeys();e.preventDefault();}}
  function keyup(e){keys.delete(e.code);syncKeys();}
  canvas.addEventListener('pointerdown',onPointerDown,{passive:false});canvas.addEventListener('pointermove',onPointerMove,{passive:false});canvas.addEventListener('pointerup',onPointerUp,{passive:false});canvas.addEventListener('pointercancel',onPointerUp,{passive:false});
  window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);
  $('clock-rate').disabled=coop?.role==='guest';
  $('clock-rate').onchange=e=>{try{if(coop)void Promise.resolve(coop.setRate(Number(e.target.value))).catch(error=>toast(error.message));else{setClockRate(state,Number(e.target.value));void save();}}catch(error){toast(error.message);}};
  $('back-title').onclick=async()=>{await save();dispose();await onExit?.();};
  const unsubscribeWorld=channel.subscribe(next=>{if(!next||next.id!==layout.id)return;toast('村更新 · 次回起動');},error=>console.warn(error));

  function renderCoopFrame(dt,frameMs,now){
    const snapshot=coop.snapshot(),shared=snapshot.view,open=snapshot.phase==='open',moveAxis=movementAxis(now);$('coop-darkness').hidden=open;
    inputElapsed+=dt;if(inputElapsed>=.05){inputElapsed=0;const direction=open&&!document.hidden&&!document.querySelector('dialog[open]')?view.cameraVector(moveAxis):{x:0,z:0};coop.input({x:direction.x*Math.min(1,Math.hypot(moveAxis.x,moveAxis.y)),z:direction.z*Math.min(1,Math.hypot(moveAxis.x,moveAxis.y))});}
    if(shared&&(shared.tick!==coopTick||shared.epoch!==coopEpoch||shared.historyRevision!==coopHistoryRevision)){
      coopHistoryRevision=shared.historyRevision;
      coopTick=shared.tick;coopEpoch=shared.epoch;Object.assign(canvas.dataset,{coopWorld:coop.worldId,coopPlayer:coop.selfId,coopTick:String(shared.tick),coopEpoch:String(shared.epoch),coopSeconds:String(shared.worldSeconds),coopPosition:JSON.stringify(shared.me.position),coopPeers:JSON.stringify(shared.peers.map(peer=>({id:peer.playerId,position:peer.position})))});const oldId=state.id;const previousStage=front?.stage;state=shared.me;front=shared.front;
      if(oldId!==state.id){rebirthPending=false;lastChapter='';showBirthIntro();}
      if(previousStage!==front?.stage)view.syncFront(front);else view.updateFront(front);view.syncPeers(shared.peers);handleEvents(shared.events||[],`coop:${coop.worldId}:${shared.epoch}:${shared.tick}`);
      $('coop-people').textContent=shared.historyPending?'人生を記録しています。':`接続 ${shared.connected||1}人 · ${shared.peers.map(peer=>peer.name).join(' / ')}`;
    }
    uiElapsed+=dt;if(uiElapsed>=RINNE_RUNTIME_PERFORMANCE.uiSyncInterval){uiElapsed=0;syncUI();}
    if(Math.hypot(moveAxis.x,moveAxis.y)>.08&&open&&movementHint){movementHint=false;$('move-hint').hidden=true;}if(state.ended&&!rebirthPending)endLife();view.renderState(state,open?dt:0);birth.afterRender(open?dt:0,{carrierMoving:open&&Math.hypot(moveAxis.x,moveAxis.y)>.08});
    if(open&&Number.isSafeInteger(shared?.ackInputSeq))coop.inputDisplayed?.(shared.ackInputSeq);
    if(!document.hidden&&Number.isFinite(frameMs)&&frameMs>=0)coop.frameRendered?.(frameMs);
  }

  function frame(now){
    if(!active)return;raf=requestAnimationFrame(frame);const frameMs=Math.max(0,now-last),elapsed=frameMs/1000;last=now;const {simulationDelta:dt,lifeDelta}=splitRuntimeFrameDelta(elapsed,{paused:document.hidden});
    if(coop){renderCoopFrame(dt,frameMs,now);return;}
    const moveAxis=movementAxis(now);let moved=false,carrierMoving=false;const mag=Math.hypot(moveAxis.x,moveAxis.y),birthStep=birth.step(dt,moveAxis);
    if(birthStep.handled){moved=birthStep.moved;carrierMoving=birthStep.carrierMoving;}
    else if(mag>.08&&!state.ended&&!state.down){const direction=view.cameraVector(moveAxis),speed=(state.interior?interiorSpeedForAge(state.ageYears):speedForAge(state.ageYears))*(state.combat?.72:1),nx=state.position.x+direction.x*speed*dt,nz=state.position.z+direction.z*speed*dt;
      const movementZone=state.interior?'interior':state.zone;if(view.canMoveTo(nx,nz,.32,movementZone,state.interior?.buildingId)){state.position.x=nx;state.position.z=nz;state.yaw=Math.atan2(direction.x,direction.z);moved=true;}}
    if(moved&&movementHint){movementHint=false;$('move-hint').hidden=true;}
    setMoving(state,birthStep.handled?false:moved,state.yaw);const station=state.zone==='village'?nearestStation(stations,state.position,{interiorId:state.interior?.buildingId||null}):null,events=tickLife(state,{realDelta:dt,lifeDelta,station,paused:document.hidden});handleEvents(events);
    if(state.zone==='village'&&!moved&&(station?.enterInterior||station?.exitInterior)){
      if(doorStationId!==station.id){doorStationId=station.id;doorDwell=0;}doorDwell+=dt;
      if(doorDwell>=.55){const entering=station.enterInterior,changed=entering?enterBuilding(state,station):leaveBuilding(state);if(changed){toast(entering?`${station.label}へ入る`:'外へ出る');doorDwell=0;doorStationId='';void save();}}
    }else{doorDwell=0;doorStationId='';}
    if(state.zone==='village'&&!state.interior&&station?.port&&canDepart(state)&&!moved){portDwell+=dt;if(portDwell>=1.5&&depart(state)){front=createFront(0,state.seed);state.frontState=front;view.syncFront(front);toast('出航 · 前線');portDwell=0;}}else portDwell=0;
    const villageBattle=tickVillageSkirmish(state,skirmish,dt);handleEvents(villageBattle);view.updateSkirmish(skirmish);
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
  function visibility(){last=performance.now();coop?.pause(document.hidden);if(document.hidden){view.clearCombatEffects?.();keys.clear();swipe.cancel();setAxis({x:0,y:0});}}
  document.addEventListener('visibilitychange',visibility);
  window.addEventListener('pagehide',pagehide);
  if(front)view.syncFront(front);else view.syncFront(null);view.renderState(state,.016);birth.afterRender(.016,{carrierMoving:false});syncUI();uiElapsed=0;loading.hidden=true;canvas.dataset.runtime='active';
  armMovementHint();showBirthIntro();const birthNews=state.events?.find(event=>event.type==='village-news'&&event.worldSecond===0);if(birthNews&&state.ageYears<.2)toast(`村報 · ${birthNews.text}`);firstRunGuide=coop?null:startRinneFirstRunGuide({root:gameScreen.querySelector('.rinne-gameplay-upgrade'),gameScreen,canvas,getState:()=>state,environment:host.environment,mode});raf=requestAnimationFrame(frame);void save();

  function dispose(){
    if(!active)return;active=false;host.active=false;firstRunGuide?.dispose?.();firstRunGuide=null;view.clearCombatEffects?.();cancelAnimationFrame(raf);clearTimeout(toastTimer);clearTimeout(movementHintTimer);clearTimeout(chapterTimer);clearTimeout(hurtTimer);clearTimeout(dialogue.timer);birth.dispose();unsubscribeWorld();
    window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('pagehide',pagehide);canvas.removeEventListener('pointerdown',onPointerDown);canvas.removeEventListener('pointermove',onPointerMove);canvas.removeEventListener('pointerup',onPointerUp);canvas.removeEventListener('pointercancel',onPointerUp);
    document.removeEventListener('visibilitychange',visibility);for(const key of Object.keys(canvas.dataset))if(key.startsWith('coop'))delete canvas.dataset[key];view.syncPeers([]);$('coop-darkness').hidden=true;$('coop-people').textContent='';$('clock-rate').disabled=false;
    keys.clear();swipe.cancel();setAxis({x:0,y:0});endDialog?.remove();endDialog=null;$('dialogue').hidden=true;$('toast').hidden=true;canvas.dataset.runtime='prepared';
    if(ownsPrepared)host.dispose();
  }
  return{dispose,save:()=>save(),snapshot:()=>structuredClone(state),prepared:host};
}
