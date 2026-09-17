import { ARMORS, LIFE_YEARS, WEAPONS } from './domain.js';

const distance=(a,b)=>Math.hypot((a?.x||0)-(b?.x||0),(a?.z||0)-(b?.z||0));
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const normalizeAngle=value=>{let angle=value;while(angle<=-Math.PI)angle+=Math.PI*2;while(angle>Math.PI)angle-=Math.PI*2;return angle;};
const DIRECTION_GLYPHS=Object.freeze(['↑','↗','→','↘','↓','↙','←','↖']);

function equipmentStations(stations=[]){return stations.filter(row=>row&&(row.equipmentAccess||row.equipment)&&Number.isFinite(row.x)&&Number.isFinite(row.z));}
function stationsForKind(stations,kind){
  const rows=equipmentStations(stations);
  if(kind==='weapon')return rows.filter(row=>Boolean(row.equipment?.weapon));
  if(kind==='armor')return rows.filter(row=>Boolean(row.armor||row.equipment?.armor));
  if(kind==='shield')return rows.filter(row=>Object.hasOwn(row.equipment||{},'shield'));
  return [];
}

export function equipmentAccess(state,{stations=[]}={}){
  if(!state)return{ok:false,reason:'人生を開始してください。',station:null};
  if(state.ended||state.phase==='ended')return{ok:false,reason:'この生涯は終わっています。',station:null};
  if(state.phase!=='living')return{ok:false,reason:'自立してから身支度できます。',station:null};
  if(Number(state.ageYears)<7)return{ok:false,reason:'武具は7歳から使えます。',station:null};
  if(state.down)return{ok:false,reason:'行動不能中は身支度できません。',station:null};
  if(state.combat)return{ok:false,reason:'戦闘中は身支度できません。',station:null};
  if(state.zone!=='village'||state.interior)return{ok:false,reason:'村の武具置き場で身支度してください。',station:null};
  const station=equipmentStations(stations).map(row=>({...row,d:distance(state.position,row)})).sort((a,b)=>a.d-b.d)[0]||null;
  if(!station||station.d>Number(station.equipmentRadius||1.55))return{ok:false,reason:'武具置き場のそばで身支度できます。',station:null};
  return{ok:true,reason:'',station};
}

export function requestEquipmentChange(state,{kind,value,stations=[]}={}){
  const relevant=stationsForKind(stations,kind);
  if(!relevant.length)return{ok:false,reason:'対応する武具置き場が見つかりません。',station:null};
  const access=equipmentAccess(state,{stations:relevant});
  if(!access.ok)return access;
  const inventory=state.inventory||{};
  if(kind==='weapon'){
    if(!WEAPONS[value])return{ok:false,reason:'選べない武器です。',station:access.station};
    if(!new Set([...(inventory.weapons||[]),state.equipment?.weapon]).has(value))return{ok:false,reason:'まだ所持していない武器です。',station:access.station};
  }else if(kind==='armor'){
    if(!ARMORS[value])return{ok:false,reason:'選べない防具です。',station:access.station};
    if(!new Set([...(inventory.armors||[]),state.equipment?.armor]).has(value))return{ok:false,reason:'まだ所持していない防具です。',station:access.station};
  }else if(kind==='shield'){
    value=Boolean(value);
    if(!new Set([...(inventory.shields||[]),Boolean(state.equipment?.shield)]).has(value))return{ok:false,reason:'まだ所持していない盾状態です。',station:access.station};
  }else return{ok:false,reason:'身支度の種類が不正です。',station:access.station};
  const before=state.equipment?.[kind];
  if(before===value)return{ok:true,changed:false,reason:'',station:access.station,equipment:{...state.equipment}};
  state.equipment={...state.equipment,[kind]:value};
  if(kind==='weapon'&&WEAPONS[value]?.skill){state.knownSkills=Array.isArray(state.knownSkills)?state.knownSkills:[];if(!state.knownSkills.includes(WEAPONS[value].skill))state.knownSkills.push(WEAPONS[value].skill);}
  return{ok:true,changed:true,reason:'',station:access.station,equipment:{...state.equipment}};
}

export function objectiveNavigation(state,guide){
  const target=guide?.target;
  if(!state?.position||!target||!Number.isFinite(target.x)||!Number.isFinite(target.z))return null;
  const dx=target.x-state.position.x,dz=target.z-state.position.z,meters=Math.hypot(dx,dz);
  const targetYaw=Math.atan2(dx,dz),relative=normalizeAngle(targetYaw-(Number(state.yaw)||0));
  const octant=(Math.round(relative/(Math.PI/4))+8)%8;
  const glyph=DIRECTION_GLYPHS[octant]||'↑';
  const rounded=meters<10?Math.round(meters*10)/10:Math.round(meters);
  return{targetId:String(target.id||target.label||'target'),label:String(target.label||'目的地'),glyph,distance:clamp(rounded,0,9999),text:`${glyph} ${String(target.label||'目的地')} · ${rounded}m`,x:target.x,z:target.z};
}

export function rebirthPreview(state,{villageLabel='出生先'}={}){
  const lineageCount=Math.max(0,Number(state?.lineage?.length)||0)+1,homelandCount=Math.max(0,Number(state?.homelands?.length)||0);
  return{lifeYears:LIFE_YEARS,preserved:[`一族の記録 · ${lineageCount}代分`,`帰還して刻んだ故郷 · ${homelandCount}件`,'ゲーム全体の設定'],reset:['年齢・体力・傷・行動状態','装備・所持品','序破急・心得・構えの編成','この生涯の経験記録'],destination:String(villageLabel||'出生先')};
}
