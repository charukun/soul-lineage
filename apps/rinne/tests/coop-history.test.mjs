import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultMuraLayout } from '@soul/world/mura';
import { CoopWorld } from '../src/rebuild/coop-world.js';
import { LIFE_SECONDS } from '../src/rebuild/domain.js';
import { createHistoryStore } from '../src/coop/history-store.js';
import { createCheckpointWriter } from '../src/coop/checkpoint-writer.js';
import { applyRebirthIntent } from '../src/coop/history.js';

const room=()=>new CoopWorld({worldId:'history-room',ownerId:'owner',name:'Host',layout:defaultMuraLayout()});
function fixture(){
  const data=new Map();let queue=Promise.resolve(),loseAck=false;
  const storage={read:async key=>data.get(key)??null,write:async(key,value)=>{data.set(key,value);if(loseAck){loseAck=false;throw Error('response lost');}}};
  const store=createHistoryStore({storage,exclusive:(_id,fn)=>{const job=queue.then(fn);queue=job.catch(()=>{});return job;}});
  return{store,data,loseAck:()=>{loseAck=true;}};
}
const end=world=>{world.data.players.owner.life.ageSeconds=LIFE_SECONDS-.01;world.data.players.owner.life.ageYears=99.99;world.advance(.05);};

test('atomic history/checkpoint survives lost ACK, store reopen and old-life retransmission',async()=>{
  const f=fixture(),world=room();await f.store.commit(world.save(),{writeId:'1:0',acquire:true});
  end(world);f.loseAck();const sealed=await f.store.commit(world.save(),{writeId:'1:1'});
  assert.equal(sealed.historySequence,2);const checkpoint=await f.store.restore(world.data.worldId);
  const intent={playerId:'owner',lifeId:'owner:1',villageId:null};applyRebirthIntent(world,checkpoint,intent);
  await f.store.commit(world.save(),{writeId:'1:2'});
  const saved=await f.store.restore(world.data.worldId),next=new CoopWorld({worldId:world.data.worldId,ownerId:'owner',layout:saved.layout,saved:saved.world});
  const before=structuredClone(next.data.players.owner.life);applyRebirthIntent(next,saved,intent);
  assert.deepEqual(next.data.players.owner.life,before);assert.equal(next.data.players.owner.life.generation,2);
  assert.throws(()=>applyRebirthIntent(next,saved,{...intent,villageId:'different'}),/内容/);
  assert.equal((await f.store.read(world.data.worldId)).history.filter(row=>row.type==='reborn').length,1);
});

test('same write ID is idempotent but cannot change its payload',async()=>{
  const f=fixture(),world=room(),snapshot=world.save(),options={writeId:'1:0',acquire:true};
  const a=await f.store.commit(snapshot,options),b=await f.store.commit(snapshot,options);assert.deepEqual(a,b);
  world.advance(.05);await assert.rejects(f.store.commit(world.save(),options),/内容/);
});

test('concurrent restored hosts produce one epoch winner and fence the old writer',async()=>{
  const f=fixture(),world=room();await f.store.commit(world.save(),{writeId:'1:0',acquire:true});
  const old=world.save(),candidate=structuredClone(old);candidate.world.epoch++;
  const results=await Promise.allSettled(['A','B'].map(id=>f.store.commit(candidate,{writeId:`2:${id}`,acquire:true})));
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  await assert.rejects(f.store.commit(old,{writeId:'1:stale'}),/権限/);
});

test('stale checkpoints, resurrected lives and modified lineage cannot replace committed history',async()=>{
  const f=fixture(),world=room();await f.store.commit(world.save(),{writeId:'1:0',acquire:true});const stale=world.save();
  end(world);await f.store.commit(world.save(),{writeId:'1:1'});
  await assert.rejects(f.store.commit(stale,{writeId:'1:2'}),/巻き戻/);
  const resurrected=world.save();resurrected.world.players.owner.life.ended=false;resurrected.world.players.owner.life.ageSeconds=LIFE_SECONDS-1;
  await assert.rejects(f.store.commit(resurrected,{writeId:'1:3'}),/巻き戻/);
  applyRebirthIntent(world,await f.store.restore(world.data.worldId),{playerId:'owner',lifeId:'owner:1'});
  await f.store.commit(world.save(),{writeId:'1:4'});
  const altered=world.save();altered.world.players.owner.life.lineage[0].name='rewrite';
  await assert.rejects(f.store.commit(altered,{writeId:'1:5'}),/系譜/);
});

test('a corrupt record fails closed instead of falling back to an earlier checkpoint',async()=>{
  const f=fixture(),world=room();await f.store.commit(world.save(),{writeId:'1:0',acquire:true});
  const key=`coop-v2:${world.data.worldId}`,raw=JSON.parse(f.data.get(key));raw.history=[];f.data.set(key,JSON.stringify(raw));
  await assert.rejects(f.store.restore(world.data.worldId),/壊れ/);
});

test('thirty lives continue independently while one end is pending; its unconfirmed state stays hidden',async()=>{
  const world=room();for(let i=1;i<30;i++)world.addPlayer(`p${i}`,`P${i}`,`T${i}`);
  let release,hold=false,writes=0;
  const writer=createCheckpointWriter({world,now:()=>0,save:async()=>{writes++;if(hold)await new Promise(resolve=>{release=resolve;});}});
  await writer.request();end(world);hold=true;const saving=writer.request();
  for(let i=0;i<20;i++)world.advance(.05,{blocked:writer.pendingIds()});
  assert.equal(writer.project(world.view('owner')).me.ended,false);assert.equal(writer.project(world.view('owner')).historyPending,true);
  assert(world.data.players.p29.life.ageSeconds>1);assert.equal(writer.project(world.view('p29')).peers.find(peer=>peer.playerId==='owner').ended,false);
  hold=false;release();await saving;assert.equal(writer.project(world.view('owner')).me.ended,true);assert.equal(writes,2);
});

test('writer coalesces many save requests and captures the next snapshot only after the first ACK',async()=>{
  const world=room();let hold=false,release,writes=0;
  const writer=createCheckpointWriter({world,now:()=>0,save:async()=>{writes++;if(hold)await new Promise(resolve=>{release=resolve;});}});
  await writer.request();hold=true;const first=writer.request();
  const queued=Array.from({length:100},()=>writer.request());world.advance(.05);
  hold=false;release();await first;await Promise.all(queued);
  assert.equal(writes,3);assert.equal(writer.committed.world.tick,1);
});
