import { ARMORS, WEAPONS } from './domain.js';

const distance=(a,b)=>Math.hypot((a?.x||0)-(b?.x||0),(a?.z||0)-(b?.z||0));
const EQUIPMENT_RADIUS=2.25;
export function equipmentAccess(state,stations=[]){
  if(!state||state.ended)return{ok:false,reason:'この生涯は終わっています。',station:null};
  if(state.down)return{ok:false,reason:'行動不能中は装備を替えられません。',station:null};
  if(state.phase!=='living'||Number(state.ageYears)<7)return{ok:false,reason:'武具は7歳から扱えます。',station:null};
  if(state.combat)return{ok:false,reason:'戦闘中は装備を替えられません。',station:null};
  if(state.zone!=='village'||state.interior)return{ok:false,reason:'村の武具置き場で装備を替えられます。',station:null};
  const station=stations.filter(row=>row?.equipment&&!row.interiorId).map(row=>({...row,d:distance(state.position,row)})).sort((a,b)=>a.d-b.d)[0]||null;
  if(!station||station.d>EQUIPMENT_RADIUS)return{ok:false,reason:'武具置き場の近くで装備を替えられます。',station};
  return{ok:true,reason:'装備変更可',station};
}
function owns(state,kind,value){
  if(kind==='weapon')return (state.inventory?.weapons||[]).includes(value);
  if(kind==='armor')return (state.inventory?.armors||[]).includes(value);
  if(kind==='shield')return (state.inventory?.shields||[]).some(item=>Boolean(item)===Boolean(value));
  return false;
}
export function requestEquip(state,{kind,value}={},stations=[]){
  const access=equipmentAccess(state,stations);if(!access.ok)return access;
  if(!owns(state,kind,value))return{ok:false,reason:'まだ所持していない装備です。',station:access.station};
  if(kind==='weapon'&&!WEAPONS[value])return{ok:false,reason:'扱えない武器です。',station:access.station};
  if(kind==='armor'&&!ARMORS[value])return{ok:false,reason:'扱えない防具です。',station:access.station};
  if(kind==='shield'&&typeof value!=='boolean')return{ok:false,reason:'盾の指定が不正です。',station:access.station};
  state.equipment={...state.equipment,[kind]:kind==='shield'?Boolean(value):value};
  return{ok:true,reason:'装備を替えました。',station:access.station,equipment:{...state.equipment}};
}
