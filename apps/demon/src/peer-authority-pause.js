import {RaidSession} from '@soul/raid';

const tick=RaidSession.prototype.tick;
if(typeof tick==='function'&&!tick.__peerAuthorityPause){
  const wrapped=function peerAuthorityPause(dt,input,...rest){
    if(globalThis.window?.__DEMON_SHARED_WORLD_PAUSED__)return;
    return tick.call(this,dt,input,...rest);
  };
  wrapped.__peerAuthorityPause=true;
  RaidSession.prototype.tick=wrapped;
}
