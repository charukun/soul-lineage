import { defs } from '@soul/world/mura';
import { journeyFor } from './village-journey.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const dimensions=item=>({w:Math.min(2.3,defs[item.kind]?.w||1.2),d:Math.min(2.3,defs[item.kind]?.d||1.2)});

/** Project an activity onto a free place beside its existing furniture.
 * The renderer remains the collision authority; no room or saved layout is edited. */
export function interiorActivityPlace(item,room,building){
  const {w,d}=dimensions(item),angle=item.rot||0,c=Math.cos(angle),s=Math.sin(angle),radius=.32;
  const free=p=>{
    if(Math.abs(p.x)>=(building.w||10)/2-.7-radius||Math.abs(p.z)>=(building.d||10)/2-.7-radius)return false;
    return !room.some(other=>{
      if(!defs[other.kind])return false;
      const shape=dimensions(other),a=other.rot||0,co=Math.cos(a),si=Math.sin(a),dx=p.x-other.x,dz=p.z-other.z;
      return Math.abs(dx*co-dz*si)<shape.w/2+radius*.72&&Math.abs(dx*si+dz*co)<shape.d/2+radius*.72;
    });
  };
  for(const margin of [.45,.7,1]){
    const candidates=[[0,d/2+margin],[w/2+margin,0],[-w/2-margin,0],[0,-d/2-margin],
      [w/2+margin,d/2+margin],[-w/2-margin,d/2+margin],[w/2+margin,-d/2-margin],[-w/2-margin,-d/2-margin]]
      .map(([x,z])=>({x:item.x+x*c+z*s,z:item.z-x*s+z*c}))
      .filter(free).sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z));
    if(candidates.length)return candidates[0];
  }
  // A completely packed custom room must not advertise a point inside a collider.
  return null;
}

export function interiorLifeActivity(buildingKind,itemKind,fallback){
  if(buildingKind==='chapel'){
    if(itemKind==='table')return ['pray','祭壇で祈る'];
    if(itemKind==='bench')return ['breathe','祈りの前に呼吸を整える'];
  }
  return fallback;
}

/** Keep reading, breath and prayer on one short circuit in the built-in village.
 * Shared/custom villages have no journey context and remain authoritative. */
export function registerVillageLifeCircuit(stations){
  const context=journeyFor(stations);
  if(!context)return stations;
  const id='journey.chapel-breathe';
  if(!stations.some(row=>row.id===id))stations.push({
    id,entityId:'birth-chapel',facilityKind:'chapel',label:'祈りの前に呼吸を整える',
    actionLabel:'祈りの前に呼吸を整える',activity:'breathe',x:13.5,z:13.5,radius:1.1,
  });
  const nodes=[{id:'life-reading',x:5.5,z:16,label:'読書の庭'},
    {id:'life-breath',x:13.5,z:13.5,label:'祈りの前の休み場'}];
  for(const node of nodes)if(!context.nodes.some(row=>row.id===node.id))context.nodes.push(node);
  for(const [from,to] of [['learning','life-reading'],['life-reading','life-breath'],['life-breath','prayer']]){
    if(!context.edges.some(row=>row.from===from&&row.to===to))context.edges.push({from,to,danger:false,width:1.8});
  }
  return stations;
}

/** Suggest lived episodes, never award skills or rewrite the player's loadout.
 * Repeated prayer still obeys the existing causal witnesses and named cooldown. */
export function nextVillageLifeStation(state,stations){
  if(!state||state.phase!=='living'||state.zone!=='village'||state.combat||state.down||state.ended||state.activity)return null;
  if(state.inspiration?.records?.['skill.patience']||state.knownSkills?.includes('skill.patience'))return null;
  const inside=state.interior?.buildingId||null;
  const rows=stations.filter(row=>row.activity&&!row.trainingDummy&&!row.port&&(inside?row.interiorId===inside:!row.interiorId));
  const experienced=kind=>(state.experiences?.[kind]?.count||state.experiences?.[kind]?.score||0)>0;
  const has=kind=>rows.some(row=>row.activity===kind);
  const prepared=experienced('read')||experienced('breathe')||experienced('observe');
  const kind=!experienced('read')&&!experienced('observe')&&has('read')?'read':
    !experienced('breathe')&&has('breathe')?'breathe':prepared?'pray':null;
  return rows.filter(row=>row.activity===kind).sort((a,b)=>distance(state.position,a)-distance(state.position,b))[0]||null;
}
