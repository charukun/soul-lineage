/** UI policy consumes session state; it never elects a host or writes a checkpoint.
 * A connected adapter supplies the existing authority phase/epoch and member IDs.
 * The present main-game adapter is explicitly solo. */
export const SOLO_SESSION=Object.freeze({mode:'solo',phase:'open',members:[],epoch:0,revision:0});
export const canPauseWorld=session=>session?.mode==='solo'&&session.phase==='open';
export function createMenuGate({readSession,snapshot,pause,stopMove,blockInput}){
  const owners=new Set();let priorPaused=false,ownsPause=false,blocked=false;
  function sync(){const next=owners.size>0||readSession()?.phase!=='open';if(next!==blocked){blocked=next;if(next)stopMove();blockInput(next);}}
  return {
    open(owner){if(owners.has(owner))return;if(!owners.size){priorPaused=snapshot().paused;ownsPause=canPauseWorld(readSession());if(ownsPause)pause(true);}owners.add(owner);sync();},
    close(owner){if(!owners.delete(owner))return;sync();if(!owners.size){if(ownsPause&&canPauseWorld(readSession())&&!snapshot().life?.expired)pause(priorPaused);ownsPause=false;}},
    sync,
    canPause:()=>canPauseWorld(readSession()),
    dispose(){owners.clear();if(blocked)blockInput(false);blocked=false;},
  };
}
