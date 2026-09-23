import {WEAPONS} from './equipment.js';

const freeze=Object.freeze;
export const COMBAT_LOCOMOTION=freeze({
  walkSpeed:3.8,
  dashMultiplier:1.72,
  dashSpeed:6.536,
  actionMoveScale:.65,
  footworkScale:Object.freeze({stay:0,forward:.75,chase:1,rush:1.22,retreat:.82,sideL:.72,sideR:.72,orbitL:.6,orbitR:.6,cross:.78,spiral:.78}),
  engagementPadding:.65,
  readyExitPadding:.55,
  gaitPhasePerMeter:3.8
});

export function combatReachPolicy({weapon='sword'}={}){
  const normalized=weapon==='katana'?'sword':weapon,spec=WEAPONS[normalized]||WEAPONS.fist;
  const weaponReach=spec.reach,engagementRange=weaponReach+COMBAT_LOCOMOTION.engagementPadding,readyExitRange=engagementRange+COMBAT_LOCOMOTION.readyExitPadding;
  return freeze({weapon:normalized,weaponReach,engagementRange,readyExitRange});
}

/**
 * One shared combat-ready boundary for all consumers.
 * Enter at canonical engagement range, leave only after the shared exit padding.
 * The hysteresis keeps stance/draw state stable on the edge.
 */
export function combatReadyEnvelope({distance,weapon='sword',wasReady=false,forced=false}={}){
  const policy=combatReachPolicy({weapon}),finite=Number.isFinite(Number(distance))&&Number(distance)>=0,d=finite?Number(distance):Infinity;
  const ready=Boolean(forced||(finite&&d<=(wasReady?policy.readyExitRange:policy.engagementRange)));
  return freeze({...policy,ready,distance:d,enterRange:policy.engagementRange,exitRange:policy.readyExitRange});
}
