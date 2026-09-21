import { bodyRuntime, ensureCombatLoadout } from '../combat-loadout.js';
import { injuryEffects } from './combat-growth.js';
import {combatBodyOutcome,strategyForState} from './combat-choreography.js';

const clamp=(n,lo=0,hi=1)=>Math.min(hi,Math.max(lo,n));
const TAU=Math.PI*2;
const wrap=value=>{let v=Number(value)||0;while(v>Math.PI)v-=TAU;while(v<-Math.PI)v+=TAU;return v;};
const angleTo=(a,b)=>Math.atan2(b.x-a.x,b.z-a.z);

export function activeHeartIds(state){
  ensureCombatLoadout(state);return new Set(state.combatLoadout?.heart?.active||[]);
}

export function staminaPolicyFor(state){
  const cap=Math.max(1,Number(state?.staminaCap)||100),ratio=clamp((Number(state?.stamina)||0)/cap);
  if(ratio<.14)return{band:'critical',ratio,allowOffense:false,allowFinisher:false,tempoScale:.72,recoveryBias:1,guardBias:.36};
  if(ratio<.32)return{band:'low',ratio,allowOffense:true,allowFinisher:false,tempoScale:.86,recoveryBias:.65,guardBias:.2};
  if(ratio<.62)return{band:'steady',ratio,allowOffense:true,allowFinisher:true,tempoScale:.96,recoveryBias:.25,guardBias:.08};
  return{band:'fresh',ratio,allowOffense:true,allowFinisher:true,tempoScale:1.05,recoveryBias:0,guardBias:0};
}

export function tidebreakMindVectorFor(state){
  ensureCombatLoadout(state);const body=bodyRuntime(state),heart=activeHeartIds(state),stamina=staminaPolicyFor(state),injury=injuryEffects(state),bodyOutcome=combatBodyOutcome(state),strategy=strategyForState(state);
  const baseline={attack:.5,guard:.46,spacing:.5,counter:.28,mobility:.42,survival:.28},v={};for(const key of Object.keys(baseline))v[key]=baseline[key]*.42+strategy[key]*.58;
  const add=(key,value)=>{v[key]=clamp(v[key]+value);};
  const style=body.style?.id,stance=body.stance?.id,zanshin=body.zanshin?.id;
  if(style==='pressure'){add('attack',.28);add('spacing',-.22);add('guard',-.1);}if(style==='distance'){add('spacing',.3);add('guard',.08);add('attack',-.06);}if(style==='counter'){add('counter',.42);add('guard',.2);add('attack',-.1);}if(style==='flow'){add('mobility',.36);add('counter',.12);}if(stance==='kosei')add('attack',.16);if(stance==='chinshin'){add('guard',.19);add('mobility',-.08);}if(stance==='ryu')add('mobility',.18);
  if(zanshin==='guard')add('guard',.14);if(zanshin==='pursuit')add('attack',.1);if(zanshin==='breath')add('survival',.1);
  if(heart.has('skill.resolve'))add('attack',.13);if(heart.has('skill.edge')||heart.has('skill.grip'))add('attack',.09);if(heart.has('skill.distance'))add('spacing',.16);if(heart.has('skill.read'))add('counter',.2);if(heart.has('skill.patience')){add('counter',.13);add('attack',-.06);}if(heart.has('skill.danger')){add('guard',.1);add('survival',.12);}if(heart.has('skill.peripheral')){add('guard',.08);add('mobility',.12);}if(heart.has('skill.flow-step')||heart.has('skill.soft-step'))add('mobility',.18);if(heart.has('skill.guard-sense'))add('guard',.16);if(heart.has('skill.endure')||heart.has('skill.balance'))add('survival',.12);
  add('survival',bodyOutcome.severity*.42);add('attack',-bodyOutcome.severity*.16);add('guard',stamina.guardBias);add('survival',stamina.recoveryBias*.24);add('attack',stamina.allowOffense?0:-.38);
  // Head/torso injuries do not grant protection. They blur specialized decisions toward neutral values, making poor positioning harder to recover from.
  for(const key of Object.keys(v))v[key]=clamp(.5+(v[key]-.5)*injury.judgmentScale);if(injury.judgmentScale<.72)add('survival',(1-injury.judgmentScale)*.16);
  return Object.freeze(v);
}

const MIND_PROFILES=Object.freeze({
  balanced:{attack:.55,guard:.5,spacing:.5,counter:.35,mobility:.45,survival:.35},
  assault:{attack:.9,guard:.24,spacing:.28,counter:.25,mobility:.55,survival:.2},
  defensive:{attack:.3,guard:.88,spacing:.72,counter:.4,mobility:.32,survival:.62},
  patient:{attack:.28,guard:.65,spacing:.68,counter:.82,mobility:.34,survival:.5},
  counter:{attack:.38,guard:.74,spacing:.54,counter:.95,mobility:.5,survival:.46},
  elusive:{attack:.36,guard:.42,spacing:.7,counter:.5,mobility:.95,survival:.5},
  steadfast:{attack:.46,guard:.88,spacing:.38,counter:.38,mobility:.2,survival:.78},
  survival:{attack:.24,guard:.84,spacing:.82,counter:.35,mobility:.62,survival:1}
});
export function tidebreakMindsetFromVector(vector){
  let best='balanced',score=Infinity;for(const [id,p]of Object.entries(MIND_PROFILES)){let d=0;for(const key of Object.keys(p))d+=(Number(vector?.[key]??.5)-p[key])**2;if(d<score){score=d;best=id;}}return best;
}

export function directionSector(state,target){
  const delta=Math.abs(wrap(angleTo(state.position,target)-(Number(state.yaw)||0)));if(delta<=Math.PI*.28)return'front';if(delta<=Math.PI*.62)return'flank';return'back';
}

export function directionalDefenseFor(state,target){
  const sector=directionSector(state,target),heart=activeHeartIds(state),mind=tidebreakMindVectorFor(state);let awareness=sector==='front'?1:sector==='flank'?.48:.14;
  if(heart.has('skill.peripheral'))awareness+=sector==='back'?.5:.32;if(heart.has('skill.danger'))awareness+=sector==='back'?.32:.18;if(heart.has('skill.read'))awareness+=.1;if(heart.has('skill.flow-step')||heart.has('skill.soft-step'))awareness+=sector==='front'?0:.16;
  awareness=clamp(awareness);let damageScale=sector==='front'?1:sector==='flank'?1.18:1.42;damageScale-=awareness*(sector==='front'?.08:sector==='flank'?.24:.34);damageScale=clamp(damageScale,.82,1.48);
  let receive='basic';if(awareness<.28&&sector==='back')receive='none';else if(state.equipment?.shield&&sector==='front')receive='shield';else if(mind.counter>.7&&awareness>.58)receive=sector==='front'?'backcounter':'turncounter';else if(mind.mobility>.7&&awareness>.5)receive='flow';else if(mind.guard>.72)receive='iron';else if(heart.has('skill.fall')||heart.has('skill.balance'))receive='backroll';else if(heart.has('skill.danger')||heart.has('skill.peripheral'))receive='leftroll';
  return{sector,awareness,damageScale,receive};
}

export function resolveBodyIntent(state,living,primaryId){
  const mind=tidebreakMindVectorFor(state),stamina=staminaPolicyFor(state),rows=(living||[]).filter(row=>!row.dead).map(enemy=>{const d=Math.hypot(enemy.x-state.position.x,enemy.z-state.position.z),defense=directionalDefenseFor(state,enemy),committed=(enemy.attackWindow||0)>0,ready=(enemy.cooldown||0)<=.12;let urgency=(committed?2.2:ready?1.05:0)+Math.max(0,2.6-d)*.42+(defense.sector==='back'?.55:defense.sector==='flank'?.25:0);urgency*=.35+.65*defense.awareness;return{enemy,d,defense,urgency,committed};}).sort((a,b)=>b.urgency-a.urgency);
  const urgent=rows[0]||null;if(!stamina.allowOffense)return{mode:'recover',bodyTargetId:urgent?.enemy.id||primaryId,primaryTargetId:primaryId,vector:mind,stamina};
  // An expired enemy cooldown is readiness, not an incoming strike. Readiness can
  // persist indefinitely; treating it as an interrupt starves automatic offense.
  // Keep directional defense for an actual secondary attack's committed window.
  if(urgent&&urgent.committed&&urgent.enemy.id!==primaryId&&urgent.urgency>1.08){const mode=mind.counter>.7?'counter':mind.mobility>.72?'evade':'guard';return{mode,bodyTargetId:urgent.enemy.id,primaryTargetId:primaryId,vector:mind,stamina};}
  return{mode:'attack',bodyTargetId:primaryId||urgent?.enemy.id||null,primaryTargetId:primaryId,vector:mind,stamina};
}

export function noteEnemyThreat(enemy,playerId,damage=0,bonus=0){
  if(!enemy||!playerId)return;enemy.threat=enemy.threat&&typeof enemy.threat==='object'?enemy.threat:{};enemy.threat[playerId]=clamp((Number(enemy.threat[playerId])||0)+Math.max(0,damage)*.16+Math.max(0,bonus),0,80);
}
export function decayEnemyThreat(enemy,dt){
  if(!enemy?.threat||typeof enemy.threat!=='object')return;for(const [id,value]of Object.entries(enemy.threat)){const next=Math.max(0,(Number(value)||0)-dt*.5);if(next<.02)delete enemy.threat[id];else enemy.threat[id]=next;}
}
export function chooseEnemyAttention(enemy,states){
  const candidates=(states||[]).filter(state=>state&&!state.down&&!state.ended);if(!candidates.length)return null;let best=null,bestScore=-Infinity;
  for(const state of candidates){const d=Math.max(.35,Math.hypot(enemy.x-state.position.x,enemy.z-state.position.z)),threat=Number(enemy.threat?.[state.id])||0,lock=state.combat?.targetId===enemy.id?1.4:0,weak=combatBodyOutcome(state).severity*.9,score=threat+lock+weak+2.5/d;if(score>bestScore||(score===bestScore&&String(state.id)<String(best?.id))){bestScore=score;best=state;}}
  return best;
}

export function applySkillComponents(state,skillId,phase,form){
  const heart=activeHeartIds(state),policy=staminaPolicyFor(state),result={kinds:[...(form.kinds||[])],feet:[...(form.feet||[])],charges:[...(form.charges||[])],rhythm:form.rhythm||'flow',tempo:(form.tempo||1)*policy.tempoScale};
  while(result.feet.length<result.kinds.length)result.feet.push('forward');while(result.charges.length<result.kinds.length)result.charges.push('none');
  if(heart.has('skill.flow-step'))result.feet[1]=phase==='kyu'?'cross':'orbitL';if(heart.has('skill.soft-step'))result.feet[0]=result.feet[0]==='stay'?'sideL':result.feet[0];if(heart.has('skill.distance')&&['sword','spear','staff'].includes(state.equipment?.weapon))result.feet[result.feet.length-1]='chase';if(heart.has('skill.step'))result.feet[0]=result.feet[0]==='stay'?'forward':'rush';
  if(heart.has('skill.rhythm'))result.rhythm='elastic';if(heart.has('skill.tempo')){result.rhythm='sharp';result.tempo*=1.05;}if(heart.has('skill.breath')&&phase==='kyu'&&policy.allowFinisher)result.charges[0]=result.charges[0]==='none'?'breath':result.charges[0];if(heart.has('skill.focus')&&phase==='kyu'&&policy.allowFinisher)result.charges[result.charges.length-1]='focus';if(heart.has('skill.poise')&&phase==='kyu'&&policy.allowFinisher)result.charges[result.charges.length-1]='deep';
  if(!policy.allowFinisher)result.charges=result.charges.map(()=> 'none');
  if(policy.band==='low')result.kinds=result.kinds.map(kind=>['heavy','leap','meteor','bullrush'].includes(kind)?'ready':kind);
  if(policy.band==='critical'){result.kinds=['guard','retreat','ready'];result.feet=['stay','retreat','stay'];result.charges=['none','none','none'];result.rhythm='flow';result.tempo=.72;}
  result.tempo=clamp(result.tempo,.65,1.2);return result;
}
