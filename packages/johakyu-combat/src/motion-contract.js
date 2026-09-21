import {BASIC_FORMS,ACTION_FORMS,adaptKind} from '@soul/game-data/combat-forms';

const freeze=Object.freeze;
const oneHand=freeze({slash:'1H_Melee_Attack_Slice_Diagonal',back:'1H_Melee_Attack_Slice_Horizontal',thrust:'1H_Melee_Attack_Stab',pierce:'1H_Melee_Attack_Stab',heavy:'1H_Melee_Attack_Chop',diagonal:'1H_Melee_Attack_Slice_Diagonal',sweep:'1H_Melee_Attack_Slice_Horizontal',counter:'1H_Melee_Attack_Stab'});
const twoHand=freeze({slash:'2H_Melee_Attack_Slice',back:'2H_Melee_Attack_Slice',thrust:'2H_Melee_Attack_Stab',pierce:'2H_Melee_Attack_Stab',heavy:'2H_Melee_Attack_Chop',diagonal:'2H_Melee_Attack_Slice',sweep:'2H_Melee_Attack_Slice',counter:'2H_Melee_Attack_Stab'});
const unarmed=freeze({jab:'Unarmed_Melee_Attack_Punch_A',straight:'Unarmed_Melee_Attack_Punch_A',hook:'Unarmed_Melee_Attack_Punch_B',bodyblow:'Unarmed_Melee_Attack_Punch_B',counter:'Unarmed_Melee_Attack_Punch_A'});
const defense=freeze({guard:'Blocking',brace:'Block',parry:'Block_Hit',ready:'Idle',retreat:'Walking_Backwards',slip:'Dodge_Left'});
const locomotion=freeze({retreat:'Walking_Backwards',sideL:'Running_Strafe_Left',sideR:'Running_Strafe_Right',orbitL:'Running_Strafe_Left',orbitR:'Running_Strafe_Right'});
export const JOHAKYU_WEAPON_MOTIONS=freeze({fist:unarmed,sword:oneHand,dagger:oneHand,great:twoHand,spear:twoHand,axe:twoHand,staff:twoHand});
// These are authored mesh families, not an authorization to replace missing
// equipment with a procedural proxy or to show a sword for another weapon.
export const JOHAKYU_WEAPON_ART=freeze({fist:'unarmed',sword:'1H_Sword',dagger:'1H_Dagger',great:'2H_Sword',spear:'2H_Spear',axe:'2H_Axe',staff:'2H_Staff'});
const PHASES=new Set(['jo','ha','kyu','uke','one','finisher','enemy']);
const CHARGES=new Set(['none','breath','deep','focus']);

export function resolveJohakyuLocomotion({footwork='stay',availableClips=null}={}){
  const clip=locomotion[footwork];
  if(!clip)return freeze({supported:false,reason:'unbound-footwork',footwork});
  if(availableClips&&!new Set(availableClips).has(clip))return freeze({supported:false,reason:'missing-authored-clip',footwork,clip});
  return freeze({supported:true,footwork,clip,clock:'canonical-footwork'});
}

export function resolveJohakyuMotion({weapon,kind,charge='none',phase='jo',availableClips=null}={}){
  if(!Object.hasOwn(JOHAKYU_WEAPON_MOTIONS,weapon))return freeze({supported:false,reason:'weapon',weapon,kind});
  if(!PHASES.has(phase)||!CHARGES.has(charge))return freeze({supported:false,reason:'phase-or-charge',weapon,kind});
  const clip=defense[kind]??(kind==='bash'||kind==='pommel'?'Block_Attack':JOHAKYU_WEAPON_MOTIONS[weapon][kind]);
  if(!clip)return freeze({supported:false,reason:'unbound-action',weapon,kind});
  if(availableClips&&!new Set(availableClips).has(clip))return freeze({supported:false,reason:'missing-authored-clip',weapon,kind,clip});
  return freeze({supported:true,weapon,kind,clip,phase,charge,offense:!Object.hasOwn(defense,kind),
    equipment:JOHAKYU_WEAPON_ART[weapon],clock:'canonical-attack-progress',blendIn:.12,blendOut:.13});
}

/** Review trials are explicitly not learned skills and cannot mutate a life. */
export function compileJohakyuCatalogTrial({weapon='sword',loadout={}}={}){
  if(!BASIC_FORMS[weapon])throw new RangeError('Unregistered weapon');
  return freeze(['jo','ha','kyu'].map(phase=>{
    const techniqueId=loadout[phase]??`basic.${weapon}`;
    const form=techniqueId===`basic.${weapon}`?BASIC_FORMS[weapon]:ACTION_FORMS[techniqueId];
    if(!form)throw new RangeError('Unregistered trial technique: '+techniqueId);
    const steps=form.kinds.map((raw,index)=>{
      const kind=adaptKind(raw,weapon),charge=form.charges?.[index]??'none';
      const binding=resolveJohakyuMotion({weapon,kind,charge,phase});
      if(!binding.supported)throw new RangeError('Unaccepted trial motion: '+weapon+'/'+kind);
      return freeze({...binding,footwork:form.feet[index]??'forward',scope:'review-trial'});
    });
    return freeze({phase,techniqueId,scope:'review-trial',steps:freeze(steps)});
  }));
}
