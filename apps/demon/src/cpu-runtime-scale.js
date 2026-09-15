import {RaidSession} from '@soul/raid';
import {createRuntimeProfiler} from '@soul/platform-web/runtime-profiler';
const profiler=createRuntimeProfiler(),tick=RaidSession.prototype.tick;
if(typeof tick==='function'&&!tick.__cpuScaleProfiled){const wrapped=function profiledRaidTick(...args){return profiler.measure('raid.tick',()=>tick.apply(this,args));};wrapped.__cpuScaleProfiled=true;RaidSession.prototype.tick=wrapped;}
if(typeof window!=='undefined')window.__DEMON_CPU_SCALE__={snapshot:()=>profiler.snapshot()};
