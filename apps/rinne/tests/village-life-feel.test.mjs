import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { defs, muraBlocked } from '@soul/world/mura';
import { createLife, tickLife, setMoving, serializeLife, deserializeLife } from '../src/rebuild/domain.js';
import { buildStations, buildInteriors, normalizeLayout } from '../src/rebuild/locations.js';
import { journeyFor } from '../src/rebuild/village-journey.js';
import { journeySegmentClear } from '../src/rebuild/village-journey-navigation.js';
import { interiorActivityPlace, registerVillageLifeCircuit, nextVillageLifeStation } from '../src/rebuild/village-life-circuit.js';
import { isVillageLife, isVillageTap, createVillageWalkPlan, installVillageWalkInput } from '../src/rebuild/village-walk-input.js';
import { createLocomotion } from '../src/rebuild/locomotion.js';

const living=()=>Object.assign(createLife({seed:1552,name:'村歩き'}),{phase:'living',ageYears:5,ageSeconds:300,position:{x:0,z:3.75},resting:false});
const screenDirection=(a,b)=>{const length=Math.hypot(b.x-a.x,b.z-a.z);return {x:(b.x-a.x)/length,y:(b.z-a.z)/length};};
const pointer=(type,extra={})=>Object.assign(new Event(type),{pointerId:1,button:0,isPrimary:true,clientX:450,clientY:260,...extra});
function indoorFree(room,point){
  const r=.32;
  if(Math.abs(point.x)>=room.w/2-.7-r||Math.abs(point.z)>=room.d/2-.7-r)return false;
  return !room.room.some(item=>{const d=defs[item.kind];if(!d)return false;const x=point.x-item.x,z=point.z-item.z,c=Math.cos(item.rot||0),s=Math.sin(item.rot||0);return Math.abs(x*c-z*s)<Math.min(2.3,d.w||1.2)/2+r*.72&&Math.abs(x*s+z*c)<Math.min(2.3,d.d||1.2)/2+r*.72;});
}
function completeActivity(state,station,seconds=8){
  state.position={x:station.x,z:station.z};setMoving(state,false);const events=[];
  for(let i=0;i<seconds*4;i++)events.push(...tickLife(state,{realDelta:.25,station}));
  return events;
}

test('the built-in map has a walkable reading/breath/prayer circuit, without moving combat stations',()=>{
  const layout=normalizeLayout(),before=JSON.stringify(layout),stations=buildStations(layout),context=journeyFor(stations);
  assert.ok(context);assert.equal(JSON.stringify(layout),before);
  for(const id of ['library','journey.chapel-breathe','chapel']){
    const row=stations.find(s=>s.id===id);assert.ok(row,id);assert.equal(muraBlocked(layout,row.x,row.z,.32),false,id);
  }
  for(const [from,to] of [['learning','life-reading'],['life-reading','life-breath'],['life-breath','prayer']]){
    assert.ok(context.edges.some(e=>e.from===from&&e.to===to));
    assert.equal(journeySegmentClear(context,context.nodes.find(n=>n.id===from),context.nodes.find(n=>n.id===to)),true,`${from} -> ${to}`);
  }
  const count=stations.length,nodes=context.nodes.length,edges=context.edges.length;registerVillageLifeCircuit(stations);
  assert.deepEqual([stations.length,context.nodes.length,context.edges.length],[count,nodes,edges]);
  const dummy=stations.find(s=>s.id==='training-dummy');assert.deepEqual([dummy.x,dummy.z],[3,-11]);
  const custom=buildStations({...layout,id:'custom-life-map'});assert.equal(journeyFor(custom),null);assert.equal(custom.some(s=>s.id==='journey.chapel-breathe'),false);
});

test('interior activities are beside furniture and chapel tables are real prayer stations',()=>{
  const layout=normalizeLayout(),before=JSON.stringify(layout),interiors=buildInteriors(layout);
  const chapel=interiors.find(row=>row.kind==='chapel');assert.ok(chapel);
  assert.ok(chapel.stations.some(row=>row.activity==='pray'&&row.sourceKind==='table'));
  assert.ok(chapel.stations.some(row=>row.activity==='breathe'));
  let tested=0;
  for(const room of interiors)for(const station of room.stations.filter(row=>row.activity)){
    assert.equal(indoorFree(room,station),true,station.id);assert.ok(station.interactionPosition);tested++;
  }
  assert.ok(tested>20);assert.equal(JSON.stringify(layout),before);
  assert.equal(interiorActivityPlace({kind:'table',x:0,z:0},[{kind:'table',x:0,z:0}],{w:2,d:2}),null);
});

test('reading, breath and prayer use actual causal learning, preserve loadouts, and survive reload',()=>{
  const state=living(),stations=buildStations(normalizeLayout()),loadout=JSON.stringify(state.combatLoadout),weights=JSON.stringify(state.skillWeights),equipment=JSON.stringify(state.equipment);
  assert.equal(nextVillageLifeStation(state,stations)?.activity,'read');
  completeActivity(state,stations.find(s=>s.id==='library'));
  assert.equal(nextVillageLifeStation(state,stations)?.activity,'breathe');
  completeActivity(state,stations.find(s=>s.id==='journey.chapel-breathe'));
  assert.equal(nextVillageLifeStation(state,stations)?.activity,'pray');
  const events=completeActivity(state,stations.find(s=>s.id==='chapel'),112);
  assert.ok(events.some(e=>e.type==='inspiration'&&e.id==='skill.patience'));
  const record=state.inspiration.records['skill.patience'];assert.equal(record.kind,'heart');
  const traces=new Set(record.provenance.filter(p=>p.traceId).map(p=>p.traceId));assert.ok(traces.size>=2);
  assert.equal(state.combat,null);assert.equal(JSON.stringify(state.combatLoadout),loadout);assert.equal(JSON.stringify(state.skillWeights),weights);assert.equal(JSON.stringify(state.equipment),equipment);
  const restored=deserializeLife(serializeLife(state));assert.ok(restored.knownSkills.includes('skill.patience'));assert.equal(restored.experiences.pray.count,state.experiences.pray.count);
  assert.equal(nextVillageLifeStation(restored,stations),null);
  const onlyPrayer=living();completeActivity(onlyPrayer,stations.find(s=>s.id==='chapel'),112);
  assert.equal(onlyPrayer.knownSkills.includes('skill.patience'),false,'one repeated experience is not two causal witnesses');
});

test('short taps exclude hold, drag-return, cancellation and another pointer',()=>{
  const gesture={id:1,x:20,y:30,at:100,travel:0},up={type:'pointerup',pointerId:1,clientX:20,clientY:30};
  assert.equal(isVillageTap(gesture,up,200),true);
  assert.equal(isVillageTap(gesture,up,580),false);
  assert.equal(isVillageTap({...gesture,travel:25},up,200),false);
  assert.equal(isVillageTap(gesture,{...up,type:'pointercancel'},200),false);
  assert.equal(isVillageTap(gesture,{...up,pointerId:2},200),false);
});

test('tap walking feeds the existing locomotion and stops at its destination without editing state rules',()=>{
  let time=0;const state=living(),plan=createVillageWalkPlan({stations:[],canMoveTo:()=>true,screenDirection,now:()=>time}),locomotion=createLocomotion({canMoveTo:()=>true});
  assert.equal(plan.request(state,{x:5,z:3.75}),true);
  for(let i=0;i<300;i++){const axis=plan.axis(state);locomotion.step({state,direction:{x:axis.x,z:axis.y},speed:4.15,dt:.02});time+=20;}
  assert.equal(plan.target(),null);assert.ok(Math.hypot(state.position.x-5,state.position.z-3.75)<.3);
  assert.equal(state.combat,null);assert.equal(state.stamina,100);assert.deepEqual(state.equipment,{weapon:'fist',armor:'cloth',shield:false});
});

test('new walking never changes combat/frontier/birth/down input and cancels stale destinations',()=>{
  for(const change of [{combat:{targetId:'sentinel',phase:'jo'}},{zone:'frontier'},{phase:'birth'},{down:{elapsed:0}},{ended:true}]){
    const state=living(),plan=createVillageWalkPlan({stations:[],canMoveTo:()=>true,screenDirection});
    assert.equal(plan.request(state,{x:5,z:3.75}),true);Object.assign(state,change);const before=JSON.stringify(state),manual={x:.3,y:-.4};
    assert.equal(isVillageLife(state),false);assert.deepEqual(plan.axis(state,manual),manual);assert.equal(plan.target(),null);assert.equal(plan.request(state,{x:6,z:3.75}),false);assert.equal(JSON.stringify(state),before);
  }
  const state=living(),plan=createVillageWalkPlan({stations:[],canMoveTo:()=>true,screenDirection});plan.request(state,{x:5,z:3.75});state.interior={buildingId:'new-room'};assert.deepEqual(plan.axis(state),{x:0,y:0});assert.equal(plan.target(),null);
});

test('collision rejection, native blockage, manual override and stalled movement stop auto walk',()=>{
  let time=0,blocked=false;const state=living(),plan=createVillageWalkPlan({stations:[],canMoveTo:x=>!blocked&&x<6,screenDirection,now:()=>time});
  assert.equal(plan.request(state,{x:9,z:3.75}),false);assert.equal(plan.request(state,{x:NaN,z:0}),false);
  assert.equal(plan.request(state,{x:5,z:3.75}),true);blocked=true;assert.deepEqual(plan.axis(state),{x:0,y:0});assert.equal(plan.target(),null);
  blocked=false;plan.request(state,{x:5,z:3.75});const manual={x:0,y:1};assert.deepEqual(plan.axis(state,manual),manual);assert.equal(plan.target(),null);
  plan.request(state,{x:5,z:3.75});time=1000;assert.deepEqual(plan.axis(state),{x:0,y:0});assert.equal(plan.target(),null);
});

test('tapping an indoor prop selects its free activity point, not the blocked prop center',()=>{
  const state=living();state.interior={buildingId:'room'};state.position={x:0,z:2};
  const stations=[{id:'prayer',activity:'pray',x:1,z:0,interactionPosition:{x:0,z:0},radius:.92,interiorId:'room'}];
  const plan=createVillageWalkPlan({stations,canMoveTo:(x,z)=>Math.hypot(x,z)>.5,screenDirection});
  assert.equal(plan.request(state,{x:0,z:0}),true);assert.deepEqual(plan.target(),{id:'prayer',x:1,z:0,label:undefined});
});

test('DOM adapter uses the real camera ground ray and releases listeners on dispose',()=>{
  const canvas=new EventTarget(),doc=new EventTarget(),win=new EventTarget(),state=living();
  Object.assign(canvas,{ownerDocument:doc,getBoundingClientRect:()=>({left:0,top:0,width:640,height:480})});doc.defaultView=win;
  const camera=new THREE.PerspectiveCamera(45,640/480,.1,200);camera.position.set(0,10,10);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const adapter=installVillageWalkInput({canvas,view:{THREE,camera,canMoveTo:()=>true,screenDirection},stations:[],getState:()=>state});
  const before={...state.position};canvas.dispatchEvent(pointer('pointerdown'));canvas.dispatchEvent(pointer('pointerup'));
  assert.ok(Math.hypot(...Object.values(adapter.axis({x:0,y:0})))>.5);assert.deepEqual(state.position,before);
  win.dispatchEvent(new Event('blur'));assert.deepEqual(adapter.axis({x:0,y:0}),{x:0,y:0});
  canvas.dispatchEvent(pointer('pointerdown'));canvas.dispatchEvent(pointer('pointermove',{clientX:480}));canvas.dispatchEvent(pointer('pointerup'));assert.deepEqual(adapter.axis({x:0,y:0}),{x:0,y:0});
  adapter.dispose();canvas.dispatchEvent(pointer('pointerdown'));canvas.dispatchEvent(pointer('pointerup'));assert.deepEqual(adapter.axis({x:0,y:0}),{x:0,y:0});
});
