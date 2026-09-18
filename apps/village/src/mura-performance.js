const village=window.village;
if(!village)throw new Error('MURAAAAAAA performance layer requires a booted village');
const {world,view}=village;

// The detailed simulation intentionally stays under 100 named/pathfinding actors.
// Larger villages are represented by the aggregate resident cohorts in mura-world-systems.
// Cache population score calculations because several UI surfaces request the same values.
const originalPopulation=world.population.bind(world);
let populationCache=null,lastPopulationAt=0,lastRevision=-1;
world.population=()=>{
 const now=performance.now(),revision=world.state.revision;
 if(populationCache&&revision===lastRevision&&now-lastPopulationAt<300)return populationCache;
 populationCache=originalPopulation();lastPopulationAt=now;lastRevision=revision;return populationCache;
};

// Far actors keep their last transform and are refreshed at a reduced cadence. This is mostly
// invisible with the current detailed-agent cap, but protects mobile frame time as the village grows.
const originalSync=view.syncActor.bind(view);let frame=0;const actorCadence=new Map();
view.syncActor=(p,time,monster=false)=>{
 frame++;const dx=(p.x||0)-view.target.x,dz=(p.z||0)-view.target.z,distance=Math.hypot(dx,dz),near=Math.max(55,view.span*2.2),veryFar=Math.max(120,view.span*4.5);
 const cadence=distance<near?1:distance<veryFar?3:7,slot=actorCadence.get(p.id)??(Math.abs(String(p.id).split('').reduce((n,c)=>n+c.charCodeAt(0),0))%cadence);actorCadence.set(p.id,slot);
 if(!monster&&cadence>1&&(frame+slot)%cadence!==0&&view.actorNodes.has(p.id))return view.actorNodes.get(p.id);
 return originalSync(p,time,monster);
};

window.__MURA_PERFORMANCE__={version:1,detailedActorTarget:96,populationArchitecture:'detailed-agents-plus-aggregate-cohorts'};
