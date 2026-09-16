export function enterInteriorState(state,station){
  if(!station?.enterInterior||!station.buildingId||state.interior||state.zone!=='village'||state.phase!=='living'||state.combat||state.ended)return false;
  const outside=station.outsideSpawn||state.position,inside=station.interiorSpawn||{x:0,z:3.4};
  state.interior={buildingId:station.buildingId,returnPosition:{x:outside.x,z:outside.z}};
  state.position={x:inside.x,z:inside.z};state.activity=null;state.resting=false;state.idleSeconds=0;
  return true;
}

export function leaveInteriorState(state){
  if(!state.interior||state.zone!=='village')return false;
  const back=state.interior.returnPosition;state.position={x:back.x,z:back.z};state.interior=null;state.activity=null;state.resting=false;state.idleSeconds=0;
  return true;
}
