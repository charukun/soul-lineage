import {WEAPONS} from './equipment.js';

const freeze=Object.freeze;
export const COMBAT_LOCOMOTION=freeze({
  walkSpeed:3.8,
  dashMultiplier:1.72,
  dashSpeed:6.536,
  actionMoveScale:.65,
  readyExitPadding:.55
});

/**
 * One shared combat-ready boundary for all consumers.
 * Enter at canonical weapon reach + .65m, leave only after another .55m.
 * The hysteresis keeps stance/draw state stable on the edge.
 */
export function combatReadyEnvelope({distance,weapon='sword',wasReady=false,forced=false}={}){
  const normalized=weapon==='katana'?'sword':weapon,spec=WEAPONS[normalized]||WEAPONS.fist;
  const weaponReach=spec.reach,enterRange=weaponReach+.65,exitRange=enterRange+COMBAT_LOCOMOTION.readyExitPadding;
  const finite=Number.isFinite(Number(distance))&&Number(distance)>=0,d=finite?Number(distance):Infinity;
  const ready=Boolean(forced||(finite&&d<=(wasReady?exitRange:enterRange)));
  return freeze({ready,distance:d,weaponReach,enterRange,exitRange});
}
