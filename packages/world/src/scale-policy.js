const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

export const WORLD_SCALE_TIERS=Object.freeze([
  Object.freeze({id:'near',maxDistance:18,crowdMode:'master',animationHz:60,networkHz:20,networkFields:Object.freeze(['x','z','yaw','state','hp','action']),audioMode:'spatial',audioVoices:8,audioGain:1}),
  Object.freeze({id:'mid',maxDistance:48,crowdMode:'reduced',animationHz:30,networkHz:8,networkFields:Object.freeze(['x','z','yaw','state','hp']),audioMode:'spatial',audioVoices:5,audioGain:.8}),
  Object.freeze({id:'far',maxDistance:92,crowdMode:'proxy',animationHz:12,networkHz:2,networkFields:Object.freeze(['x','z','state']),audioMode:'category-mix',audioVoices:2,audioGain:.5}),
  Object.freeze({id:'distant',maxDistance:168,crowdMode:'impostor',animationHz:4,networkHz:.5,networkFields:Object.freeze(['x','z']),audioMode:'ambience',audioVoices:1,audioGain:.25}),
  Object.freeze({id:'dormant',maxDistance:Infinity,crowdMode:'hidden',animationHz:0,networkHz:0,networkFields:Object.freeze([]),audioMode:'none',audioVoices:0,audioGain:0}),
]);

export function worldScaleTier(distance,{qualityLevel=0,local=false,important=false,combat=false}={}){
  if(!Number.isFinite(distance)||distance<0)throw new Error('Invalid world-scale distance');
  if(local||important||combat)return WORLD_SCALE_TIERS[0];
  const quality=clamp(Math.floor(Number(qualityLevel)||0),0,3);
  const scale=[1,.94,.84,.72][quality];
  return WORLD_SCALE_TIERS.find(t=>distance<=t.maxDistance*scale)||WORLD_SCALE_TIERS.at(-1);
}

export function planWorldScale({focus={x:0,z:0},entities=[],qualityLevel=0}={}){
  const fx=Number(focus.x)||0,fz=Number(focus.z)||0;
  return entities.map((entity,index)=>{
    const id=String(entity.id??index),x=Number(entity.x)||0,z=Number(entity.z)||0;
    const distance=Math.hypot(x-fx,z-fz);
    const tier=worldScaleTier(distance,{qualityLevel,local:!!entity.local,important:!!entity.important,combat:!!entity.combat});
    return Object.freeze({id,x,z,distance,tier:tier.id,crowdMode:tier.crowdMode,animationHz:tier.animationHz,networkHz:tier.networkHz,networkFields:tier.networkFields,audioMode:tier.audioMode,audioVoices:tier.audioVoices,audioGain:tier.audioGain});
  });
}

export function summarizeWorldScale(plan=[]){
  const counts=Object.fromEntries(WORLD_SCALE_TIERS.map(t=>[t.id,0]));
  for(const row of plan)if(row&&row.tier in counts)counts[row.tier]++;
  return Object.freeze({total:plan.length,counts:Object.freeze(counts)});
}
