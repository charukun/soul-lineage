const distance=(a,b)=>Math.hypot((a?.x||0)-(b?.x||0),(a?.z||0)-(b?.z||0));
const target=(row,label=row?.label)=>row?{x:row.x,z:row.z,label}:null;
const score=(state,kind)=>Number(state.experiences?.[kind]?.score||0);

function stationById(stations,id){return stations.find(row=>row.id===id)||null;}

function practiceStation(state,stations){
  const rows=stations.filter(row=>row.activity&&row.id!=='port-prayer');
  return rows.sort((a,b)=>score(state,a.activity)-score(state,b.activity)||distance(state.position,a)-distance(state.position,b))[0]||null;
}

function weaponStation(state,stations){
  const rows=stations.filter(row=>row.equipment?.weapon&&row.equipment.weapon!=='fist');
  return rows.sort((a,b)=>distance(state.position,a)-distance(state.position,b))[0]||null;
}

function nextDepartureAge(state){
  return Math.max(15,(Math.max(2,Number(state.lastDepartureCycle)||2)+1)*5);
}

function yearsUntil(age,targetAge){return Math.max(0,targetAge-age);}
function villageStage(state,age){
  if(age<7)return '人生 2/6 · 村で育つ';
  if(age<15)return '人生 3/6 · 旅支度';
  return Number(state.returns||0)>0?'人生 5/6 · 凱旋':'人生 3/6 · 旅支度';
}

export function guidanceFor({state,stations=[],front=null}){
  const age=Number(state.ageYears)||0;
  if(state.ended||state.phase==='ended'){
    return {stage:'人生 6/6 · 輪廻',objective:'この生を次の自分へつなぐ',detail:'遺す記憶を選び、「次の人生へ」で転生します。',target:null,tone:'rebirth'};
  }
  if(state.down){
    const remain=Math.max(0,40-Number(state.down.elapsed||0));
    return {stage:'人生 5/6 · 救助',objective:'救助を待つ',detail:`あと${Math.ceil(remain)}秒で救助され、村へ戻ります。`,target:null,tone:'down'};
  }
  if(state.zone==='frontier'){
    const living=(front?.enemies||[]).filter(enemy=>!enemy.dead);
    if(living.length){
      const enemy=[...living].sort((a,b)=>distance(state.position,a)-distance(state.position,b))[0];
      const d=Math.ceil(distance(state.position,enemy));
      return {
        stage:`人生 4/6 · 第${state.front+1}前線`,
        objective:state.combat?'接触戦闘中。敵を退ける':'敵へ近づき、戦闘を始める',
        detail:`敵は残り${living.length}体${state.combat?'':' · 近づくと自動で戦います'}${Number.isFinite(d)?` · 最寄り${d}m`:''}`,
        target:target(enemy,'最寄りの敵'),tone:'danger',
      };
    }
    if(front?.cleared&&state.front<5){
      return {stage:`人生 4/6 · 第${state.front+1}前線 突破`,objective:'奥の門へ進み、次の前線へ',detail:`門を越えると第${state.front+2}前線へ進みます。`,target:{x:0,z:-6.05,label:'次の前線'},tone:'clear'};
    }
    return {stage:'人生 5/6 · 最終前線 突破',objective:'帰還地点へ戻り、村へ凱旋する',detail:'帰還地点まで戻ると、この遠征を終えて村へ帰ります。',target:{x:0,z:5.2,label:'帰還地点'},tone:'clear'};
  }
  if(state.phase==='birth'){
    const garden=stationById(stations,'garden');
    return {stage:'人生 1/6 · 誕生',objective:'母と村を歩き、世界を知る',detail:`4歳で自分の足の暮らしが始まります · あと${yearsUntil(age,4).toFixed(1)}年`,target:target(garden,'村の広場'),tone:'calm'};
  }
  if(state.activity){
    const station=stationById(stations,state.activity.stationId);
    const remain=Math.max(0,8-Number(state.activity.elapsed||0));
    return {stage:villageStage(state,age),objective:`${state.activity.label}を続ける`,detail:`あと${Math.ceil(remain)}秒 · 動くと中断します。`,target:target(station,state.activity.label),tone:'activity'};
  }
  const practice=practiceStation(state,stations);
  if(age<7){
    return {stage:'人生 2/6 · 村で育つ',objective:'村の暮らしを体験する',detail:`${practice?.actionLabel||'村の暮らし'}へ · 立ち止まると8秒で経験になります · 7歳で武具が解禁`,target:target(practice,practice?.actionLabel),tone:'calm'};
  }
  if(age<15&&state.equipment?.weapon==='fist'){
    const rack=weaponStation(state,stations);
    return {stage:'人生 3/6 · 旅支度',objective:'武具を選び、自分の戦い方を知る',detail:`武具棚のそばで立ち止まると装備します · 15歳まであと${yearsUntil(age,15).toFixed(1)}年`,target:target(rack,rack?.label||'武具棚'),tone:'prepare'};
  }
  if(age<15){
    return {stage:'人生 3/6 · 旅支度',objective:'村で経験を重ね、出航に備える',detail:`15歳で最初の遠征が解禁 · あと${yearsUntil(age,15).toFixed(1)}年 · ${practice?.actionLabel||'村の暮らし'}へ`,target:target(practice,practice?.actionLabel),tone:'prepare'};
  }
  const port=stationById(stations,'port-prayer');
  const canLeave=state.phase==='living'&&!state.combat&&Math.floor(age/5)>Number(state.lastDepartureCycle||0);
  if(canLeave){
    return {stage:'人生 4/6 · 出立',objective:'港へ行き、前線へ出立する',detail:'港で1.5秒立ち止まると出航 · 前線では敵に近づくと自動戦闘',target:target(port,'港'),tone:'urgent'};
  }
  const nextAge=nextDepartureAge(state),returned=Number(state.returns||0)>0;
  return {
    stage:returned?'人生 5/6 · 凱旋':'人生 3/6 · 旅支度',
    objective:returned?'村で暮らし、次の遠征に備える':'村で暮らし、次の出航に備える',
    detail:`次の出航は${nextAge}歳から · あと${yearsUntil(age,nextAge).toFixed(1)}年 · ${practice?.actionLabel||'村の暮らし'}へ`,
    target:target(practice,practice?.actionLabel),tone:returned?'home':'prepare',
  };
}

export function guidanceDistance(state,guidance){
  return guidance?.target?distance(state.position,guidance.target):null;
}
