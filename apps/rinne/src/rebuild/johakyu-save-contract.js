/** Persistence validation only. Never repairs a corrupt life by starting anew. */
const PARTS=Object.freeze(['head','torso','leftArm','rightArm','leftLeg','rightLeg']);
export function readSavedBody(raw){
  if(raw==null)return Object.fromEntries(PARTS.map(part=>[part,{severity:0,at:0}]));
  if(typeof raw!=='object'||Array.isArray(raw))throw Error('部位の保存データが不正です。');
  return Object.fromEntries(PARTS.map(part=>{
    const row=raw[part];
    if(row==null)return[part,{severity:0,at:0}]; // pre-six-part saves
    const severity=typeof row==='number'?row:row.severity,at=typeof row==='number'?0:row.at??0;
    if(typeof severity!=='number'||!Number.isFinite(severity)||severity<0||severity>1||typeof at!=='number'||!Number.isFinite(at)||at<0)throw Error('部位の保存データが不正です。');
    return[part,{severity,at}];
  }));
}
/** Strip derived pose/executor snapshots, not damage, injuries, projectiles or results. */
export function clearSavedPresentation(state){
  if(state.combat){delete state.combat.tidebreakPose;delete state.combat.exchange;delete state.combat.hudState;}
  if(state.inspiration)delete state.inspiration.execution;
  for(const enemy of state.frontState?.enemies||[])enemy.tidebreakPose=null;
  return state;
}

export function readSavedTerrain(raw){
  if(raw==null)return null;
  if(raw.version!==1||!Array.isArray(raw.obstacles)||raw.obstacles.length>24)throw Error('地形の保存データが不正です。');
  const ids=new Set();const obstacles=raw.obstacles.map(row=>{
    if(!row||typeof row.id!=='string'||!row.id||ids.has(row.id)||!['x','z','w','d','h'].every(k=>typeof row[k]==='number'&&Number.isFinite(row[k]))||Math.abs(row.x)>30||Math.abs(row.z)>30||['w','d','h'].some(k=>row[k]<=0||row[k]>20))throw Error('地形の保存データが不正です。');
    ids.add(row.id);return {id:row.id,x:row.x,z:row.z,w:row.w,d:row.d,h:row.h};
  });
  return {version:1,obstacles};
}
