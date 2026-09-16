import {
  LIFESPAN_MS,
  MASTER_ID,
  SHINO_MASTER,
  SHINO_REFERENCE_V2_RUNTIME,
  YEAR_MS,
  appearanceForCharacter,
  createCharacter,
  resolveCharacterPresentations
} from '@soul/characters';

export const RINNE_RUNTIME_CHARACTER_FAMILY = SHINO_MASTER;
export const RINNE_RUNTIME_CHARACTER_ASSET = SHINO_REFERENCE_V2_RUNTIME;

const ROLE_SEQUENCE=Object.freeze(['guard','knight','hunter']);
// Historical outfit ids stay authoritative for save/identity compatibility and now
// also drive tint variation on the shared Shino DCC surface.
const IDENTITY_OUTFIT_BY_KIND=Object.freeze({hero:'shino.uniform.original.v1',mother:'shino.uniform.moss.v1',enemy:'shino.uniform.ember.v1'});
const cleanId=value=>String(value||'actor').replace(/[^a-zA-Z0-9._:-]/g,'-').slice(0,80)||'actor';
const mixSeed=(seed,text)=>{
  let value=(Number(seed)||0)>>>0;
  for(const char of String(text)){value^=char.codePointAt(0);value=Math.imul(value,0x45d9f3b)>>>0;value^=value>>>16;}
  return value>>>0;
};

export function rinneRuntimeAgeMs(ageSeconds){
  const ms=Math.max(0,Math.round((Number(ageSeconds)||0)*1000));
  return Math.min(ms,LIFESPAN_MS-1);
}

export function createRinneRuntimeCharacter({kind,id,seed,ageSeconds,role=null}={}){
  if(!Object.hasOwn(IDENTITY_OUTFIT_BY_KIND,kind))throw Error(`Unknown Rinne runtime character kind: ${kind}`);
  const actorId=`rinne.${kind}.${cleanId(id)}`,character=createCharacter({
    id:actorId,
    seed:mixSeed(seed,actorId),
    ageMs:rinneRuntimeAgeMs(ageSeconds),
    outfitId:IDENTITY_OUTFIT_BY_KIND[kind]
  });
  return Object.freeze({
    kind,
    role:role||({hero:'traveler',mother:'villager',enemy:'guard'}[kind]),
    familyId:MASTER_ID,
    modelId:SHINO_REFERENCE_V2_RUNTIME.modelId,
    character,
    asset:SHINO_REFERENCE_V2_RUNTIME
  });
}

export function createRinneHeroCharacter(state){
  return createRinneRuntimeCharacter({kind:'hero',id:state?.id||'player',seed:state?.seed||1,ageSeconds:state?.ageSeconds||0,role:'traveler'});
}

export function createRinneMotherCharacter(state){
  return createRinneRuntimeCharacter({kind:'mother',id:`${state?.birthVillageId||'village'}-mother`,seed:mixSeed(state?.seed||1,'mother'),ageSeconds:30*YEAR_MS/1000,role:'villager'});
}

export function createRinneEnemyCharacter(enemy,{lifeSeed=1,stage=0,index=0}={}){
  const role=ROLE_SEQUENCE[(Math.max(0,stage)+Math.max(0,index))%ROLE_SEQUENCE.length];
  const ageYears=20+(mixSeed(lifeSeed,enemy?.id||index)%36);
  return createRinneRuntimeCharacter({kind:'enemy',id:enemy?.id||`enemy-${index}`,seed:mixSeed(lifeSeed,enemy?.id||index),ageSeconds:ageYears*YEAR_MS/1000,role});
}

export function resolveRinneRuntimeRoster(actors,{lod={maxFull:6,nearDistance:8,farDistance:20}}={}){
  const inputs=actors.map(actor=>({
    character:actor.character,
    role:actor.role,
    distance:Math.max(0,Number(actor.distance)||0),
    visible:actor.visible!==false,
    important:actor.important===true,
    assetCandidates:[]
  }));
  const presentations=resolveCharacterPresentations(inputs,{app:'rinne',lod,assetCandidates:[]});
  return Object.freeze(presentations.map((presentation,index)=>Object.freeze({
    ...presentation,
    characterFamily:actors[index].familyId||MASTER_ID,
    runtimeAsset:actors[index].asset||RINNE_RUNTIME_CHARACTER_ASSET,
    appearance:appearanceForCharacter(actors[index].character)
  })));
}

export function resolveRinneRuntimeCharacter(actor,options={}){
  return resolveRinneRuntimeRoster([actor],options)[0];
}