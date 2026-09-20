/**
 * Browser-only audio activation gate.
 *
 * Browsers may keep Web Audio and media playback suspended until a trusted
 * user gesture. Game code subscribes once; this adapter owns the browser
 * gesture policy so native/store targets do not inherit it.
 */
export function createWebAudioActivation({documentRef=globalThis.document}={}){
  let unlocked=false,installed=false,disposed=false;
  const listeners=new Set();
  const events=['pointerdown','keydown','touchstart'];

  const invoke=listener=>{
    try{return Promise.resolve(listener());}
    catch(error){return Promise.reject(error);}
  };
  const removeGestureListeners=()=>{
    if(!installed||!documentRef?.removeEventListener)return;
    installed=false;
    for(const type of events)documentRef.removeEventListener(type,onGesture,true);
  };
  const unlock=async()=>{
    if(disposed)return false;
    if(!unlocked){
      unlocked=true;
      removeGestureListeners();
    }
    await Promise.allSettled([...listeners].map(invoke));
    return true;
  };
  const onGesture=()=>{void unlock();};
  const install=()=>{
    if(installed||unlocked||disposed||!documentRef?.addEventListener)return;
    installed=true;
    for(const type of events)documentRef.addEventListener(type,onGesture,{capture:true,passive:true});
  };
  const subscribeUnlock=listener=>{
    if(typeof listener!=='function')throw new TypeError('Audio unlock listener must be a function');
    if(disposed)return()=>{};
    listeners.add(listener);
    if(unlocked)queueMicrotask(()=>{if(listeners.has(listener)&&!disposed)void invoke(listener).catch(()=>{});});
    else install();
    return()=>listeners.delete(listener);
  };
  return Object.freeze({
    requiresUserActivation:true,
    get unlocked(){return unlocked;},
    unlock,
    subscribeUnlock,
    dispose(){if(disposed)return;disposed=true;removeGestureListeners();listeners.clear();},
  });
}

export const webAudioActivation=createWebAudioActivation();
