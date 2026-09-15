import { createWebPlatform } from '@soul/platform-web';
import { createSharedWorldChannel } from '@soul/platform-web/shared-world';
import { defaultMuraLayout, validateMuraLayout, safeMuraPosition } from '@soul/world/mura';
import { createLife, deserializeLife, serializeLife, setClockRate, setMoving, tickLife, objectiveFor, rebirth, LIFE_YEARS, canDepart, depart, advanceFront, returnHome } from './domain.js';
import { buildStations, nearestStation, nearestNamedPlace, normalizeLayout } from './locations.js';
import { createWorldRenderer } from './renderer.js';
import { createFront, normalizeFront, tickFront } from './combat.js';

const $=id=>document.getElementById(id);
const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
const speedForAge=age=>age<4?1.2:age<7?2.15:age<65?4.15:Math.max(2.3,4.15-(age-65)*.035);

export async function startRuntime({mode,buildInfo,name,onExit}){
  const environment=String(buildInfo.environment||'local'), platform=createWebPlatform({gameId:'rinne',environment,playerId:'local'}), saveKey='life-v2';
  let state=null;
  if(mode==='continue'){
    const raw=await platform.storage.read(saveKey);if(raw)state=deserializeLife(raw);
  }
  if(!state)state=createLife({name,seed:(Date.now()>>>0)});

  const channel=createSharedWorldChannel({environment,validate:validateMuraLayout});
  let layout=defaultMuraLayout();try{layout=normalizeLayout(channel.read()||layout);}catch(error){console.warn('shared world:',error);}
  if(state.zone==='village')state.position=safeMuraPosition(layout,state.position);
  else state.position={x:clamp(state.position.x,-6.8,6.8),z:clamp(state.position.z,-5.9,5.7)};
  const stations=buildStations(layout),canvas=$('game'),loading=$('loading-card');
  $('loading-message').textContent='村と旅人を描いています';
  const view=createWorldRenderer({canvas,document,layout,stations});
  let alive=true,raf=0,last=performance.now(),saveElapsed=0,toastTimer=0,endDialog=null,pointer=null,keyboard={x:0,y:0},axis={x:0,y:0},portDwell=0;
  let front=state.zone==='frontier'?normalizeFront(state.frontState,state.front,state.seed):null;

  const toast=text=>{if(!text)return;$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,2800);};
  const save=async()=>{if(!alive)return false;try{state.frontState=front?structuredClone(front):null;await platform.storage.write(saveKey,serializeLife(state));return true;}catch(error){toast('保存できませんでした');console.error(error);return false;}};
  function syncUI(){
    $('generation').textContent=`${state.generation}代目`;$('age').textContent=`${Math.min(LIFE_YEARS,Math.floor(state.ageYears))}歳`;
    $('hp-bar').style.width=`${clamp(state.hp/state.maxHp*100,0,100)}%`;$('stamina-bar').style.width=`${clamp(state.stamina/100*100,0,100)}%`;
    $('objective').textContent=objectiveFor(state);const near=state.zone==='village'?nearestNamedPlace(stations,state.position):null;$('place').textContent=state.zone==='village'?(near&&near.distance<18?`${near.label}まで ${near.distance.toFixed(0)}m`:'MURAAAAAAA'):`第${state.front+1}前線`;
    $('clock-rate').value=String(state.clockRate);
    $('move-hint').textContent=state.down?'救助を待っています':state.combat?'接触戦闘中 · 離れると解除':state.activity?`${state.activity.label} · 動けば中断`:(state.resting?'休息中 · スワイプで歩く':'スワイプした方向へ歩く');
  }
  function dialogue(speaker,text){$('speaker').textContent=speaker;$('dialogue-text').textContent=text;$('dialogue').hidden=false;clearTimeout(dialogue.timer);dialogue.timer=setTimeout(()=>$('dialogue').hidden=true,5200);}
  function talk(){
    if(state.phase==='birth'){dialogue('母','焦らなくていいよ。景色を見て、音を聞いて、あなたの歩幅で大きくなりなさい。');return;}
    const near=nearestNamedPlace(stations,state.position);
    const words={garden:'火のそばには誰かがいる。遊びも技になる。',school:'知ったことは、いつか身体の動きに変わる。',chapel:'祈りは逃げじゃない。心を整える時間だ。',smith:'刃を作る手を見ていると、力の通し方が見えてくる。',dojo:'上手い人の足は、止まって見えても止まっていない。',clinic:'生きて帰ることも強さだ。'};
    dialogue(near?.label||'村人',words[near?.id]||'今日はどこへ行く？ 村は歩いたぶんだけ、あなたに何かを返すよ。');
  }
  function endLife(){
    if(endDialog?.open)return;
    endDialog=document.createElement('dialog');endDialog.className='life-end-dialog';
    endDialog.innerHTML='<form method="dialog"><p>100年人生</p><h2 id="life-end-name"></h2><p><span id="life-end-generation"></span>代目は100歳を迎えました。</p><label>次の生へ遺す記憶<select id="memento"></select></label><button value="rebirth" id="rebirth">次の人生へ</button></form>';
    endDialog.querySelector('#life-end-name').textContent=`${state.name}の生涯`;
    endDialog.querySelector('#life-end-generation').textContent=String(state.generation);
    const choices=state.knownSkills.filter(x=>!x.startsWith('memory:')).slice(-10),select=endDialog.querySelector('#memento');
    for(const id of choices.length?choices:['']){const o=document.createElement('option');o.value=id;o.textContent=id||'村で過ごした日々';select.append(o);}
    document.body.append(endDialog);
    endDialog.addEventListener('close',async()=>{if(endDialog.returnValue==='rebirth'){
      state=rebirth(state,{memento:select.value||null});front=null;state.frontState=null;state.position=safeMuraPosition(layout,state.position);await save();endDialog.remove();endDialog=null;toast('また、生まれた。');
    }else endDialog.showModal();});endDialog.showModal();
  }
  function handleEvents(events){for(const event of events){
    if(event.type==='release')toast('4歳。自分の足で歩けるようになった。');
    if(event.type==='equipment')toast(`${event.station.label}に持ち替えた`);
    if(event.type==='activity-start')toast(`${event.station.actionLabel||event.station.label}を始めた`);
    if(event.type==='activity-complete')toast('経験がひとつ、身体に残った');
    if(event.type==='skills'&&event.ids.length)toast('新しい技を閃いた');
    if(event.type==='birthday'&&[7,15,50,80].includes(event.age))toast(`${event.age}歳になった`);
    if(event.type==='life-end')endLife();
    if(event.type==='enemy-down')toast('敵が崩れた');
    if(event.type==='downed')toast('行動不能。救助を待つ');
    if(event.type==='rescued')toast('救助され、村へ戻った');
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
  const unsubscribeWorld=channel.subscribe(next=>{if(!next||next.id!==layout.id)return;toast('村の景色が更新されました。次回起動時に反映します。');},error=>console.warn(error));

  function frame(now){
    if(!alive)return;raf=requestAnimationFrame(frame);const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
    let moved=false;const mag=Math.hypot(axis.x,axis.y);
    if(mag>.08&&!state.ended&&!state.down){const direction=view.cameraVector(axis),speed=speedForAge(state.ageYears)*(state.combat?.72:1),nx=state.position.x+direction.x*speed*dt,nz=state.position.z+direction.z*speed*dt;
      if(view.canMoveTo(nx,nz,state.phase==='birth'?.42:.32,state.zone)){state.position.x=nx;state.position.z=nz;state.yaw=Math.atan2(direction.x,direction.z);moved=true;}}
    setMoving(state,moved,state.yaw);const station=state.zone==='village'?nearestStation(stations,state.position):null,events=tickLife(state,{realDelta:dt,station,paused:document.hidden});handleEvents(events);
    if(state.zone==='village'&&station?.port&&canDepart(state)&&!moved){portDwell+=dt;if(portDwell>=1.5&&depart(state)){front=createFront(0,state.seed);state.frontState=structuredClone(front);view.syncFront(front);toast('船が出る。前線へ向かった。');portDwell=0;}}else portDwell=0;
    if(state.zone==='frontier'){
      front??=normalizeFront(state.frontState,state.front,state.seed);const battle=tickFront(state,front,dt);handleEvents(battle);view.syncFront(front);state.frontState=structuredClone(front);
      if(front.cleared&&state.position.z<=-5.85&&state.front<5&&advanceFront(state)){front=createFront(state.front,state.seed);state.frontState=structuredClone(front);view.syncFront(front);toast(`第${state.front+1}前線へ進んだ`);}
      else if(front.cleared&&state.front>=5&&state.position.z>=4.8&&returnHome(state)){state.position=safeMuraPosition(layout,{x:166,z:0});front=null;state.frontState=null;toast('100年人生の故郷へ帰還した');}
      if(state.zone==='village'&&battle.some(e=>e.type==='rescued')){state.position=safeMuraPosition(layout,{x:0,z:0});front=null;state.frontState=null;}
    }
    view.renderState(state,dt);syncUI();saveElapsed+=dt;if(saveElapsed>=2.5){saveElapsed=0;void save();}
  }
  if(front)view.syncFront(front);view.renderState(state,.016);syncUI();loading.hidden=true;raf=requestAnimationFrame(frame);void save();
  function pagehide(){void save();}
  window.addEventListener('pagehide',pagehide);
  function dispose(){if(!alive)return;alive=false;cancelAnimationFrame(raf);clearTimeout(toastTimer);unsubscribeWorld();window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('pagehide',pagehide);canvas.removeEventListener('pointerdown',onPointerDown);canvas.removeEventListener('pointermove',onPointerMove);canvas.removeEventListener('pointerup',onPointerUp);canvas.removeEventListener('pointercancel',onPointerUp);view.dispose();endDialog?.remove();endDialog=null;}
  return{dispose,save:()=>save(),snapshot:()=>structuredClone(state)};
}
