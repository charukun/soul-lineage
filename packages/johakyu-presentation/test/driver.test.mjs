import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanonicalPresentationDriver} from '../src/driver.js';
const frame=(extra={})=>({version:1,authority:'rinne-domain',battleId:'life:1:front:0',epoch:1,revision:1,actors:[{id:'hero',self:true},{id:'ally'},{id:'enemy'},{id:'enemy2'}],obstacles:[],projectiles:[],...extra});
function setup(){const log={spawns:0,removes:0,hits:[],updates:0};const driver=createCanonicalPresentationDriver({supports:row=>({supported:!row.unsupported,reason:'missing-authored-clip'}),spawn:row=>{log.spawns++;return {id:row.id};},remove:()=>log.removes++,update:()=>log.updates++,impact:event=>log.hits.push(event.id)});return {driver,log};}
test('P5 multiple canonical actors preserve IDs, selection and idempotent semantic impacts',()=>{
  const {driver,log}=setup(),first=frame();driver.present(first,.016);
  const hit={id:'attack-1:hero:enemy',sourceId:'hero',targetId:'enemy',type:'player-hit',damage:4};
  driver.present(frame({revision:2}),.016,[hit,hit]);driver.present(frame({revision:3}),.016,[hit]);
  assert.equal(log.spawns,4);assert.deepEqual(log.hits,[hit.id]);
  assert.equal(driver.present(frame({revision:2}),.016,[{...hit,id:'old'}]).reason,'stale');
  driver.present(frame({revision:4,actors:[{id:'hero',self:true},{id:'enemy2'}]}),.016);assert.equal(log.removes,2);assert.equal(driver.metrics().actors,2);
});
test('P6 resume resets transient actors and never replays the checkpoint impact',()=>{
  const {driver,log}=setup(),hit={id:'old',sourceId:'hero',targetId:'enemy',type:'player-hit',damage:4};
  driver.present(frame(),.016);driver.present(frame({revision:2}),.016,[hit]);
  driver.present(frame({epoch:2,revision:0}),0,[hit]);assert.deepEqual(log.hits,['old']);assert.equal(log.removes,4);
  assert.equal(driver.metrics().actors,4);driver.dispose();driver.dispose();assert.equal(log.removes,8);
});
test('P7 unavailable artwork rejects the entire frame without placeholders or partial mutation',()=>{
  const {driver,log}=setup();assert.equal(driver.present(frame({actors:[{id:'hero'},{id:'other',unsupported:true}]}),.016).accepted,false);
  assert.equal(log.spawns,0);assert.equal(log.updates,0);
  assert.throws(()=>driver.present({...frame(),authority:'native-demo'}),/Canonical/);
  assert.throws(()=>driver.present(frame(),NaN),/delta/);
});
test('P7 long-session presentation remains bounded across 120 encounters and repeated join/leave',()=>{
  const {driver,log}=setup();for(let encounter=0;encounter<120;encounter++)for(let i=0;i<100;i++){
    const hit={id:`hit-${encounter}-${i}`,sourceId:'hero',targetId:'enemy',type:'player-hit',damage:1};
    driver.present(frame({battleId:'encounter-'+encounter,revision:i}),.016,[hit]);
    assert.ok(driver.metrics().actors<=4);assert.ok(driver.metrics().eventKeys<=512);
  }
  assert.equal(log.spawns-log.removes,4);driver.dispose();assert.equal(log.spawns,log.removes);
});

test('P7 explicit clear resets replay identity and accommodates a full 30-player shared roster',()=>{
  const {driver,log}=setup();const full=frame({actors:Array.from({length:35},(_,i)=>({id:'actor-'+i,self:i===0}))});driver.present(full,.016);assert.equal(log.spawns,35);driver.reset();
  const hit={id:'checkpoint',sourceId:'actor-0',targetId:'actor-30',type:'player-hit',damage:1};driver.present(full,0,[hit]);assert.deepEqual(log.hits,[]);assert.equal(driver.metrics().actors,35);driver.dispose();assert.equal(log.spawns,log.removes);
});
