const PHASES=Object.freeze(['jo','ha','kyu']);
const PHASE_SET=new Set(PHASES);
const clamp=(value,lo,hi)=>Math.min(hi,Math.max(lo,value));
const FIXED_CAMERA=Object.freeze({
  position:Object.freeze({x:0,y:5.2,z:10}),
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

export function reviewBattleCameraFrame(core,{follow=true,encounterMode='duel',rinneFrame=null,demonFrame=null}={}){
  if(!follow)return FIXED_CAMERA;
  const hero=core?.hero,enemy=core?.enemy;if(!hero||!enemy)return FIXED_CAMERA;
  const enemies=[{id:'enemy',x:Number(enemy.x),z:Number(enemy.z),dead:Boolean(enemy.dead)}];
  if(encounterMode==='melee')enemies.push({id:'enemy-flank-a',x:Number(enemy.x)-2.4,z:Number(enemy.z)+1.8,dead:false},{id:'enemy-flank-b',x:Number(enemy.x)+2.6,z:Number(enemy.z)-1.5,dead:false});
  const rinne=typeof rinneFrame==='function'?rinneFrame({player:{x:Number(hero.x),z:Number(hero.z)},enemies,targetId:'enemy',active:true}):null;
  const threats=enemies.map(row=>({id:row.id,x:row.x,z:row.z,dead:row.dead,eaten:false}));
  const demon=typeof demonFrame==='function'?demonFrame({player:{x:Number(hero.x),z:Number(hero.z)},fight:{npc:threats[0]},combatants:threats.slice(1).map(npc=>({npc}))},{wide:false}):null;
  if(rinne&&demon){
    const look={x:(rinne.look.x+demon.look.x)/2,y:(rinne.look.y+demon.look.y)/2,z:(rinne.look.z+demon.look.z)/2};
    const rinneCamera={x:rinne.look.x+rinne.offset.x,y:rinne.look.y+rinne.offset.y,z:rinne.look.z+rinne.offset.z};
    return Object.freeze({position:Object.freeze({x:(rinneCamera.x+demon.camera.x)/2,y:(rinneCamera.y+demon.camera.y)/2,z:(rinneCamera.z+demon.camera.z)/2}),look:Object.freeze(look),separation:Math.max(rinne.spread,demon.spread),follow:true,shared:true,count:Math.max(rinne.count,demon.count)});
  }
  const values=[hero.x,hero.z,enemy.x,enemy.z].map(Number);if(values.some(value=>!Number.isFinite(value)))return FIXED_CAMERA;
  const [heroX,heroZ,enemyX,enemyZ]=values,hx=heroX*1.35,hz=heroZ*1.15,ex=enemyX*1.35,ez=enemyZ*1.15,separation=Math.hypot(hx-ex,hz-ez),focusX=(hx+ex)/2,focusZ=(hz+ez)/2,extra=Math.min(4.2,Math.max(0,separation-2)*.62);
  return Object.freeze({position:Object.freeze({x:focusX,y:5.2+extra*.18,z:focusZ+10+extra}),look:Object.freeze({x:focusX,y:.95,z:focusZ}),separation,follow:true,shared:false,count:1});
}
