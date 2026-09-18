const PHASES=Object.freeze(['jo','ha','kyu']);
const PHASE_SET=new Set(PHASES);
const FIXED_CAMERA=Object.freeze({
  position:Object.freeze({x:0,y:4.7,z:7.5}),
  look:Object.freeze({x:0,y:.95,z:0}),
  separation:0,
  follow:false
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

export function reviewBattleCameraFrame(core,{follow=true}={}){
  if(!follow)return FIXED_CAMERA;
  const hero=core?.hero,enemy=core?.enemy;
  if(!hero||!enemy)return FIXED_CAMERA;
  const values=[hero.x,hero.z,enemy.x,enemy.z].map(Number);
  if(values.some(value=>!Number.isFinite(value)))return FIXED_CAMERA;
  const [heroX,heroZ,enemyX,enemyZ]=values;
  const hx=heroX*1.35,hz=heroZ*1.15,ex=enemyX*1.35,ez=enemyZ*1.15;
  const centerX=(hx+ex)/2,centerZ=(hz+ez)/2;
  const separation=Math.hypot(hx-ex,hz-ez);
  const extra=Math.min(3.4,Math.max(0,separation-2.1)*.52);
  return Object.freeze({
    position:Object.freeze({x:centerX,y:4.7+extra*.22,z:centerZ+7.5+extra}),
    look:Object.freeze({x:centerX,y:.95,z:centerZ}),
    separation,
    follow:true
  });
}
