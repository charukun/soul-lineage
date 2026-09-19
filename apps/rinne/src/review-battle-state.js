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

export function reviewBattleCameraFrame(core,{follow=true,system='rinne',encounterMode='duel'}={}){
  if(!follow)return FIXED_CAMERA;
  const hero=core?.hero,enemy=core?.enemy;
  if(!hero||!enemy)return FIXED_CAMERA;
  const values=[hero.x,hero.z,enemy.x,enemy.z].map(Number);
  if(values.some(value=>!Number.isFinite(value)))return FIXED_CAMERA;
  const player={x:values[0]*1.35,z:values[1]*1.15};
  const primary={id:'enemy',x:values[2]*1.35,z:values[3]*1.15,dead:Boolean(enemy.dead)};
  const threats=[primary];
  if(encounterMode==='melee'){
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
