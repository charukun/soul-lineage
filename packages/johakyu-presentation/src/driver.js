/** Presentation only: there is intentionally no damage, RNG, save or tick port. */
export function createCanonicalPresentationDriver(port){
  const actors=new Map(),seen=new Set();let key=null,revision=-1,disposed=false;
  function reset(){for(const actor of actors.values())port.remove(actor);actors.clear();seen.clear();key=null;revision=-1;port.clear?.();}
  function present(frame,dt=0,events=[]){
    if(disposed)throw Error('Presentation is disposed');
    if(frame?.authority!=='rinne-domain'||frame.version!==1||!Array.isArray(frame.actors))throw Error('Canonical battle frame required');
    if(frame.actors.length>64||new Set(frame.actors.map(row=>row.id)).size!==frame.actors.length)throw Error('Invalid canonical actor roster');
    if(!Number.isFinite(dt)||dt<0||dt>.25)throw Error('Invalid real-time presentation delta');
    const nextKey=`${frame.battleId}:${frame.epoch}`;
    if(nextKey===key&&frame.revision<revision)return {accepted:false,reason:'stale'};
    // Reject unsupported art/animation before partially changing a visible scene.
    for(const row of frame.actors){const support=port.supports(row);if(!support.supported)return {accepted:false,reason:support.reason,actorId:row.id};}
    const changed=nextKey!==key;
    if(changed){reset();key=nextKey;}
    revision=frame.revision;
    const ids=new Set(frame.actors.map(row=>row.id));
    for(const [id,actor] of actors)if(!ids.has(id)){port.remove(actor);actors.delete(id);}
    for(const row of frame.actors){
      let actor=actors.get(row.id);if(!actor){actor=port.spawn(row);actors.set(row.id,actor);}
      port.update(actor,row,dt,{initial:changed});
      if(row.self)port.self?.(actor);
    }
    port.environment?.(frame.obstacles,frame.projectiles);
    // Resume/renderer switch starts from a snapshot, not the last impact batch.
    if(!changed)for(const event of events){
      if(!event?.id||seen.has(event.id))continue;
      seen.add(event.id);if(seen.size>512)seen.delete(seen.values().next().value);
      const defenseEvent=event.type==='guard'||event.type==='parry';
      if((event.blocked&&!defenseEvent)||(['player-hit','enemy-hit'].includes(event.type)&&!(event.damage>0)))continue;
      const target=actors.get(event.targetId),source=actors.get(event.sourceId);
      if(!target||(['player-hit','enemy-hit'].includes(event.type)&&!source))continue;
      port.impact?.(event,source,target);
    }
    port.draw?.(frame,dt);
    return {accepted:true,actors:actors.size,battleId:frame.battleId,revision};
  }
  return Object.freeze({present,reset,dispose(){if(disposed)return;reset();disposed=true;},metrics:()=>({actors:actors.size,eventKeys:seen.size,battleId:key,revision})});
}
