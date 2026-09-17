import {combatEffectBudget,combatEffectCues,combatEffectScope,createCombatEffectGate} from './combat-effect-cues.js';

/** Renderer-independent bounded owner of authored native playback handles. */
export function createAuthoredEffectPlayer({mobile=false,reducedMotion=false,onError=()=>{}}={}){
  const gate=createCombatEffectGate();let backend=null,disposed=false,phase='loading',error='';
  let budget=combatEffectBudget(0,mobile,reducedMotion),active=[];
  const stats={played:0,dropped:0,replayed:0};
  const stop=handle=>{try{handle.stop();}catch{/* A failed optional native handle cannot stop gameplay. */}};
  function clear(){for(const row of active)stop(row.handle);active=[];try{backend?.clear();}catch{}}
  function fail(reason){
    if(disposed||phase==='failed')return;
    error=String(reason?.message||reason);phase='failed';
    try{clear();}finally{try{backend?.dispose();}catch{}backend=null;onError(error);}
  }
  function changeScope(state,front,key){
    const decision=gate.enter(combatEffectScope(state,front),key);
    if(decision.changed)clear();return decision.accept;
  }
  return {
    attach(next){if(disposed||phase==='failed'){next.dispose();return false;}backend=next;phase='ready';return true;},
    fail,
    present(events,context){
      if(disposed)return;
      if(!changeScope(context.state,context.front,context.eventKey)){stats.replayed++;return;}
      const cues=combatEffectCues(events,context).filter(c=>budget.trails||c.effect!=='slash')
        .sort((a,b)=>b.priority-a.priority);
      if(phase!=='ready'){stats.dropped+=cues.length;return;}
      let started=0;
      try{
        for(const original of cues){
          if(started>=budget.maxPerBatch){stats.dropped++;continue;}
          if(active.length>=budget.maxActive){
            const lowest=active.reduce((best,row,i)=>row.priority<active[best].priority?i:best,0);
            if(active[lowest].priority>=original.priority){stats.dropped++;continue;}
            stop(active.splice(lowest,1)[0].handle);stats.dropped++;
          }
          const cue={...original,scale:original.scale*budget.intensity};
          const handle=backend.play(cue);if(!handle){stats.dropped++;continue;}
          active.push({handle,remaining:cue.lifetime,priority:cue.priority});started++;stats.played++;
        }
      }catch(reason){fail(reason);}
    },
    frame(state,front,dt,{level=0,reduced=reducedMotion,hidden=false}={}){
      if(disposed)return;changeScope(state,front);
      budget=combatEffectBudget(level,mobile,reduced);
      if(hidden||state?.ended||state?.phase==='birth'){clear();return;}
      while(active.length>budget.maxActive){
        const lowest=active.reduce((best,row,i)=>row.priority<active[best].priority?i:best,0);
        stop(active.splice(lowest,1)[0].handle);
      }
      if(phase!=='ready'||!Number.isFinite(dt)||dt<=0)return;
      try{
        // Age by real render delta. Never replay a backlog after a hidden tab.
        for(const row of active)row.remaining-=dt;
        active=active.filter(row=>{if(row.remaining<=0){stop(row.handle);return false;}return row.handle.exists!==false;});
        if(active.length)backend.update(dt);
      }catch(reason){fail(reason);}
    },
    draw(camera){if(phase!=='ready'||active.length===0)return;try{backend.draw(camera);}catch(reason){fail(reason);}},
    clear,
    snapshot:()=>({phase,error,active:active.length,budget:{...budget},...stats}),
    dispose(){if(disposed)return;disposed=true;clear();try{backend?.dispose();}catch{}backend=null;gate.reset();phase='disposed';},
  };
}
