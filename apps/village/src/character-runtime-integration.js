import {THREE as T} from '@soul/rendering';
import {createShinoProductionPool as createCharacterProductionPool} from '@soul/rendering/master-character-production';
import {loadKaykitRuntimeModel} from '@soul/rendering/kaykit-runtime-model';
import {KAYKIT_MODEL_BY_KEY,YEAR_MS,appearanceForCharacter,createCharacter} from '@soul/characters';
import {VILLAGE_CHARACTER_RUNTIME,resolveVillageCharacterRuntime} from './character-runtime-adapter.js';

const village=typeof window==='undefined'?null:window.village;
const view=village?.view;
const MODELS=Object.freeze([KAYKIT_MODEL_BY_KEY.rogue,KAYKIT_MODEL_BY_KEY.knight]);
const POOL_SHARDS=3,POOL_CAPACITY=30;
const AXIS_X=new T.Vector3(1,0,0),AXIS_Y=new T.Vector3(0,1,0),AXIS_Z=new T.Vector3(0,0,1),Q=new T.Quaternion();
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const clean=value=>String(value||'resident').replace(/[^a-zA-Z0-9._:-]/g,'-').slice(0,72)||'resident';
function hash(value){let h=2166136261;for(const c of String(value)){h^=c.codePointAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function fileFor(model){return model.source.path.split('/').at(-1);}
function modelFor(person){return MODELS[hash(person?.id||'resident')%MODELS.length];}
function human(person,monster){return !monster&&!person?.species;}
function characterFor(person){
  const seed=hash(`${person?.id||'resident'}:${person?.seed||0}`),age=Number.isFinite(person?.ageYears)?clamp(person.ageYears,0,89):18+(hash(`age:${person?.id}`)%58);
  return createCharacter({id:`village.${clean(person?.id)}`,seed,ageMs:Math.round(age*YEAR_MS),outfitId:person?.role==='guard'?'shino.uniform.ember.v1':'shino.uniform.moss.v1'});
}
function hideProcedural(node,hidden){
  if(node?.userData?.body)node.userData.body.visible=!hidden;
  for(const leg of node?.userData?.legs||[])leg.visible=!hidden;
}
function pose(bones,time,person){
  bones.leftUpperArm.quaternion.multiply(Q.setFromAxisAngle(AXIS_Z,-1.18));
  bones.rightUpperArm.quaternion.multiply(Q.setFromAxisAngle(AXIS_Z,1.18));
  const moving=Boolean(person?.moving),phase=time*7.5+(Number(person?.seed)||0),stride=moving?Math.sin(phase)*.48:0;
  bones.leftUpperLeg.quaternion.multiply(Q.setFromAxisAngle(AXIS_X,stride));
  bones.rightUpperLeg.quaternion.multiply(Q.setFromAxisAngle(AXIS_X,-stride));
  bones.leftLowerLeg.quaternion.multiply(Q.setFromAxisAngle(AXIS_X,Math.max(0,-stride)*1.1));
  bones.rightLowerLeg.quaternion.multiply(Q.setFromAxisAngle(AXIS_X,Math.max(0,stride)*1.1));
  if(moving){bones.leftUpperArm.quaternion.multiply(Q.setFromAxisAngle(AXIS_X,-stride*.72));bones.rightUpperArm.quaternion.multiply(Q.setFromAxisAngle(AXIS_X,stride*.72));}
  if(person?.task==='work'){bones.spine.quaternion.multiply(Q.setFromAxisAngle(AXIS_X,.18+Math.sin(time*3)*.035));bones.rightUpperArm.quaternion.multiply(Q.setFromAxisAngle(AXIS_X,-.45+Math.sin(time*3)*.18));}
  if(person?.task==='defending'){bones.spine.quaternion.multiply(Q.setFromAxisAngle(AXIS_Y,.14));bones.leftUpperArm.quaternion.multiply(Q.setFromAxisAngle(AXIS_X,-.45));bones.rightUpperArm.quaternion.multiply(Q.setFromAxisAngle(AXIS_X,-.7));}
  if(person?.downed)bones.spine.quaternion.multiply(Q.setFromAxisAngle(AXIS_Z,.82));
  if(!moving&&!person?.downed)bones.spine.quaternion.multiply(Q.setFromAxisAngle(AXIS_Z,Math.sin(time*1.4+(Number(person?.seed)||0))*.012));
}

if(view&&!view.__sharedHumanRuntimeIntegrated){
  const state={status:'loading',error:null,pools:new Map(),entries:new Map(),models:new Map()};
  const snapshot=()=>({version:2,status:state.status,error:state.error,active:state.entries.size,capacity:MODELS.length*POOL_SHARDS*POOL_CAPACITY,family:VILLAGE_CHARACTER_RUNTIME.family,rig:VILLAGE_CHARACTER_RUNTIME.rigFamily,models:[...state.models.keys()]});
  window.__VILLAGE_SHARED_HUMANS__={snapshot};
  view.canvas.dataset.characterRuntime=VILLAGE_CHARACTER_RUNTIME.id;
  view.canvas.dataset.characterRuntimeModel='loading';

  const release=id=>{
    const key=String(id),entry=state.entries.get(key);if(!entry)return false;
    entry.actor.root.removeFromParent();state.pools.get(entry.modelId)?.[entry.poolIndex]?.despawn(entry.poolId);state.entries.delete(key);return true;
  };
  const allocate=(model,poolId)=>{
    const pools=state.pools.get(model.id);if(!pools)return null;
    let best=-1,bestActive=Infinity;
    for(let i=0;i<pools.length;i++){const active=pools[i].stats().active;if(active<POOL_CAPACITY&&active<bestActive){best=i;bestActive=active;}}
    if(best<0)return null;
    return {poolIndex:best,actor:pools[best].spawn(poolId)};
  };
  const ensure=(person,node)=>{
    const key=String(person.id),model=modelFor(person),existing=state.entries.get(key);
    if(existing&&existing.modelId!==model.id)release(key);
    let entry=state.entries.get(key);
    if(!entry){
      const poolId=`village.${clean(person.id)}`,allocated=allocate(model,poolId);if(!allocated)return null;
      const actor=allocated.actor;actor.root.name=`SharedHuman:${person.id}`;node.add(actor.root);
      entry={poolId,poolIndex:allocated.poolIndex,modelId:model.id,actor,character:null,signature:null};state.entries.set(key,entry);
    }else if(entry.actor.root.parent!==node)node.add(entry.actor.root);
    const signature=`${person.role||'resident'}:${person.seed||0}`;
    if(entry.signature!==signature){entry.signature=signature;entry.character=characterFor(person);}
    return entry;
  };

  const originalSync=view.syncActor.bind(view);
  view.syncActor=(person,time,monster=false)=>{
    const result=originalSync(person,time,monster),node=view.actorNodes.get(person?.id);
    if(!node||!human(person,monster))return result;
    const runtime=resolveVillageCharacterRuntime(person);
    Object.assign(node.userData,{characterRuntimeAdapter:VILLAGE_CHARACTER_RUNTIME.id,characterRuntimeFamily:VILLAGE_CHARACTER_RUNTIME.family,characterRuntimeFormat:VILLAGE_CHARACTER_RUNTIME.format,characterRuntimeRig:VILLAGE_CHARACTER_RUNTIME.rigFamily,characterRuntimeState:runtime.state,characterRuntimeMotion:runtime.motion.resolvedState});
    if(state.status!=='ready'){hideProcedural(node,false);node.userData.manifestationSource='procedural-fallback';return result;}
    const entry=ensure(person,node);if(!entry){hideProcedural(node,false);node.userData.manifestationSource='capacity-fallback';return result;}
    const now=Math.max(0,Number(time)||0),appearance=appearanceForCharacter(entry.character);entry.actor.sample(appearance,now,bones=>pose(bones,now,person));
    entry.actor.root.visible=node.visible!==false&&!person.dead;entry.actor.root.rotation.set(0,0,0);entry.actor.root.position.set(0,0,0);
    Object.assign(entry.actor.root.userData,{characterRuntimeAdapter:VILLAGE_CHARACTER_RUNTIME.id,characterRuntimeFamily:VILLAGE_CHARACTER_RUNTIME.family,characterRuntimeRig:VILLAGE_CHARACTER_RUNTIME.rigFamily,characterModel:entry.modelId,characterRuntimeState:runtime.state,characterRuntimeMotion:runtime.motion.resolvedState});
    hideProcedural(node,true);node.userData.characterModel=entry.modelId;node.userData.manifestationStage='manifested';node.userData.manifestationSource='kaykit-model';
    return result;
  };
  const originalRemove=view.removeActor.bind(view);
  view.removeActor=id=>{release(id);return originalRemove(id);};
  view.__sharedHumanRuntimeIntegrated=true;

  Promise.all(MODELS.map(async model=>{
    const url=new URL(`./assets/kaykit/${fileFor(model)}`,location.href).href;
    const loaded=await loadKaykitRuntimeModel({model,url,renderer:view.renderer,transcoderPath:`${import.meta.env.BASE_URL}basis/`});
    const pools=Array.from({length:POOL_SHARDS},()=>createCharacterProductionPool({template:loaded.gltf.scene,humanoid:loaded.rig.humanoid,rig:loaded.rig,capacity:POOL_CAPACITY}));
    state.models.set(model.id,loaded);state.pools.set(model.id,pools);
  })).then(()=>{
    state.status='ready';view.canvas.dataset.characterRuntimeModel='kaykit';
  }).catch(error=>{
    state.status='fallback';state.error=String(error?.message||error);view.canvas.dataset.characterRuntimeModel='fallback';console.warn('[Village shared humans] procedural fallback',error);
  });
  window.addEventListener('pagehide',()=>{for(const id of [...state.entries.keys()])release(id);for(const pools of state.pools.values())for(const pool of pools)pool.dispose();state.pools.clear();},{once:true});
}
