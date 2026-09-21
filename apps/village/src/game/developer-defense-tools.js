import {defs} from './core.js';
import {activeDefenseProposal,recordDefensePressure} from './defense-autonomy.js';

const DIRECTIONS=[
 {id:'east',label:'東側',x:1,z:0},
 {id:'north',label:'北側',x:0,z:1},
 {id:'west',label:'西側',x:-1,z:0},
 {id:'south',label:'南側',x:0,z:-1},
];

function villageCenter(world){
 const fire=world.objects.find(o=>o.kind==='campfire');
 return fire?{x:fire.x,z:fire.z}:{x:0,z:0};
}
function guard(world){return world.people.find(p=>p.id==='guard-npc')||world.people.find(p=>p.role==='guard')||world.people[0]||null;}
function focusAt(point,span=30){return point?{x:Number(point.x)||0,z:Number(point.z)||0,span}:null;}
function freePointNear(sim,anchor,{start=7,end=22}={}){
 for(let radius=start;radius<=end;radius+=3)for(let i=0;i<12;i++){
  const angle=i*Math.PI/6,x=anchor.x+Math.cos(angle)*radius,z=anchor.z+Math.sin(angle)*radius;
  if(!sim.nav.worldBlocked(x,z))return{x,z};
 }
 return{x:anchor.x+start,z:anchor.z};
}
function ensureWood(world,amount=4){
 if((world.state.stock.wood||0)<amount)world.gain('wood',amount-(world.state.stock.wood||0));
}
function nearbyDefenseCount(world,point){
 return world.objects.filter(o=>defs[o.kind]?.defense&&Math.hypot(o.x-point.x,o.z-point.z)<12).length;
}

export function runDeveloperDefenseScenario(kind,{world,sim}){
 if(!world||!sim)return{error:'防衛テストを開始できません'};

 if(kind==='wildlife'){
  const anchor=guard(world)||villageCenter(world),point=freePointNear(sim,anchor,{start:8,end:17});
  const wolf={id:'wild'+world.state.nextId++,name:'狼',species:'wolf',hostile:true,x:point.x,z:point.z,health:35,damage:5,speed:2.1,homeX:point.x,homeZ:point.z,seed:17,angle:0,path:[],repath:0,moving:false};
  world.state.wildlife.push(wolf);world.changed();sim.emit('開発テスト：狼が村の近くに現れました','threat');
  return{ok:true,message:'狼を出しました。護衛の迎撃を確認できます。',focus:focusAt(anchor,28)};
 }

 if(kind==='raid-warning'){
  if(sim.raid?.phase==='active')return{error:'すでに襲撃中です。終了後に警告テストを実行してください。'};
  if(!sim.raid)sim.startRaid();
  const point=sim.raid?.approach||guard(world)||villageCenter(world);
  world.changed();
  return{ok:true,message:'襲撃警告を発生させました。住民の帰宅と護衛の先回りを確認できます。',focus:focusAt(point,40)};
 }

 if(kind==='raid-now'){
  if(!sim.raid)sim.startRaid({immediate:true});
  else if(sim.raid.phase==='warning'){sim.raid.startDay=world.state.clock;sim.updateRaid(0);}
  else return{error:'すでに襲撃中です。'};
  world.changed();
  const point=sim.raid?.monsters?.[0]||guard(world)||villageCenter(world);
  return{ok:true,message:'襲撃を開始しました。護衛の迎撃と住民の避難を確認できます。',focus:focusAt(point,38)};
 }

 if(kind==='repeat-direction'){
  ensureWood(world,4);
  const center=villageCenter(world),direction=[...DIRECTIONS].sort((a,b)=>{
   const pa={x:center.x+a.x*25,z:center.z+a.z*25},pb={x:center.x+b.x*25,z:center.z+b.z*25};
   return nearbyDefenseCount(world,pa)-nearbyDefenseCount(world,pb);
  })[0],point={x:center.x+direction.x*60,z:center.z+direction.z*60};
  recordDefensePressure(world,point,{source:'developer'});
  const result=recordDefensePressure(world,point,{source:'developer'}),proposal=activeDefenseProposal(world)||result.proposal;
  world.changed();
  if(!proposal)return{error:'防衛提案を作れませんでした。別の方向に防衛設備が集中していないか確認してください。'};
  sim.emit(`開発テスト：${proposal.side}から危険が繰り返されました`,'life');
  return{ok:true,message:`${proposal.side}の危険を2回記録しました。「村の気配」に防衛提案が出ます。`,focus:focusAt(proposal,32)};
 }

 if(kind==='damage-defense'){
  const g=guard(world),anchor=g||villageCenter(world);
  let target=world.objects.filter(o=>defs[o.kind]?.defense&&Math.hypot(o.x-anchor.x,o.z-anchor.z)<56).sort((a,b)=>Math.hypot(a.x-anchor.x,a.z-anchor.z)-Math.hypot(b.x-anchor.x,b.z-anchor.z))[0];
  let created=false;
  if(!target){
   ensureWood(world,4);
   for(let radius=7;radius<=24&&!target;radius+=3)for(let i=0;i<12&&!target;i++){
    const angle=i*Math.PI/6,x=anchor.x+Math.cos(angle)*radius,z=anchor.z+Math.sin(angle)*radius,rot=angle+Math.PI/2;
    if(world.canPlace('fence',x,z,rot))continue;
    const added=world.add('fence',x,z,rot);if(added.ok){target=added.object;created=true;}
   }
  }
  if(!target)return{error:'破損テスト用の防衛設備を置ける場所がありません。'};
  target.damage=Math.max(35,target.damage||0);world.changed();
  sim.emit(`開発テスト：${defs[target.kind].label}が破損しました`,'threat');
  return{ok:true,message:`${created?'テスト用の柵を置いて、':' '}${defs[target.kind].label}を破損させました。安全になると護衛が応急修理します。`.trim(),focus:focusAt(target,26)};
 }

 return{error:'不明な防衛テストです'};
}
