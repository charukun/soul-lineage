const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
export const SCALE_THRESHOLDS=Object.freeze([18,48,92,168]);
const rows=Object.freeze([
 Object.freeze({id:'near',crowdMode:'master',animationHz:60,networkHz:20,audioMode:'spatial',audioVoices:8,audioGain:1}),
 Object.freeze({id:'mid',crowdMode:'reduced',animationHz:30,networkHz:8,audioMode:'spatial',audioVoices:5,audioGain:.8}),
 Object.freeze({id:'far',crowdMode:'proxy',animationHz:12,networkHz:2,audioMode:'category-mix',audioVoices:2,audioGain:.5}),
 Object.freeze({id:'distant',crowdMode:'impostor',animationHz:4,networkHz:.5,audioMode:'ambience',audioVoices:1,audioGain:.25}),
 Object.freeze({id:'dormant',crowdMode:'hidden',animationHz:0,networkHz:0,audioMode:'none',audioVoices:0,audioGain:0}),
]);
export function worldScaleKernel({focus={x:0,z:0},entities=[],qualityLevel=0}={}){const fx=Number(focus.x)||0,fz=Number(focus.z)||0,quality=clamp(Math.floor(Number(qualityLevel)||0),0,3),scale=[1,.94,.84,.72][quality];return entities.map((entity,index)=>{const id=String(entity.id??index),x=Number(entity.x)||0,z=Number(entity.z)||0,distance=Math.hypot(x-fx,z-fz);let tier;if(entity.local||entity.important||entity.combat)tier=rows[0];else{let i=0;while(i<SCALE_THRESHOLDS.length&&distance>SCALE_THRESHOLDS[i]*scale)i++;tier=rows[i]||rows.at(-1);}return{id,x,z,distance,tier:tier.id,...tier};});}
