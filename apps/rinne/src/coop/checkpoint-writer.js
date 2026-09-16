const clone=value=>structuredClone(value);
const changed=(a,b)=>!b||a.id!==b.id||a.ended!==b.ended;

/** One in-flight write + one coalesced request. Ordinary simulation never awaits IO. */
export function createCheckpointWriter({world,save,now,onCommit=()=>{},onError=()=>{}}){
  let committed=null,revision=0,active=null,queued=null,failure=null,started=0;
  function request(){
    if(failure)return Promise.reject(failure);
    if(!queued){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});queued={promise,resolve,reject};}
    const promise=queued.promise;if(!active)void pump();return promise;
  }
  async function pump(){
    active=queued;queued=null;started=now();const job=active;
    try{
      const captured=world.save();world.dirtyHistory=false;
      const receipt=await save(captured);
      committed=captured;revision++;job.resolve(receipt);onCommit(receipt);
    }catch(error){failure=error;job.reject(error);queued?.reject(error);queued=null;onError(error);}
    finally{active=null;if(queued&&!failure)void pump();}
  }
  function pendingIds(){return new Set(Object.entries(world.data.players).filter(([id,row])=>changed(row.life,committed?.world.players[id]?.life)).map(([id])=>id));}
  function project(view){
    if(!view||!committed)return view;
    const id=Object.keys(world.data.players).find(id=>world.data.players[id].life.id===view.me.id),old=committed.world.players[id]?.life;
    if(changed(view.me,old)){
      if(!old)return null;
      view={...view,me:clone(old),historyPending:true,events:[]};
    }
    view.peers=view.peers.flatMap(peer=>{
      const prior=committed.world.players[peer.playerId]?.life;if(!prior)return[];
      if(!changed(peer,prior))return[peer];
      const held=clone(peer);for(const key of Object.keys(held))if(Object.hasOwn(prior,key))held[key]=clone(prior[key]);
      held.moving=false;return[held];
    });
    view.count=Object.keys(committed.world.players).length;view.historyRevision=revision;
    return view;
  }
  return{request,pendingIds,project,get committed(){return committed;},get revision(){return revision;},
    get pending(){return Boolean(active||queued);},get pendingSince(){return started;},get failure(){return failure;}};
}
