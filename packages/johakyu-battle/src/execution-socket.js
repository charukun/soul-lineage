const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

/** Ground-plane socket is deterministic and belongs to the shared battle authority. */
export function executionSockets(victim,{bounds,blocked=()=>false,actors=[],executor}={}){
 const yaw=Number(victim.yaw)||0,forward={x:Math.sin(yaw),z:Math.cos(yaw)},right={x:forward.z,z:-forward.x};
 const candidates=[];
 for(const side of [-1,1])for(const longitudinal of [.28,-.16]){
  const position={x:victim.position.x+right.x*side*1.28+forward.x*longitudinal,z:victim.position.z+right.z*side*1.28+forward.z*longitudinal};
  if(bounds&&(position.x<bounds.minX+.3||position.x>bounds.maxX-.3||position.z<bounds.minZ+.3||position.z>bounds.maxZ-.3))continue;
  if(blocked(executor?.position||position,position,executor)||blocked(position,victim.position,executor))continue;
  const clearance=Math.min(3,...actors.filter(a=>a.id!==victim.id&&a.id!==executor?.id&&!a.dead).map(a=>distance(position,a.position)));
  if(clearance<.92)continue;
  const approach=executor?distance(executor.position,position):0;
  candidates.push({position,side:side<0?'left':'right',anchor:longitudinal>0?'upper-torso':'torso',yaw:Math.atan2(victim.position.x-position.x,victim.position.z-position.z),groundNormal:{x:0,y:1,z:0},score:approach+Math.max(0,1.8-clearance)*2});
 }
 return candidates.sort((a,b)=>a.score-b.score||a.side.localeCompare(b.side)||a.anchor.localeCompare(b.anchor));
}
