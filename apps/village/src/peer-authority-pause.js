import {Simulation} from './game/simulation.js';

const update=Simulation.prototype.update;
if(typeof update==='function'&&!update.__peerAuthorityPause){
  const wrapped=function peerAuthorityPause(dt,...rest){
    if(globalThis.window?.__VILLAGE_SIMULATION_PAUSED__)return;
    return update.call(this,dt,...rest);
  };
  wrapped.__peerAuthorityPause=true;
  Simulation.prototype.update=wrapped;
}
