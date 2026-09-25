import { KAYKIT_DEFAULT_MODEL_ID, KAYKIT_MODELS, createCharacterModelWrapper, selectKaykitModel } from '@soul/characters';
import { GLTFLoader } from '@soul/rendering';
import { createMasterCharacterPool } from '@soul/rendering/master-character';
import { createManifestationEffect, createProgressiveManifestation } from '@soul/rendering/progressive-manifestation';
import { applyStylizedShading } from '@soul/rendering/stylized-shading';
import { kaykitHumanoidFromGLTF } from '@soul/rendering/kaykit-rig';
import { RINNE_CHARACTER_RUNTIME } from './character-runtime-adapter.js';

const modelById=new Map(KAYKIT_MODELS.map(model=>[model.id,model]));
const motherModelId='kaykit.rogue-hooded.v1';

function fallbackModelId(actorId) {
  const text = String(actorId || 'actor');
  if (text.includes('mother')) return motherModelId;
  if (text.includes('hero')) return KAYKIT_DEFAULT_MODEL_ID;
  return selectKaykitModel({ kind: 'actor', key: text }).id;
}

function playManifestation(actor,profile='human'){
  const root=actor?.root;if(!root||typeof requestAnimationFrame!=='function')return;
  const qualityScale=Math.max(.35,Math.min(1,Number(root.userData?.manifestationQualityScale)||1)),effect=createManifestationEffect({profile,qualityScale,subject:actor.visual}),duration=effect.profile.duration*1000,start=performance.now();effect.update(0);root.add(effect.root);root.userData.manifestationStage='forming';root.userData.manifestationProfile=effect.profile.id;
  const step=now=>{const progress=Math.max(0,Math.min(1,(now-start)/duration));effect.update(progress);root.userData.manifestationProgress=progress;if(progress<1)requestAnimationFrame(step);else{root.userData.manifestationStage='manifested';effect.dispose();}};requestAnimationFrame(step);
}

function actorHandle(slot){
  return createCharacterModelWrapper({
    actor:()=>slot.actor,
    adapter:RINNE_CHARACTER_RUNTIME,
    modelId:()=>slot.activeModel
  });
}

function familyPool(templates, capacity, {onNeedModel=()=>{}} = {}) {
  const pools=new Map(),owners=new Map(),fallbackCapacity=Math.min(30,Math.max(capacity,capacity*KAYKIT_MODELS.length));
  const ensurePool=modelId=>{
    if(pools.has(modelId))return pools.get(modelId);const template=templates.get(modelId);if(!template)return null;
    const pool=createMasterCharacterPool({template:template.scene,humanoid:template.humanoid,capacity:modelId===KAYKIT_DEFAULT_MODEL_ID?fallbackCapacity:capacity});pools.set(modelId,pool);return pool;
  };
  for(const modelId of templates.keys())ensurePool(modelId);
  function stamp(actor,selected){Object.assign(actor.root.userData,{characterFamily:RINNE_CHARACTER_RUNTIME.family,characterModel:selected,characterRuntimeAdapter:RINNE_CHARACTER_RUNTIME.id,characterRuntimeFormat:RINNE_CHARACTER_RUNTIME.format,characterRuntimeRig:RINNE_CHARACTER_RUNTIME.rigFamily,characterRuntimeState:RINNE_CHARACTER_RUNTIME.resolveState(),manifestationStage:'manifested'});}
  function upgrade(slot,modelId){
    if(slot.activeModel===modelId||slot.actor.attachments.children.length)return false;const nextPool=ensurePool(modelId);if(!nextPool)return false;
    const old=slot.actor,rootParent=old.root.parent,attachmentsParent=old.attachments.parent,position=old.root.position.clone(),quaternion=old.root.quaternion.clone(),scale=old.root.scale.clone(),visible=old.root.visible,name=old.root.name,userData={...old.root.userData};
    pools.get(slot.activeModel).despawn(slot.poolId);const next=nextPool.spawn(slot.poolId);next.root.position.copy(position);next.root.quaternion.copy(quaternion);next.root.scale.copy(scale);next.root.visible=visible;next.root.name=name;Object.assign(next.root.userData,userData);stamp(next,modelId);if(rootParent)rootParent.add(next.root);if(attachmentsParent)attachmentsParent.add(next.attachments);slot.actor=next;slot.activeModel=modelId;
    const hostile=slot.poolId.includes('enemy'),peer=slot.poolId.startsWith('rinne-peer:'),profile=hostile?'enemy':peer?'npc':'npc';applyStylizedShading(next.root,profile);applyStylizedShading(next.attachments,profile);playManifestation(next,hostile?'hostile':'human');return true;
  }
  return Object.freeze({
    spawn(id, modelId = null) {
      if (owners.has(id)) throw new Error(`KayKit actor already spawned: ${id}`);
      const requested=modelId||fallbackModelId(id),requestedPool=ensurePool(requested),activeModel=requestedPool?requested:KAYKIT_DEFAULT_MODEL_ID,pool=ensurePool(activeModel);
      if(!pool)throw new Error('KayKit fallback model is not loaded');
      const actor=pool.spawn(id),slot={poolId:id,requestedModel:requested,activeModel,actor,handle:null};slot.handle=actorHandle(slot);owners.set(id,slot);stamp(actor,activeModel);
      if(activeModel!==requested){actor.root.userData.manifestationStage='hinted';actor.root.userData.manifestationRequestedModel=requested;onNeedModel(requested,20,false);}
      return slot.handle;
    },
    installModel(modelId,template){templates.set(modelId,template);ensurePool(modelId);for(const slot of owners.values())if(slot.requestedModel===modelId&&slot.activeModel!==modelId)upgrade(slot,modelId);},
    focusModel(modelId,priority=180){if(!templates.has(modelId))onNeedModel(modelId,priority,true);},
    despawn(id) {const slot=owners.get(id);if(!slot)return false;owners.delete(id);return pools.get(slot.activeModel).despawn(id);},
    stats() {const rows=[...pools.values()].map(pool=>pool.stats());return rows.reduce((sum,row)=>({active:sum.active+row.active,allocated:sum.allocated+row.allocated,meshes:sum.meshes+row.meshes,geometries:sum.geometries+row.geometries,textures:sum.textures+row.textures,materials:sum.materials+row.materials}),{active:0,allocated:0,meshes:0,geometries:0,textures:0,materials:0});},
    dispose(){owners.clear();for(const pool of pools.values())pool.dispose();pools.clear();}
  });
}

/**
 * Load only the two title/first-life critical KayKit variants before Rinne becomes playable.
 * Remaining variants enter a low-priority queue and are promoted when player attention needs them.
 */
export async function createKaykitCharacterPools(renderer,{onProgress=null}={}) {
  const loader=new GLTFLoader();loader.useCompressedTextures?.(renderer,{transcoderPath:'./basis/'});
  const templates=new Map(),families=[],director=createProgressiveManifestation({maxConcurrent:2});
  const install=(modelId,template)=>{templates.set(modelId,template);for(const family of families)family.installModel(modelId,template);};
  try{
    for(const model of KAYKIT_MODELS){
      director.register(model.id,{profile:'human',load:async({onProgress:progress})=>{
        const gltf=await loader.loadAsync(model.runtime.url,event=>{const total=Number(event?.total)||model.source.byteLength,loaded=Number(event?.loaded)||0;progress(total>0?loaded/total:0);});const humanoid=kaykitHumanoidFromGLTF(gltf);return Object.freeze({scene:gltf.scene,humanoid});
      },onState:snapshot=>onProgress?.(Object.freeze({modelId:model.id,...snapshot})),onReady:(template,profile)=>{install(model.id,template);queueMicrotask(()=>director.update(profile.duration));}});
    }
    director.focus(KAYKIT_DEFAULT_MODEL_ID,300);director.focus(motherModelId,290);
    await Promise.all([director.wait(KAYKIT_DEFAULT_MODEL_ID),director.wait(motherModelId)]);
    const needModel=(modelId,priority=20,focused=false)=>{if(!modelById.has(modelId))return;focused?director.focus(modelId,priority):director.hint(modelId,priority);};
    const pool=familyPool(templates,8,{onNeedModel:needModel}),peerPool=familyPool(templates,30,{onNeedModel:needModel}),motherPool=familyPool(templates,30,{onNeedModel:needModel});families.push(pool,peerPool,motherPool);
    for(const [modelId,template] of templates)for(const family of families)family.installModel(modelId,template);
    for(const model of KAYKIT_MODELS)if(!templates.has(model.id))director.hint(model.id,5);
    return Object.freeze({
      pool,peerPool,motherPool,
      manifestation:Object.freeze({snapshot:director.snapshot,focusModel:(modelId,priority=180)=>needModel(modelId,priority,true)}),
      dispose(){pool.dispose();peerPool.dispose();motherPool.dispose();director.dispose();loader.disposeCompressedTextures?.();}
    });
  } catch (error) {director.dispose();loader.disposeCompressedTextures?.();throw error;}
}
