const mulberry32=seed=>()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};

export const SCALE_REPLAY_PHASES=Object.freeze([
  Object.freeze({id:'village-center',seconds:10,crowd:80,radius:38,combat:false}),
  Object.freeze({id:'market-crossing',seconds:10,crowd:140,radius:70,combat:false}),
  Object.freeze({id:'weather-pressure',seconds:10,crowd:180,radius:90,combat:false}),
  Object.freeze({id:'combat-surge',seconds:10,crowd:120,radius:55,combat:true}),
  Object.freeze({id:'return-home',seconds:10,crowd:100,radius:48,combat:false}),
]);

export function createDeterministicScaleReplay({seed=90210,phases=SCALE_REPLAY_PHASES}={}){
  const rng=mulberry32(seed>>>0);let sequence=0;
  const frames=[];
  for(const phase of phases){
    const entities=Array.from({length:phase.crowd},(_,i)=>{const angle=rng()*Math.PI*2,r=Math.sqrt(rng())*phase.radius;return{id:`${phase.id}-${i}`,x:Math.cos(angle)*r,z:Math.sin(angle)*r,combat:phase.combat&&i<8,important:i<2};});
    frames.push(Object.freeze({sequence:sequence++,id:phase.id,seconds:phase.seconds,focus:Object.freeze({x:0,z:0}),entities:Object.freeze(entities)}));
  }
  return Object.freeze({version:1,seed,frames:Object.freeze(frames)});
}

export async function runScaleReplay({planner,replay=createDeterministicScaleReplay(),qualityLevel=0,now=()=>performance.now()}={}){
  if(typeof planner!=='function')throw new Error('Scale replay planner required');const results=[];
  for(const frame of replay.frames){const started=now();const plan=await planner({focus:frame.focus,entities:frame.entities,qualityLevel});const elapsedMs=Math.max(0,now()-started);results.push(Object.freeze({id:frame.id,entities:frame.entities.length,elapsedMs,near:plan.filter(r=>r.tier==='near').length,mid:plan.filter(r=>r.tier==='mid').length,far:plan.filter(r=>r.tier==='far').length,distant:plan.filter(r=>r.tier==='distant').length,dormant:plan.filter(r=>r.tier==='dormant').length}));}
  const totalMs=results.reduce((s,r)=>s+r.elapsedMs,0);return Object.freeze({version:1,seed:replay.seed,totalMs,averageMs:results.length?totalMs/results.length:0,frames:Object.freeze(results)});
}
