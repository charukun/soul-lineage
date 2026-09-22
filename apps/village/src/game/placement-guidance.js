import {defs, TUTORIAL} from './core.js';

/** Read-only search. Every suggested location passes the existing placement rules. */
export function findPlacementSite(world, pending) {
  if (!pending || !defs[pending.kind]) return null;
  const room = pending.roomId && world.object(pending.roomId);
  if (pending.roomId && !room) return null;
  const x = Number.isFinite(pending.x) ? pending.x : 0;
  const z = Number.isFinite(pending.z) ? pending.z : 0;
  const rot = pending.rot || 0;
  const valid = (x, z) => !world.canPlace(pending.kind, x, z, rot, pending.roomId, pending.moveId);
  const first = pending.kind === 'tent' && !pending.roomId && !pending.moveId && !world.objects.some(o => o.kind === 'tent');
  if (first) {
    const [tx, tz] = TUTORIAL.find(t => t.kind === 'tent').at;
    if (valid(tx, tz)) return {x:tx, z:tz};
  }
  if (valid(x, z)) return {x, z};
  const step = room ? .75 : 3;
  // Bounded search around the preview, never changes terrain, resources or residents.
  const rings = room ? Math.min(30, Math.ceil(Math.max(defs[room.kind].w, defs[room.kind].d) / step)) : 12;
  const cx = room ? 0 : x, cz = room ? 0 : z;
  for (let r=0; r<=rings; r++) {
    for (let i=-r; i<=r; i++) for (const j of r ? [-r,r] : [0]) {
      if (valid(cx+i*step, cz+j*step)) return {x:cx+i*step, z:cz+j*step};
    }
    for (let j=-r+1; j<r; j++) for (const i of [-r,r]) {
      if (valid(cx+i*step, cz+j*step)) return {x:cx+i*step, z:cz+j*step};
    }
  }
  return null;
}

export function commitPlacement(world, pending) {
  if (!pending) return {error:'先に配置するものを選んでください'};
  const p=pending, error=world.canPlace(p.kind,p.x,p.z,p.rot,p.roomId,p.moveId);
  if (error) return {error};
  const beds=world.population().openBeds;
  const result=p.moveId ? world.move(p.moveId,p.x,p.z,p.rot,p.roomId) : world.add(p.kind,p.x,p.z,p.rot,p.roomId,{material:p.material});
  if (result.error) return result;
  const addedBeds=world.population().openBeds-beds;
  return {...result, addedBeds, message:p.moveId?'移動しました':result.object?.phase==='planned'?'予定地を置きました。建材がそろうと住人が建てます':addedBeds>0?`寝床が${addedBeds}床増えました。旅人を迎える準備ができました`:p.roomId?'家具を配置しました':'配置しました'};
}
