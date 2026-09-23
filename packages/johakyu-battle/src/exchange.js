import {WEAPONS} from '@soul/johakyu-combat/execution-capability';
import {normalizeCombatStrategy} from '@soul/game-data/combat-strategy';
import {clamp} from './choreography.js';
export {createJohakyuExchangeState,reduceJohakyuExchange,johakyuExchangeSnapshot,johakyuExchangeCue} from '@soul/johakyu-combat/exchange-policy';
function strategy(actor){const mind={...normalizeCombatStrategy(actor.mind||'balanced')};if(actor.stance==='ryu')mind.mobility+=.2;if(actor.stance==='chinshin')mind.guard+=.2;if(actor.stance==='kosei')mind.attack+=.2;return normalizeCombatStrategy(mind);}
export function battleSpacing(actor,target,distance){
  const weaponReach=(WEAPONS[actor.equipment.weapon]||WEAPONS.fist).reach,engagementRange=weaponReach+.65;
  const mind=strategy(actor),stance=actor.stance;
  const preferredSpacing=Math.max(1.52,weaponReach+.12+mind.spacing*.18-(stance==='kosei'?.12:0));
  return {distance,weaponReach,engagementRange,preferredSpacing,band:distance>engagementRange+.8?'far':distance>engagementRange?'reading':distance>preferredSpacing?'one-step':distance>1.46?'attack':'contact'};
}
/** Non-attacking time has an intent; the result is held for a decision interval. */
export function chooseExchangeIntent({actor,target,exchange,phase='jo',distance,threat=null,counter=false,readSeconds=0,serial=0}){
  const spacing=battleSpacing(actor,target,distance),mind=strategy(actor);
  const own=exchange.initiativeId===actor.id,responding=exchange.initiativeId&& !own;
  const result=(intent,footwork='stay',stopDistance=null)=>({...spacing,intent,footwork,stopDistance,pressure:exchange.pressureCount||0,initiative:exchange.initiativeId,responder:exchange.responderId});
  if(actor.stamina<14||actor.posture>82)return result('disengage','retreat',spacing.engagementRange+.55);
  if(counter&&distance<=spacing.engagementRange+.25)return result('intercept','chase',spacing.preferredSpacing-.1);
  if(threat && distance<=spacing.engagementRange+.3){
    if(phase==='ha'&&mind.attack>mind.guard+.45&&threat.elapsed/threat.duration<.12)return result('commit');
    if(mind.counter>=mind.guard+.05)return result('intercept');
    if(mind.guard>=.2||responding)return result('guard-pressure');
  }
  if(distance>spacing.engagementRange+.55)return result('approach','chase',spacing.engagementRange+.25);
  if(distance<spacing.preferredSpacing-.22 && phase!=='kyu' && readSeconds<.35)return result('retreat','retreat',spacing.preferredSpacing+.15);
  if(responding&&exchange.mode==='pressure')return result(mind.mobility>.35?'orbit':'bait',mind.mobility>.35?(serial%2?'orbitL':'orbitR'):'stay');
  const observe=phase==='jo'?.18+mind.spacing*.25:phase==='ha'?.08:.025;
  if(readSeconds<observe)return result(mind.counter>.35?'bait':'orbit',mind.counter>.35?'stay':serial%2?'orbitL':'orbitR');
  if(distance>spacing.preferredSpacing+.1)return result(phase==='ha'?'pressure':'approach',phase==='kyu'?'chase':'forward',spacing.preferredSpacing);
  return result('commit');
}
export function footworkVelocity(footwork,from,to,speed=1){
  const d=Math.max(.001,Math.hypot(to.x-from.x,to.z-from.z)),x=(to.x-from.x)/d,z=(to.z-from.z)/d;
  const vectors={stay:[0,0],retreat:[-x,-z],sideL:[-z,x],sideR:[z,-x],orbitL:[-z,x],orbitR:[z,-x],cross:[x*.7-z*.7,z*.7+x*.7],spiral:[x*.5+z*.86,z*.5-x*.86]};
  const v=vectors[footwork]||[x,z];return{x:v[0]*speed,z:v[1]*speed};
}
export function moveWithResistance(actor,dt,{bounds,blocked=()=>false}={}){
  const v=actor.impulseVelocity,drag=8+clamp(actor.stability)*5,factor=Math.exp(-drag*dt);
  // Integrating velocity separately from intent prevents an AI retreat masquerading as force.
  const displacement={x:v.x*(1-factor)/drag,z:v.z*(1-factor)/drag};v.x*=factor;v.z*=factor;
  const next={x:clamp(actor.position.x+displacement.x,bounds.minX,bounds.maxX),z:clamp(actor.position.z+displacement.z,bounds.minZ,bounds.maxZ)};
  if(!blocked(actor.position,next,actor))actor.position=next;
}
