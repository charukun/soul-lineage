import {setVillageSaveReadOnly} from './game/save-store.js';

if(typeof window!=='undefined'&&!window.__VILLAGE_PEER_SAVE_GUARD__){
  let remote=Boolean(window.__VILLAGE_REMOTE_WORLD_ACTIVE__);
  let paused=Boolean(window.__VILLAGE_SIMULATION_PAUSED__);
  const sync=()=>setVillageSaveReadOnly(remote||paused);
  sync();
  Object.defineProperty(window,'__VILLAGE_REMOTE_WORLD_ACTIVE__',{
    configurable:true,
    enumerable:false,
    get(){return remote;},
    set(value){remote=Boolean(value);sync();},
  });
  Object.defineProperty(window,'__VILLAGE_SIMULATION_PAUSED__',{
    configurable:true,
    enumerable:false,
    get(){return paused;},
    set(value){paused=Boolean(value);sync();},
  });
  window.__VILLAGE_PEER_SAVE_GUARD__={get remote(){return remote;},get paused(){return paused;},get readOnly(){return remote||paused;}};
}
