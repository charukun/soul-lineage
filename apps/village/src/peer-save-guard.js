import {setVillageSaveReadOnly} from './game/save-store.js';

if(typeof window!=='undefined'&&!window.__VILLAGE_PEER_SAVE_GUARD__){
  let remote=Boolean(window.__VILLAGE_REMOTE_WORLD_ACTIVE__);
  setVillageSaveReadOnly(remote);
  Object.defineProperty(window,'__VILLAGE_REMOTE_WORLD_ACTIVE__',{
    configurable:true,
    enumerable:false,
    get(){return remote;},
    set(value){remote=Boolean(value);setVillageSaveReadOnly(remote);},
  });
  window.__VILLAGE_PEER_SAVE_GUARD__={get remote(){return remote;}};
}
