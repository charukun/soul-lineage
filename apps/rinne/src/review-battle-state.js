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
 * Review-only locomotion inspired by Nocturne/Eclipse: simulation remains
 * authoritative, while the rendered actor eases into contact, commits through
 * the strike, recoils on damage, and settles back into guard.
 */
export function reviewBattlePresentationFrame(actor,target,previous=null,dt=1/60,{hit=false}={}){
  const step=presentationClamp(presentationFinite(dt)||1/60,1/240,.05);
  const rawX=presentationFinite(actor?.x)*1.35,rawZ=presentationFinite(actor?.z)*1.15;
  const targetX=presentationFinite(target?.x)*1.35,targetZ=presentationFinite(target?.z)*1.15;
  const start=previous||{x:rawX,z:rawZ,yaw:Math.atan2(targetX-rawX,targetZ-rawZ)};
  const attack=String(actor?.attack||''),progress=presentationClamp(presentationFinite(actor?.progress),0,1);
  const dx=targetX-rawX,dz=targetZ-rawZ,distance=Math.max(.001,Math.hypot(dx,dz)),nx=dx/distance,nz=dz/distance;
  const attackPulse=attack?Math.sin(progress*Math.PI):0;
  const lunge=attackPulse*(actor?.slot==='kyu'?.34:actor?.slot==='ha'?.27:.22);
  const recoil=hit?.16:0;
  const desiredX=rawX+nx*(lunge-recoil),desiredZ=rawZ+nz*(lunge-recoil);
  const positionBlend=1-Math.exp(-step*(attack?18:11));
  const x=start.x+(desiredX-start.x)*positionBlend,z=start.z+(desiredZ-start.z)*positionBlend;
  const desiredYaw=Math.atan2(targetX-x,targetZ-z),yawDelta=wrapAngle(desiredYaw-presentationFinite(start.yaw));
  const yaw=wrapAngle(presentationFinite(start.yaw)+yawDelta*(1-Math.exp(-step*(attack?20:13))));
  const speed=Math.hypot(x-start.x,z-start.z)/step;
  return Object.freeze({x,z,yaw,stride:presentationClamp(speed*.22,0,1),attackPulse,lunge,recoil});
}

const REVIEW_SWEEPS=new Set(['slash','back','heavy','spin','sweep','diagonal','crosscut','round','hook','bodyblow','barrage','rushfist','uppercut','risingfist','meteor','bullrush']);
const REVIEW_STOP_ON_FIRST=new Set(['thrust','pierce','dash','jab','straight','oneinch','katanaThrust']);
export function reviewBattleMultiHitFrame(actor,{encounterMode='duel'}={}){
  const attack=String(actor?.attack||''),progress=presentationClamp(presentationFinite(actor?.progress),0,1),phase=normalizeReviewBattlePhase(actor?.slot);
  const active=encounterMode==='one-v-three'&&REVIEW_SWEEPS.has(attack)&&!REVIEW_STOP_ON_FIRST.has(attack)&&progress>=.3&&progress<=.72;
  const full=attack==='spin'||attack==='round'||attack==='barrage';
  return Object.freeze({active,attack,phase,progress,count:active?3:1,recoil:active?(phase==='kyu'?.42:phase==='ha'?.3:.24):0,spread:full?1:.72});
}

export function reviewBattleCameraFrame(core,{follow=true,system='rinne',encounterMode='duel'}={}){
  if(!follow)return FIXED_CAMERA;
  const hero=core?.hero,enemy=core?.enemy;
  if(!hero||!enemy)return FIXED_CAMERA;
  const values=[hero.x,hero.z,enemy.x,enemy.z].map(Number);
  if(values.some(value=>!Number.isFinite(value)))return FIXED_CAMERA;
  const player={x:values[0]*1.35,z:values[1]*1.15};
  const primary={id:'enemy',x:values[2]*1.35,z:values[3]*1.15,dead:Boolean(enemy.dead)};
  const threats=[primary];
  if(encounterMode==='melee'||encounterMode==='one-v-three'){
    threats.push(
      {id:'enemy-flank-a',x:primary.x-2.2,z:primary.z+1.65,dead:false},
      {id:'enemy-flank-b',x:primary.x+2.35,z:primary.z-1.55,dead:false}
    );
  }
  const style=system==='demon'?'demon':'rinne';
  const frame=combatCameraFrame({player,threats,style,wide:false});
  if(!frame)return FIXED_CAMERA;
  const position=combatCameraPosition(frame);
  return Object.freeze({
    position:Object.freeze(position),
    look:Object.freeze({...frame.look}),
    separation:frame.spread,
    follow:true,
    system:style,
    count:frame.count
  });
}
