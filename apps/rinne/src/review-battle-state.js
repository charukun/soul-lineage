import {combatCameraFrame,combatCameraPosition} from '@soul/rendering/combat-camera-frame';

const PHASES=Object.freeze(['jo','ha','kyu']);
const PHASE_SET=new Set(PHASES);
const FIXED_CAMERA=Object.freeze({
  position:Object.freeze({x:0,y:5.2,z:10}),
  look:Object.freeze({x:0,y:.95,z:0}),
  separation:0,
  follow:false,
  system:'fixed',
  count:0
});

export const REVIEW_BATTLE_PHASES=PHASES;
export const REVIEW_BATTLE_PHASE_LABELS=Object.freeze({jo:'序',ha:'破',kyu:'急'});

export function normalizeReviewBattlePhase(value){
  return PHASE_SET.has(value)?value:'';
}

export function reviewBattlePhaseState(core){
  const heroPhase=normalizeReviewBattlePhase(core?.hero?.slot);
  const enemyPhase=normalizeReviewBattlePhase(core?.enemy?.slot);
  const phase=heroPhase||enemyPhase;
  return Object.freeze({
    phase,
    heroPhase,
    enemyPhase,
    source:heroPhase?'left':enemyPhase?'right':'',
    skill:core?.hero?.skill||core?.enemy?.skill||''
  });
}

export function reviewBattleLoopDue({loopEnabled=false,playing=false,finished=false,finishedAt=0,now=0,delayMs=900}={}){
  return Boolean(loopEnabled&&playing&&finished&&finishedAt>0&&now-finishedAt>=Math.max(0,delayMs));
}

const presentationClamp=(value,lo,hi)=>Math.min(hi,Math.max(lo,value));
const presentationFinite=value=>Number.isFinite(Number(value))?Number(value):0;
const wrapAngle=value=>Math.atan2(Math.sin(value),Math.cos(value));

/**
 * Review rendering follows Tidebreak's authoritative root position and yaw.
 * Smoothing may affect animation cadence, never contact geometry or actor position.
 */
export function reviewBattlePresentationFrame(actor,target,previous=null,dt=1/60,{hit=false}={}){
  const step=presentationClamp(presentationFinite(dt)||1/60,1/240,.05);
  const x=presentationFinite(actor?.x),z=presentationFinite(actor?.z),fallbackYaw=target?Math.atan2(presentationFinite(target.x)-x,presentationFinite(target.z)-z):0;
  const yaw=Number.isFinite(Number(actor?.yaw))?wrapAngle(Number(actor.yaw)):wrapAngle(fallbackYaw);
  const start=previous||{x,z,yaw},speed=Math.hypot(x-start.x,z-start.z)/step,attack=String(actor?.attack||''),progress=presentationClamp(presentationFinite(actor?.progress),0,1);
  return Object.freeze({x,z,yaw,stride:presentationClamp(speed*.22,0,1),attackPulse:attack?Math.sin(progress*Math.PI):0,lunge:0,recoil:0,authoritative:true,hit:Boolean(hit)});
}

const REVIEW_SWEEPS=new Set(['slash','back','heavy','spin','sweep','diagonal','crosscut','round','hook','bodyblow','barrage','rushfist','uppercut','risingfist','meteor','bullrush']);
const REVIEW_STOP_ON_FIRST=new Set(['thrust','pierce','dash','jab','straight','oneinch','katanaThrust']);
export function reviewBattleMultiHitFrame(actor,{encounterMode='duel'}={}){
  const attack=String(actor?.attack||''),progress=presentationClamp(presentationFinite(actor?.progress),0,1),phase=normalizeReviewBattlePhase(actor?.slot);
  const active=encounterMode==='one-v-three'&&REVIEW_SWEEPS.has(attack)&&!REVIEW_STOP_ON_FIRST.has(attack)&&progress>=.3&&progress<=.72;
  const full=attack==='spin'||attack==='round'||attack==='barrage';
  return Object.freeze({active,attack,phase,progress,count:active?3:1,recoil:active?(phase==='kyu'?.42:phase==='ha'?.3:.24):0,spread:full?1:.72});
}

export function reviewBattleCameraFrame(core,{follow=true,system='rinne',encounterMode='duel',wide=false}={}){
  if(!follow)return FIXED_CAMERA;
  const hero=core?.hero,enemies=(core?.enemies||[core?.enemy]).filter(Boolean);
  if(!hero||!enemies.length)return FIXED_CAMERA;
  if(![hero.x,hero.z,...enemies.flatMap(enemy=>[enemy.x,enemy.z])].every(value=>Number.isFinite(Number(value))))return FIXED_CAMERA;
  const player={x:Number(hero.x),z:Number(hero.z)};
  const threats=enemies.map((enemy,index)=>({id:`enemy-${index}`,x:Number(enemy.x),z:Number(enemy.z),dead:Boolean(enemy.dead)}));
  const style=system==='demon'?'demon':'rinne',frame=combatCameraFrame({player,threats,style,wide:Boolean(wide)});
  if(!frame)return FIXED_CAMERA;
  const sharedPosition=combatCameraPosition(frame),sharedLook=frame.look;
  const look={x:player.x,y:Number(sharedLook.y)||.95,z:player.z};
  const offset={x:sharedPosition.x-Number(sharedLook.x||0),y:sharedPosition.y-Number(sharedLook.y||0),z:sharedPosition.z-Number(sharedLook.z||0)};
  const finisher=core?.hero?.skill==='止め';
  const distanceScale=finisher?.72:1;
  const position={x:look.x+offset.x*distanceScale,y:look.y+offset.y*(finisher?.82:1),z:look.z+offset.z*distanceScale};
  return Object.freeze({position:Object.freeze(position),look:Object.freeze(look),separation:frame.spread,follow:true,system:style,count:frame.count,lock:'hero',finisher});
}


export const REVIEW_FINISHER_DURATION=1.28;
export const REVIEW_FINISHER_IMPACT=.52;

export function createReviewFinisher(core,previousCore=null){
  const enemies=(core?.enemies||[core?.enemy]).filter(Boolean);
  if(!core?.done||!core?.hero||core.hero.dead||!enemies.length||!enemies.every(enemy=>enemy.dead))return null;
  const targetIndex=Math.max(0,enemies.length-1),target=enemies[targetIndex],previousEnemies=(previousCore?.enemies||[previousCore?.enemy]).filter(Boolean),previousTarget=previousEnemies[targetIndex]||previousEnemies.at(-1),stableTarget=previousTarget&&Number.isFinite(Number(previousTarget.x))&&Number.isFinite(Number(previousTarget.z))?previousTarget:target,origin=structuredClone(core);
  const originEnemies=origin.enemies||[origin.enemy].filter(Boolean),originTarget=originEnemies[targetIndex]||originEnemies.at(-1);
  if(originTarget){originTarget.x=Number(stableTarget.x)||0;originTarget.z=Number(stableTarget.z)||0;}
  if(origin.enemy&&origin.enemies)origin.enemy=origin.enemies[0];
  return Object.freeze({elapsed:0,targetIndex,impactPlayed:false,origin,target:{x:Number(stableTarget.x)||0,z:Number(stableTarget.z)||0}});
}

export function advanceReviewFinisher(run,dt=0){
  if(!run)return Object.freeze({run:null,core:null,impact:false,finished:false});
  const elapsed=Math.min(REVIEW_FINISHER_DURATION,run.elapsed+Math.max(0,Number(dt)||0)),progress=Math.min(1,elapsed/REVIEW_FINISHER_DURATION),core=structuredClone(run.origin);
  const enemies=core.enemies||[core.enemy].filter(Boolean),target=enemies[run.targetIndex]||enemies.at(-1),hero=core.hero;
  if(target){target.x=run.target.x;target.z=run.target.z;}
  const dx=run.target.x-(Number(hero?.x)||0),dz=run.target.z-(Number(hero?.z)||0),distance=Math.max(.001,Math.hypot(dx,dz)),desired=1.05,close=Math.max(0,distance-desired),approach=Math.min(1,progress/.34);
  hero.x=(Number(hero.x)||0)+dx/distance*close*approach;hero.z=(Number(hero.z)||0)+dz/distance*close*approach;hero.yaw=Math.atan2(dx,dz);hero.attack='heavy';hero.progress=progress;hero.slot='kyu';hero.skill='止め';hero.dead=false;
  if(target){target.hp=0;target.attack=null;target.progress=0;target.downed=progress<1;target.dead=progress>=1;}
  core.done=progress>=1;core.winner=progress>=1?'hero':null;
  if(core.enemy&&core.enemies)core.enemy=core.enemies[0];
  const impact=!run.impactPlayed&&progress>=REVIEW_FINISHER_IMPACT,next=Object.freeze({...run,elapsed,impactPlayed:run.impactPlayed||impact});
  return Object.freeze({run:next,core,impact,finished:progress>=1,targetIndex:run.targetIndex,progress});
}
