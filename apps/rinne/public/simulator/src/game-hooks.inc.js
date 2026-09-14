// Expanded integration boundary: actor movement/AI/skill logic is not replaced.
function initialHumanoidId(){try{const id=localStorage.getItem('tidebreak.expanded.model');return ['A','B','C','SHINO','TSUKU'].includes(id)?id:'A';}catch{return 'A';}}
function installNativeRenderer(){const T=THREE;renderer.scene.add(new T.HemisphereLight(0xe9f0ff,0x63676c,.80));for(const[col,intensity,x,y,z]of[[0xfff4e6,1.15,-3,4,4],[0xd5e7ff,.43,3,2,2],[0xd1e6ed,1.25,0,3,-3]]){const light=new T.DirectionalLight(col,intensity);light.position.set(x,y,z);renderer.scene.add(light);}renderer.name+=' / Expanded Humanoid';}

// SLASH_MOTION_WARP_PURE_BEGIN
const RINNE_SLASH_MOTION_WARP_VERSION=1;
const RINNE_SLASH_MOTION_WARP_DEFAULTS=Object.freeze({standoff:1.05,maxDistance:.55,maxAcquireDistance:2.60,maxAcquireAngle:Math.PI*.75,turnEnd:.14,warpStart:.18});
function warpClamp(x,a=0,b=1){return Math.max(a,Math.min(b,x));}
function warpSmooth01(x){x=warpClamp(x);return x*x*(3-2*x);}
function warpFinite(...values){return values.every(Number.isFinite);}
function warpAngleDelta(from,to){let d=(to-from)%(Math.PI*2);if(d>Math.PI)d-=Math.PI*2;if(d<-Math.PI)d+=Math.PI*2;return d;}
function validSlashMotionWarpTarget(actor,target){return !!target&&target!==actor&&warpFinite(target.x,target.z)&&!target.dead&&!target.lifeExpired&&!(Number.isFinite(target.hp)&&target.hp<=0);}
function chooseSlashMotionWarpTarget(actor,candidates,{maxAcquireDistance=RINNE_SLASH_MOTION_WARP_DEFAULTS.maxAcquireDistance,maxAcquireAngle=RINNE_SLASH_MOTION_WARP_DEFAULTS.maxAcquireAngle}={}){
 if(!actor||!warpFinite(actor.x,actor.z,actor.yaw,maxAcquireDistance,maxAcquireAngle)||maxAcquireDistance<0||maxAcquireAngle<0||maxAcquireAngle>Math.PI)throw Error('Invalid slash motion warp target query');
 const list=Array.isArray(candidates)?candidates:[];
 const explicitRaw=actor.attack?.target??actor.attack?.targetActor??actor.target??null;
 const explicitId=actor.attack?.targetId??actor.targetId??(typeof explicitRaw==='string'||typeof explicitRaw==='number'?explicitRaw:null);
 const explicit=typeof explicitRaw==='object'&&explicitRaw?explicitRaw:list.find(target=>String(target?.id)===String(explicitId));
 if(validSlashMotionWarpTarget(actor,explicit))return explicit;
 const forwardX=Math.sin(actor.yaw),forwardZ=Math.cos(actor.yaw),cosLimit=Math.cos(maxAcquireAngle);
 return list.map((target,index)=>{if(!validSlashMotionWarpTarget(actor,target))return null;const dx=target.x-actor.x,dz=target.z-actor.z,distance=Math.hypot(dx,dz);if(distance>maxAcquireDistance)return null;const facing=distance>1e-6?(dx*forwardX+dz*forwardZ)/distance:1;if(facing<cosLimit)return null;return{target,index,distanceSquared:dx*dx+dz*dz,key:String(target.id??index)};}).filter(Boolean).sort((a,b)=>a.distanceSquared-b.distanceSquared||a.key.localeCompare(b.key)||a.index-b.index)[0]?.target??null;
}
function createSlashMotionWarpPlan({actor,target,standoff=RINNE_SLASH_MOTION_WARP_DEFAULTS.standoff,maxDistance=RINNE_SLASH_MOTION_WARP_DEFAULTS.maxDistance,turnEnd=RINNE_SLASH_MOTION_WARP_DEFAULTS.turnEnd,warpStart=RINNE_SLASH_MOTION_WARP_DEFAULTS.warpStart,contact=.5}={}){
 if(!actor||!target||!warpFinite(actor.x,actor.z,actor.yaw,target.x,target.z,standoff,maxDistance,turnEnd,warpStart,contact)||standoff<0||maxDistance<0||turnEnd<0||warpStart<turnEnd||contact<=warpStart||contact>1)throw Error('Invalid slash motion warp plan');
 const dx=target.x-actor.x,dz=target.z-actor.z,distance=Math.hypot(dx,dz),yaw=distance>1e-6?Math.atan2(dx,dz):actor.yaw;
 const travel=Math.min(maxDistance,Math.max(0,distance-standoff)),scale=distance>1e-6?travel/distance:0;
 return Object.freeze({version:RINNE_SLASH_MOTION_WARP_VERSION,from:Object.freeze({x:actor.x,z:actor.z,yaw:actor.yaw}),target:Object.freeze({x:target.x,z:target.z}),to:Object.freeze({x:actor.x+dx*scale,z:actor.z+dz*scale,yaw}),distance,travel,standoff,maxDistance,turnEnd,warpStart,contact});
}
function sampleSlashMotionWarpPlan(plan,phase){
 if(!plan||plan.version!==RINNE_SLASH_MOTION_WARP_VERSION||!Number.isFinite(phase))throw Error('Invalid slash motion warp sample');
 const p=warpClamp(phase),turn=warpSmooth01(p/Math.max(1e-6,plan.turnEnd)),approach=p<=plan.warpStart?0:warpSmooth01((p-plan.warpStart)/(plan.contact-plan.warpStart));
 return{x:plan.from.x+(plan.to.x-plan.from.x)*approach,z:plan.from.z+(plan.to.z-plan.from.z)*approach,yaw:plan.from.yaw+warpAngleDelta(plan.from.yaw,plan.to.yaw)*turn,turn,approach,contactReached:p>=plan.contact};
}
// SLASH_MOTION_WARP_PURE_END

// SLASH_MOTION_WARP_CONTROLLER_BEGIN
const slashMotionWarpStates=new WeakMap();
function slashMotionWarpAttackEligible(actor){return !!actor?.hero&&!actor.dead&&!actor.recovery&&(actor.weapon||'sword')==='sword'&&actor.attack?.kind==='slash';}
function clearSlashMotionWarp(actor){if(actor&&typeof actor==='object')slashMotionWarpStates.delete(actor);}
function advanceControllerSlashMotionWarp(actor){
 if(!slashMotionWarpAttackEligible(actor)){clearSlashMotionWarp(actor);return null;}
 const attack=actor.attack,contact=POSE_CLIPS?.slash?.contact??.5,phase=attackProgress(actor);
 if(!Number.isFinite(phase)){clearSlashMotionWarp(actor);return null;}
 let state=slashMotionWarpStates.get(actor);
 if(!state||state.attack!==attack){
  const target=chooseSlashMotionWarpTarget(actor,enemies,RINNE_SLASH_MOTION_WARP_DEFAULTS);
  if(!target){clearSlashMotionWarp(actor);return null;}
  state={attack,target,plan:createSlashMotionWarpPlan({actor,target,contact}),contactApplied:false};slashMotionWarpStates.set(actor,state);
 }
 if(!validSlashMotionWarpTarget(actor,state.target)){clearSlashMotionWarp(actor);return null;}
 if(state.contactApplied)return state.plan;
 const sample=sampleSlashMotionWarpPlan(state.plan,phase);
 // This integration layer is the only writer. HumanoidRuntime only consumes actor position.
 actor.yaw=sample.yaw;actor.x=sample.x;actor.z=sample.z;
 if(sample.contactReached)state.contactApplied=true;
 return state.plan;
}
// SLASH_MOTION_WARP_CONTROLLER_END

humanoid=new HumanoidRuntime({weapons:WEAPONS,strikes:STRIKES,clips:POSE_CLIPS,windows:HIT_WINDOWS,progress:attackProgress,window:(kind,p)=>contactWindow(kind,p),hand:(kind,p)=>activeHandSide({kind,p}),echo:node=>renderer.scene.add(node),status:message=>{if($('humanoidStatus'))$('humanoidStatus').textContent=message;},attach:c=>{renderer.scene.add(c.root);for(const p of c.shadowMeshes)renderer.shadowScene.add(p);renderer.renderer.renderLists.dispose();}});
const controllerHumanoidTick=humanoid.tick.bind(humanoid);humanoid.tick=function(actor,dt){advanceControllerSlashMotionWarp(actor);return controllerHumanoidTick(actor,dt);};
const expandedOldPose=actorPose,expandedOldSample=sampleWeapon,expandedOldDraw=drawActor,expandedOldParts=actorParts;
// Same sampler drives the renderer, 240 Hz swept-capsule checks and VFX.
actorPose=function(a,at=null,px=a.x,pz=a.z){if(!a.hero||!humanoid.current)return expandedOldPose(a,at,px,pz);const p=expandedOldPose(a,at,px,pz),h=humanoid.sample(a,at,px,pz);return {...p,...h,sm:new Float32Array(h.sm),expanded:true};};
sampleWeapon=function(a,at,px=a.x,pz=a.z){if(!a.hero||!humanoid.current)return expandedOldSample(a,at,px,pz);const s=humanoid.sample(a,at,px,pz);return{a:s.a,b:s.b,radius:s.radius,active:s.active,phase:s.phase,group:s.group};};
function expandedWeaponMesh(weapon){const w=WEAPONS[weapon],key='humanoid_'+humanoid.modelId+'_'+w.mesh;if(models[key])return key;const data=models[w.mesh].slice(),thin={sword:.48,great:.46,spear:.51,axe:.48,katana:.52}[weapon]||1,top=weapon==='spear'?1.38:.08;for(let i=0;i<data.length;i+=11){if(data[i+1]<top){data[i]*=thin;data[i+2]*=thin;const n=Math.hypot(data[i+3]/thin,data[i+4],data[i+5]/thin)||1;data[i+3]/=thin*n;data[i+4]/=n;data[i+5]/=thin*n;}}models[key]=data;return key;}
function expandedParts(a,p){const out=[],w=WEAPONS[a.weapon];if(a.weapon!=='fist')out.push({name:expandedWeaponMesh(a.weapon),m:new Float32Array(p.sm)});
 if(p.carry&&['sword','katana'].includes(a.weapon)){const sheath=a.weapon==='sword'?'travelSheath':'katanaCase';if(models[sheath])out.push({name:sheath,m:new Float32Array(p.carry)});}
 if(a.weapon==='sword'){const sm=new THREE.Matrix4().fromArray(p.leftSocket),pos=new THREE.Vector3(),q=new THREE.Quaternion(),scale=new THREE.Vector3();sm.decompose(pos,q,scale);const target=new THREE.Matrix4().compose(pos,q,new THREE.Vector3(.76,.76,.76));out.push({name:'shield',m:new Float32Array(target.elements)});}
 return out;
}
actorParts=function(a,p){return a.hero&&humanoid.current?expandedParts(a,p):expandedOldParts(a,p);};
drawActor=function(a,out,shadows,now){if(!a.hero||!humanoid.current)return expandedOldDraw(a,out,shadows,now);humanoid.updateEchoes(showFX);const p=humanoid.render(a);for(const part of expandedParts(a,p))out.append(models[part.name],part.m,a.dead?1-clamp((a.deadTime-.85)/.70,0,1):1,a.flash>0?[1,1,.96,clamp(a.flash*6.5,0,.84)]:null);a.weaponBase=p.a;a.weaponTip=p.b;a.trailActive=p.active;if(!a.dead){disc(shadows,a.x,.076,a.z,.36,.27,[.025,.075,.10,.19/(1+(a.air||0))],20);disc(shadows,a.x,.075,a.z,.49,.38,[.035,.10,.13,.07],20);}};
const echoExpanded=addEcho;addEcho=function(a){echoExpanded(a);if(a.hero&&showFX&&humanoid.current)humanoid.captureEcho(a);};
const hitExpanded=knockReaction;knockReaction=function(a,...args){a._hitSerial=(a._hitSerial||0)+1;return hitExpanded(a,...args);};
async function chooseHumanoid(id){const select=$('avatar'),before=humanoid.modelId;select.disabled=true;const busy=$('humanoidBusy');busy.hidden=false;try{await humanoid.load(id);select.value=id;try{localStorage.setItem('tidebreak.expanded.model',id);}catch{}if(hero){hero.trail=[];hero._humanoidModel=id;}syncEquipment();refreshHumanoidUI();renderOverview(true);if(hero){camera(0);drawFrame();updateLiveUI();}store();return true;}catch(e){humanoid.errors.push(e.message);select.value=before;toast('モデルを変更できませんでした：'+e.message);return false;}finally{select.disabled=false;busy.hidden=true;}}
function refreshHumanoidUI(){const c=humanoid.current;if(!c)return;$('avatar').value=c.id;$('avatarSummary').textContent=c.m.name;$('humanoidPortrait').src=window.ASSET_PORTRAITS?.[c.id]||'assets/portrait_'+c.id+'.webp';$('humanoidCredit').textContent=c.m.credit+'\n'+c.m.license+'\n'+c.m.commercialNotes;}
function installCharacterUI(){const sel=$('avatar');sel.replaceChildren(...humanoid.catalog.map(m=>new Option(m.name,m.id)));sel.onchange=()=>chooseHumanoid(sel.value);const status=document.createElement('small');status.id='humanoidStatus';sel.after(status);const portrait=document.createElement('img');portrait.id='humanoidPortrait';portrait.alt='選択中のキャラクター';$('avatarSummary').before(portrait);const credit=document.createElement('p');credit.id='humanoidCredit';$('equipmentFields').append(credit);const detail=document.createElement('details');detail.className='humanoid-details';detail.innerHTML='<summary>Animationとモデルについて</summary><p>Expanded Review収録の5体。Idle / Walk / Run：共通VRMA。被弾と拳の動作：Review作成モーション。武器別攻撃・死亡・共通Weapon SocketはTidebreak向けの追加実装です。モデル切替では体力・技・位置を変更しません。</p><p>モデルに内蔵Animationはありません。各キャラクターの原作・利用条件は同梱のlicensesをご確認ください。</p><div class="humanoid-actions"><button id="sameCombatReset" type="button">同じ条件で稽古をリセット</button><button id="humanoidReport" type="button">骨格・Socket情報を書き出す</button></div>';$('panel-character').append(detail);$('sameCombatReset').onclick=()=>{resetScene(true);refreshHumanoidUI();};$('humanoidReport').onclick=()=>{const b=new Blob([JSON.stringify(humanoid.report(),null,2)],{type:'application/json'}),url=URL.createObjectURL(b),a=document.createElement('a');a.href=url;a.download='Tidebreak_'+humanoid.modelId+'_Humanoid.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);};const busy=document.createElement('div');busy.id='humanoidBusy';busy.hidden=true;busy.textContent='キャラクターとAnimationを読み込んでいます';$('stage').append(busy);}
const syncExpanded=syncEquipment;syncEquipment=function(){syncExpanded();if($('humanoidPortrait')&&humanoid.current)refreshHumanoidUI();};
const exportExpanded=exportData;exportExpanded=function(){const v=exportExpanded();v.equipment.humanoidModel=humanoid.modelId;return v;};
const decodeExpanded=decodeNotebook;decodeNotebook=function(data,...args){const v=decodeExpanded(data,...args),id=data.equipment?.humanoidModel;if(id&&!humanoid.catalog.some(m=>m.id===id))throw Error('モデルIDが不正です');v.humanoidModel=id;return v;};
const applyExpanded=applyNotebook;applyNotebook=function(v,...args){applyExpanded(v,...args);if(v.humanoidModel&&humanoid.current&&v.humanoidModel!==humanoid.modelId)chooseHumanoid(v.humanoidModel);};
function installHumanoidLab(){refreshHumanoidUI();window.__HUMANOID_LAB__={runtime:humanoid,report:()=>humanoid.report(),models:()=>humanoid.catalog.map(m=>({id:m.id,name:m.name})),select:chooseHumanoid,
 actors:()=>[hero,...enemies],renderer:()=>renderer,
 setCamera:(angle=.0,pitch=.17,near=1.45)=>{camAngle=angle;camPitch=pitch;zoom=near;camera(0);drawFrame();},
 sample:(t=null)=>humanoid.sample(hero,t),render:()=>{camera(0);drawFrame();},motionWarp:()=>slashMotionWarpStates.get(hero)?.plan??null,
 isolated:(type,t=0)=>{humanoid.testOverride={key:type,type,time:t,clock:(hero._humanoidClock||0)+t,kind:type==='attack'?'slash':null};humanoid.current.state=null;humanoid.current.lastActual=null;camera(0);drawFrame();},clearOverride:()=>{humanoid.testOverride=null;},
 advance:(seconds=.2)=>{const dt=1/60;for(let i=0;i<Math.round(seconds/dt);i++){update(dt);}camera(0);drawFrame();updateLiveUI();},
 normalizedPoints:()=>Object.fromEntries(Object.entries(humanoid.current.bones).map(([n,b])=>[n,b.getWorldPosition(new THREE.Vector3()).toArray()])),
 setReady:ready=>changeReadiness(hero,ready,'モデル検証'),forceDeath:()=>incapacitate(hero,enemies[0]),clock:()=>time,
 sourceMatch:()=>({modelBytes:humanoid.current.m.reviewBytes,motionSource:humanoid.sourceInfo}),captureEcho:()=>addEcho(hero)};}

// MOTION_QUALITY_PHASE2_GAME_BEGIN
const RINNE_MOTION_QUALITY_PHASE2_GAME_VERSION=1;
const phase2GameProfiles={
 slash:{standoff:1.05,maxCorrection:.55,maxAcquireDistance:2.60,maxAcquireAngle:Math.PI*.75,turnEnd:.14,warpStart:.18,contact:.50},
 back:{standoff:1.00,maxCorrection:.38,maxAcquireDistance:2.45,maxAcquireAngle:Math.PI*.72,turnEnd:.14,warpStart:.19,contact:.50},
 thrust:{standoff:1.20,maxCorrection:.46,maxAcquireDistance:2.90,maxAcquireAngle:Math.PI*.62,turnEnd:.12,warpStart:.16,contact:.47},
 heavy:{standoff:1.08,maxCorrection:.30,maxAcquireDistance:2.55,maxAcquireAngle:Math.PI*.64,turnEnd:.16,warpStart:.22,contact:.52},
 dash:{standoff:1.12,maxCorrection:.16,maxAcquireDistance:3.40,maxAcquireAngle:Math.PI*.52,turnEnd:.11,warpStart:.18,contact:.50},
 spin:{standoff:1.05,maxCorrection:.12,maxAcquireDistance:2.25,maxAcquireAngle:Math.PI,turnEnd:.18,warpStart:.24,contact:.50},
 leap:{standoff:1.14,maxCorrection:.18,maxAcquireDistance:3.25,maxAcquireAngle:Math.PI*.55,turnEnd:.12,warpStart:.20,contact:.52},
 retreat:{standoff:1.30,maxCorrection:0,maxAcquireDistance:2.30,maxAcquireAngle:Math.PI,turnEnd:.16,warpStart:.24,contact:.52}
};
function phase2GameProfile(kind,contact=null){
 const p=phase2GameProfiles[kind]||(/thrust|pierce|straight|sky/i.test(kind)?phase2GameProfiles.thrust:/heavy|meteor|smash/i.test(kind)?phase2GameProfiles.heavy:/spin|round|wheel|sweep/i.test(kind)?phase2GameProfiles.spin:/dash|rush|blink/i.test(kind)?phase2GameProfiles.dash:/leap|jump/i.test(kind)?phase2GameProfiles.leap:/back|return/i.test(kind)?phase2GameProfiles.back:phase2GameProfiles.slash);
 const c=Number.isFinite(contact)?contact:p.contact;
 return Object.freeze({version:RINNE_MOTION_QUALITY_PHASE2_GAME_VERSION,kind,standoff:p.standoff,maxCorrection:p.maxCorrection,maxDistance:p.maxCorrection,maxAcquireDistance:p.maxAcquireDistance,maxAcquireAngle:p.maxAcquireAngle,turnEnd:p.turnEnd,warpStart:p.warpStart,warpEnd:c,contact:c,rootMotion:Object.freeze({horizontalOwner:'controller',authoredHorizontalTravel:0,gameplayMovement:'existing-controller-footwork',correctionPolicy:'bounded-motion-warp'})});
}
function phase2MoveBy(actor,dx,dz){
 if(!actor||!warpFinite(actor.x,actor.z,dx,dz))throw Error('Invalid Phase2 movement');
 const from={x:actor.x,z:actor.z},requested=Math.hypot(dx,dz);
 if(typeof moveActor==='function')moveActor(actor,dx,dz);else{actor.x+=dx;actor.z+=dz;}
 const actual=Math.hypot(actor.x-from.x,actor.z-from.z);
 return Object.freeze({from:Object.freeze(from),to:Object.freeze({x:actor.x,z:actor.z}),requested,actual,clipped:actual+1e-6<requested});
}
function phase2CompatibleStageVariant(actor,spec,target){
 const raw=Array.isArray(spec?.motionVariants)?spec.motionVariants:[];
 const candidates=[spec,...raw].filter(candidate=>candidate&&typeof candidate.kind==='string'&&Number.isFinite(candidate.anim)&&Number.isFinite(candidate.cut)&&STRIKES?.[candidate.kind]&&POSE_CLIPS?.[candidate.kind]);
 if(candidates.length<=1||!target)return{spec,requested:spec?.kind??null,selected:spec?.kind??null,changed:false,reason:'recipe-authority'};
 const distance=Math.hypot(target.x-actor.x,target.z-actor.z),aim=Math.atan2(target.x-actor.x,target.z-actor.z),angle=Math.abs(warpAngleDelta(actor.yaw,aim));
 const scored=candidates.map((candidate,index)=>{
  const strike=STRIKES[candidate.kind],weapon=WEAPONS[actor.weapon],profile=phase2GameProfile(candidate.kind,POSE_CLIPS[candidate.kind]?.contact);
  const reach=(strike.close?1.06:weapon?.ideal??1.4)+Math.min(strike.lunge??0,profile.maxAcquireDistance*.35);
  const anglePenalty=angle>profile.maxAcquireAngle?100:angle/profile.maxAcquireAngle;
  return{candidate,index,score:Math.abs(distance-reach)+anglePenalty*.35};
 }).sort((a,b)=>a.score-b.score||String(a.candidate.kind).localeCompare(String(b.candidate.kind))||a.index-b.index);
 const selected=scored[0]?.candidate??spec;
 return{spec:selected,requested:spec.kind,selected:selected.kind,changed:selected!==spec,reason:selected===spec?'requested-best-fit':'explicit-motion-variant'};
}
const phase2BeginStep=beginStep;
beginStep=function(actor,override=null){
 const source=override||actor?.run?.specs?.[actor.run.index]||null,target=actor?nearest(actor):null;
 const choice=source?phase2CompatibleStageVariant(actor,source,target):{spec:source,requested:null,selected:null,changed:false,reason:'no-stage'};
 const result=phase2BeginStep(actor,choice.changed?choice.spec:override);
 if(actor?.attack){
  const kind=actor.attack.kind,profile=phase2GameProfile(kind,POSE_CLIPS?.[kind]?.contact);
  actor.attack.motionQualityProfile=profile;
  actor.attack.motionQualitySelection=Object.freeze({requested:choice.requested??kind,selected:kind,changed:(choice.requested??kind)!==kind,reason:choice.reason,distance:target?Math.hypot(target.x-actor.x,target.z-actor.z):null});
 }
 return result;
};

advanceControllerSlashMotionWarp=function(actor){
 if(!slashMotionWarpAttackEligible(actor)){
  if(actor)actor._motionQualityOrientation=null;
  clearSlashMotionWarp(actor);return null;
 }
 const attack=actor.attack,contact=POSE_CLIPS?.slash?.contact??.5,phase=attackProgress(actor),profile=phase2GameProfile('slash',contact);
 if(!Number.isFinite(phase)){actor._motionQualityOrientation=null;clearSlashMotionWarp(actor);return null;}
 let state=slashMotionWarpStates.get(actor);
 if(!state||state.attack!==attack){
  const target=chooseSlashMotionWarpTarget(actor,enemies,profile);
  if(!target){actor._motionQualityOrientation=null;clearSlashMotionWarp(actor);return null;}
  state={attack,target,profile,plan:createSlashMotionWarpPlan({actor,target,standoff:profile.standoff,maxDistance:profile.maxCorrection,turnEnd:profile.turnEnd,warpStart:profile.warpStart,contact:profile.contact}),contactApplied:false,lastApproach:0,collision:null};
  slashMotionWarpStates.set(actor,state);
 }
 if(!validSlashMotionWarpTarget(actor,state.target)){actor._motionQualityOrientation=null;clearSlashMotionWarp(actor);return null;}
 if(state.contactApplied){actor._motionQualityOrientation=null;return state.plan;}
 const sample=sampleSlashMotionWarpPlan(state.plan,phase),deltaApproach=Math.max(0,sample.approach-state.lastApproach);
 const dx=(state.plan.to.x-state.plan.from.x)*deltaApproach,dz=(state.plan.to.z-state.plan.from.z)*deltaApproach;
 actor.yaw=sample.yaw;
 state.collision=phase2MoveBy(actor,dx,dz);
 state.lastApproach=sample.approach;
 actor._motionQualityOrientation={delta:warpAngleDelta(state.plan.from.yaw,state.plan.to.yaw),progress:sample.turn,source:'bounded-motion-warp'};
 if(sample.contactReached){state.contactApplied=true;actor._motionQualityOrientation=null;}
 return state.plan;
};

let lastMotionQualityImpactBeat=null,motionQualityImpactSerial=0;
const phase2KnockReaction=knockReaction;
knockReaction=function(target,source,attack,guarded=false){
 if(target)target._motionQualityLastGuarded=!!guarded;
 return phase2KnockReaction(target,source,attack,guarded);
};
function phase2ImpactBeat(source,target,attack,contact,before){
 const hpChanged=target&&Number.isFinite(before.hp)&&Number.isFinite(target.hp)&&target.hp<before.hp;
 const reactionChanged=(target?._hitSerial||0)>before.reactionSerial;
 if(!hpChanged&&!reactionChanged)return null;
 const beat=Object.freeze({
  version:RINNE_MOTION_QUALITY_PHASE2_GAME_VERSION,
  id:`impact:${++motionQualityImpactSerial}`,
  clock:typeof time==='number'?time:0,
  sourceId:source?.id??null,targetId:target?.id??null,attackId:attack?.id??null,kind:attack?.kind??'unknown',
  guarded:!!target?._motionQualityLastGuarded,heavy:(STRIKES?.[attack?.kind]?.damage??0)>=36,
  point:Array.isArray(contact?.point)?Object.freeze(contact.point.slice(0,3)):null,
  channels:Object.freeze(['hit-stop','impact-slow','camera','vfx','sfx','reaction']),
  hitstop:typeof hitstop==='number'?hitstop:0,impactSlow:typeof impactSlow==='number'?impactSlow:0,
  impactSlowScale:typeof impactSlowScale==='number'?impactSlowScale:1,cameraImpulse:typeof shake==='number'?shake:0,
  reactionSerial:target?._hitSerial||0,
  vfx:Object.freeze({impacts:typeof impacts!=='undefined'?Math.max(0,impacts.length-before.impacts):0,particles:typeof particles!=='undefined'?Math.max(0,particles.length-before.particles):0,circles:typeof circles!=='undefined'?Math.max(0,circles.length-before.circles):0}),
  sfx:'audio.impact',reaction:!!target?.reaction,damageAuthority:'gameplay-unchanged'
 });
 lastMotionQualityImpactBeat=beat;
 if(source)source._motionQualityImpactBeat=beat;if(target)target._motionQualityImpactBeat=beat;
 try{window.__RINNE_MOTION_QUALITY_PORTS__?.impact?.(beat);}catch(error){console.warn('Motion Quality impact port failed:',error);}
 try{window.dispatchEvent(new CustomEvent('rinne:impact-beat',{detail:beat}));}catch{}
 return beat;
}
const phase2RegisterHit=registerHit;
registerHit=function(source,target,attack,contact){
 const before={hp:target?.hp,reactionSerial:target?._hitSerial||0,impacts:typeof impacts!=='undefined'?impacts.length:0,particles:typeof particles!=='undefined'?particles.length:0,circles:typeof circles!=='undefined'?circles.length:0};
 const result=phase2RegisterHit(source,target,attack,contact);
 phase2ImpactBeat(source,target,attack,contact,before);
 return result;
};

function phase2AugmentHumanoidLab(){
 if(typeof window==='undefined'||!window.__HUMANOID_LAB__)return;
 Object.assign(window.__HUMANOID_LAB__,{
  motionQuality:()=>humanoid.report().motionQualityPhase2,
  motionQualityWarp:()=>slashMotionWarpStates.get(hero)??null,
  motionQualityAttack:(kind='slash')=>phase2GameProfile(kind,POSE_CLIPS?.[kind]?.contact),
  lastImpactBeat:()=>lastMotionQualityImpactBeat
 });
}
const phase2InstallHumanoidLab=installHumanoidLab;
installHumanoidLab=function(){phase2InstallHumanoidLab();phase2AugmentHumanoidLab();};
if(typeof window!=='undefined'&&window.__HUMANOID_LAB__)phase2AugmentHumanoidLab();
// MOTION_QUALITY_PHASE2_GAME_END
