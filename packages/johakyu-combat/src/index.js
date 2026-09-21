import {BASIC_FORMS,ACTION_FORMS,adaptKind} from '@soul/game-data/combat-forms';
import {normalizeCombatStrategy,COMBAT_STRATEGY_PRESETS} from '@soul/game-data/combat-strategy';

export {COMBAT_STRATEGY_PRESETS};
export const JOHAKYU_PHASES=Object.freeze(['jo','ha','kyu']);
// These are the original NOCTURNE motor timings, not new RINNE damage rules.
export const NATIVE_MOTOR=Object.freeze({heroDuration:.88,enemyDuration:1.22,impactFraction:.43,blendIn:.12,blendOut:.13});
const freeze=Object.freeze;
const supported=freeze({
  slash:{clip:'1H_Melee_Attack_Slice_Diagonal',offense:true},
  back:{clip:'1H_Melee_Attack_Slice_Horizontal',offense:true},
  thrust:{clip:'1H_Melee_Attack_Stab',offense:true},
  pierce:{clip:'1H_Melee_Attack_Stab',offense:true},
  heavy:{clip:'1H_Melee_Attack_Chop',offense:true},
  diagonal:{clip:'1H_Melee_Attack_Slice_Diagonal',offense:true},
  sweep:{clip:'1H_Melee_Attack_Slice_Horizontal',offense:true},
  guard:{clip:'Blocking',offense:false},brace:{clip:'Block',offense:false},
  parry:{clip:'Block_Hit',offense:false},counter:{clip:'1H_Melee_Attack_Stab',offense:true},
  bash:{clip:'Block_Attack',offense:true},ready:{clip:'Idle',offense:false},
  retreat:{clip:'Walking_Backwards',offense:false},slip:{clip:'Dodge_Left',offense:false},
});
export const JOHAKYU_CLIPS=freeze(Object.fromEntries(Object.entries(supported).map(([key,value])=>[key,freeze({...value})])));

/** Canonical forms are shared with the old game, never inferred from a clip name. */
export function compileJohakyuSequence({weapon='sword',loadout={}}={}){
  if(weapon!=='sword')throw new RangeError('Weapon motion binding not accepted yet: '+weapon);
  return freeze(JOHAKYU_PHASES.map(phase=>{
    const techniqueId=loadout[phase]??`basic.${weapon}`;
    if(typeof techniqueId!=='string')throw new TypeError('Expected a catalog technique ID');
    const form=techniqueId===`basic.${weapon}`?BASIC_FORMS[weapon]:ACTION_FORMS[techniqueId];
    if(!form)throw new RangeError('Unregistered combat form: '+techniqueId);
    const steps=form.kinds.map((raw,index)=>{
      const kind=adaptKind(raw,weapon),binding=JOHAKYU_CLIPS[kind],charge=form.charges?.[index]??'none';
      if(!binding||charge!=='none')throw new RangeError('Motion binding not accepted yet: '+kind+'/'+charge);
      return freeze({kind,clip:binding.clip,offense:binding.offense,footwork:form.feet[index]??'forward',charge});
    });
    return freeze({phase,techniqueId,steps:freeze(steps)});
  }));
}

export function createJohakyuCursor({actorId,sequence=compileJohakyuSequence()}={}){
  if(typeof actorId!=='string'||!actorId)throw new TypeError('Actor identity is required');
  let phaseIndex=0,stepIndex=0,serial=0,active=null,cycles=0;
  return freeze({
    begin(){
      if(active)return active;
      const recipe=sequence[phaseIndex],step=recipe.steps[stepIndex];
      active=freeze({...step,id:`${actorId}:attack:${++serial}`,actorId,phase:recipe.phase,
        techniqueId:recipe.techniqueId,stepIndex,cycle:cycles});
      return active;
    },
    complete(id){
      if(!active||active.id!==id)return false;
      active=null;stepIndex++;
      if(stepIndex===sequence[phaseIndex].steps.length){stepIndex=0;phaseIndex++;
        if(phaseIndex===sequence.length){phaseIndex=0;cycles++;}}
      return true;
    },
    cancel(id){if(!active||active.id!==id)return false;active=null;return true;},
    snapshot(){return freeze({phase:active?.phase??null,queuedPhase:sequence[phaseIndex].phase,stepIndex,cycles,active});}
  });
}

/** Six-axis attention selects real motor intents. It never rolls random numbers. */
export function johakyuIntent({mind='balanced',distance,threat=false,threatProgress=1,counterReady=false,idleSeconds=0}={}){
  const vector=normalizeCombatStrategy(mind);
  if(!Number.isFinite(distance)||distance<0)throw new TypeError('Invalid contact distance');
  if(counterReady&&distance<=2.35)return freeze({mode:'counter',vector});
  if(threat&&distance<=2.35&&threatProgress<NATIVE_MOTOR.impactFraction){
    if(vector.counter>=.8)return freeze({mode:'parry',vector});
    if(vector.guard>=.6)return freeze({mode:'guard',vector});
    if(vector.mobility>=.8)return freeze({mode:'space',vector});
  }
  if(distance>1.85)return freeze({mode:'approach',vector});
  if(vector.spacing>=.7&&vector.attack<.5&&idleSeconds<.44&&!threat)return freeze({mode:'wait',vector});
  return freeze({mode:'attack',vector});
}
