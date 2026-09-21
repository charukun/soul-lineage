import {createJohakyuCursor,compileJohakyuSequence,johakyuIntent,JOHAKYU_CLIPS} from '@soul/johakyu-combat';

// Review encounter only. Life, equipment qualification and saving still belong
// to RINNE. No demo HP or automatic reset is exported as a main-game command.
export function createJohakyuReviewRules({mind='balanced',loadout}={}){
  const sequence=compileJohakyuSequence({weapon:'sword',loadout});
  let actors=new Map(),events=[],serial=0,battle=0;
  function entry(actor){
    const id=actor.object.uuid;let row=actors.get(id);
    if(!row){row={id,cursor:createJohakyuCursor({actorId:id,sequence}),idle:0,reaction:null,counterReady:false,lastThreat:null};actors.set(id,row);}
    return row;
  }
  function inspect(actor){const row=actors.get(actor.object.uuid),active=row?.cursor.snapshot().active;
    return {phase:active?.phase??null,techniqueId:active?.techniqueId??null,attackId:active?.id??row?.reaction?.id??null,
      intent:row?.intent??null,queuedPhase:row?.cursor.snapshot().queuedPhase??'jo'};
  }
  return Object.freeze({
    mode:'johakyu-review',mind,sequence,
    reset(){actors=new Map();events=[];serial=0;battle++;},
    attach(actor){entry(actor);actor.hp=actor.maxHp=220;},
    release(actor){actors.delete(actor.object.uuid);},
    beginStep(){events=[];},
    step(actor,dt){const row=entry(actor);if(!actor.attack&&!row.reaction)row.idle+=dt;if(row.reaction){row.reaction.remaining=Math.max(0,row.reaction.remaining-dt);if(row.reaction.remaining===0){row.counterReady=row.reaction.mode==='parry';row.reaction=null;}}},
    intent(actor,target){
      const row=entry(actor),incoming=target?.attack;
      const decision=johakyuIntent({mind:actor.kind==='hero'?mind:'balanced',distance:actor.pos.distanceTo(target.pos),
        threat:!!incoming&&!incoming.hit&&row.lastThreat!==incoming,threatProgress:incoming?incoming.time/incoming.duration:1,
        counterReady:row.counterReady,idleSeconds:row.idle});
      row.intent=decision.mode;
      if(decision.mode==='guard'||decision.mode==='parry'){
        row.lastThreat=incoming;row.reaction={id:`${row.id}:reaction:${++serial}`,mode:decision.mode,remaining:.44};
      }
      return decision;
    },
    reaction(actor){return entry(actor).reaction;},
    begin(actor,{counter=false}={}){
      const row=entry(actor);row.idle=0;
      if(counter){row.counterReady=false;return Object.freeze({id:`${row.id}:counter:${++serial}`,actorId:row.id,phase:null,techniqueId:null,kind:'counter',clip:JOHAKYU_CLIPS.counter.clip,offense:true,reaction:true});}
      return row.cursor.begin();
    },
    complete(actor,action){if(action&&!action.reaction)entry(actor).cursor.complete(action.id);},
    cancel(actor,action){if(action&&!action.reaction)entry(actor).cursor.cancel(action.id);},
    damageScale(target){return entry(target).reaction?.remaining>0?.64:1;},
    impact(source,target,damage,action){
      if(!source?.object?.uuid||!target?.object?.uuid||!action?.id)return;
      events.push(Object.freeze({id:`battle-${battle}:impact:${++serial}`,type:'impact',attackId:action.id,
        sourceId:source.object.uuid,targetId:target.object.uuid,phase:action.phase,
        techniqueId:action.techniqueId,damage}));
    },
    inspect,
    snapshot(){return Object.freeze({battle,mode:'johakyu-review',events:Object.freeze(events.slice()),actors:actors.size});}
  });
}
