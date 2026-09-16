const distance=(a,b)=>Math.hypot((a?.x||0)-(b?.x||0),(a?.z||0)-(b?.z||0));
const target=(row,label=row?.label)=>row?{x:row.x,z:row.z,label}:null;
const score=(state,kind)=>Number(state.experiences?.[kind]?.score||0);
const SUPPORT_EXPERIENCES=Object.freeze(['breathe','balance','fall','focus','sense','adapt','read','observe','maintain','care','rest']);

function stationById(stations,id){return stations.find(row=>row.id===id)||null;}
function supportCount(state){return (state.knownSkills||[]).filter(id=>id.startsWith('skill.')).length;}
function actionCount(state){return (state.knownSkills||[]).filter(id=>id.startsWith('action.')).length;}
function housingSeen(state){return SUPPORT_EXPERIENCES.some(kind=>score(state,kind)>0);}

function practiceStation(state,stations){
  const rows=stations.filter(row=>row.activity&&!row.interiorId&&row.id!=='port-prayer'&&!row.trainingDummy);
  return rows.sort((a,b)=>score(state,a.activity)-score(state,b.activity)||distance(state.position,a)-distance(state.position,b))[0]||null;
}
function interiorStation(state,stations){
  const id=state.interior?.buildingId;if(!id)return null;
  const rows=stations.filter(row=>row.interiorId===id&&row.activity);
  return rows.sort((a,b)=>score(state,a.activity)-score(state,b.activity)||distance(state.position,a)-distance(state.position,b))[0]||null;
}
function housingDoor(state,stations){
  const rows=stations.filter(row=>row.enterInterior);
  const priority=row=>/空き家|邸宅|宿屋|学校|道場/.test(row.label)?0:1;
  return rows.sort((a,b)=>priority(a)-priority(b)||distance(state.position,a)-distance(state.position,b))[0]||null;
}
function weaponStation(state,stations){
  const rows=stations.filter(row=>row.equipment?.weapon&&row.equipment.weapon!=='fist'&&!row.interiorId);
  return rows.sort((a,b)=>distance(state.position,a)-distance(state.position,b))[0]||null;
}

function nextDepartureAge(state){return Math.max(15,(Math.max(2,Number(state.lastDepartureCycle)||2)+1)*5);}
function villageStage(state,age){
  if(age<7)return '2/6 村';
  if(age<15)return '3/6 修行';
  return Number(state.returns||0)>0?'5/6 凱旋':'3/6 支度';
}
function activityLabel(row){return row?.actionLabel||row?.label||'暮らす';}

export function guidanceFor({state,stations=[],front=null}){
  const age=Number(state.ageYears)||0;
  if(state.ended||state.phase==='ended')return {stage:'6/6 輪廻',objective:'記憶を選ぶ',badge:'転生',target:null,tone:'rebirth'};
  if(state.down){
    const rescue=Number(state.down.rescueSeconds)||40,remain=Math.max(0,rescue-Number(state.down.elapsed||0));
    return {stage:'5/6 救助',objective:'救助待ち',badge:`${Math.ceil(remain)}秒`,target:null,tone:'down'};
  }
  if(state.zone==='frontier'){
    const living=(front?.enemies||[]).filter(enemy=>!enemy.dead);
    if(living.length){
      const enemy=[...living].sort((a,b)=>distance(state.position,a)-distance(state.position,b))[0];
      return {stage:`4/6 第${state.front+1}前線`,objective:state.combat?'戦闘':'敵へ',badge:`敵 ${living.length}`,target:target(enemy,'敵'),tone:'danger'};
    }
    if(front?.cleared&&state.front<5)return {stage:`4/6 第${state.front+1}前線`,objective:'奥へ',badge:'突破',target:{x:0,z:-6.05,label:'次の前線'},tone:'clear'};
    return {stage:'5/6 帰還',objective:'帰還へ',badge:'突破',target:{x:0,z:5.2,label:'帰還地点'},tone:'clear'};
  }
  if(state.phase==='birth')return {stage:'1/6 誕生',objective:'母と村巡り',badge:'自立 4歳',target:null,tone:'calm'};
  if(state.activity){
    const station=stationById(stations,state.activity.stationId),remain=Math.max(0,8-Number(state.activity.elapsed||0));
    return {stage:villageStage(state,age),objective:state.activity.label,badge:`${Math.ceil(remain)}秒`,target:target(station,state.activity.label),tone:'activity'};
  }
  if(state.interior){
    const station=interiorStation(state,stations),exit=stations.find(row=>row.exitInterior&&row.interiorId===state.interior.buildingId);
    if(station)return {stage:villageStage(state,age),objective:activityLabel(station),badge:'暮らしから閃く',target:target(station,activityLabel(station)),tone:'home'};
    return {stage:villageStage(state,age),objective:'外へ',badge:'村へ戻る',target:target(exit,'外へ'),tone:'home'};
  }

  const practice=practiceStation(state,stations),dummy=stationById(stations,'training-dummy'),door=housingDoor(state,stations);
  if(age<7){
    if(!housingSeen(state)&&door)return {stage:'2/6 村',objective:`${door.label}へ入る`,badge:'暮らしを見る',target:target(door,door.label),tone:'home'};
    if(dummy&&score(state,'practice')<1.6)return {stage:'2/6 修行',objective:'かかしへ',badge:`閃き ${supportCount(state)}`,target:target(dummy,'かかし'),tone:'prepare'};
    return {stage:'2/6 村',objective:activityLabel(practice),badge:'武具 7歳',target:target(practice,activityLabel(practice)),tone:'calm'};
  }
  if(age<15&&state.equipment?.weapon==='fist'){
    const rack=weaponStation(state,stations);
    return {stage:'3/6 支度',objective:'武具を選ぶ',badge:'出航 15歳',target:target(rack,rack?.label||'武具'),tone:'prepare'};
  }
  if(age<15){
    if(dummy&&(actionCount(state)<2||score(state,'practice')<3.2))return {stage:'3/6 修行',objective:'かかしへ',badge:`技 ${actionCount(state)}`,target:target(dummy,'かかし'),tone:'prepare'};
    return {stage:'3/6 支度',objective:activityLabel(practice),badge:'出航 15歳',target:target(practice,activityLabel(practice)),tone:'prepare'};
  }
  const port=stationById(stations,'port-prayer');
  const canLeave=state.phase==='living'&&!state.combat&&!state.interior&&Math.floor(age/5)>Number(state.lastDepartureCycle||0);
  if(canLeave)return {stage:'4/6 出立',objective:'港へ',badge:'出航',target:target(port,'港'),tone:'urgent'};
  if(dummy&&actionCount(state)<3)return {stage:Number(state.returns||0)>0?'5/6 凱旋':'3/6 修行',objective:'かかしへ',badge:`技 ${actionCount(state)}`,target:target(dummy,'かかし'),tone:'prepare'};
  const nextAge=nextDepartureAge(state),returned=Number(state.returns||0)>0;
  return {stage:returned?'5/6 凱旋':'3/6 支度',objective:activityLabel(practice),badge:`次 ${nextAge}歳`,target:target(practice,activityLabel(practice)),tone:returned?'home':'prepare'};
}

export function guidanceDistance(state,guidance){return guidance?.target?distance(state.position,guidance.target):null;}
