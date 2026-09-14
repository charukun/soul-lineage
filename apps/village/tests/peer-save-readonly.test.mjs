import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../src/game/core.js';
import {createSaveStore,SAVE_KEY,setVillageSaveReadOnly} from '../src/game/save-store.js';

function fixture(){
 const data=new Map();const platform={clock:{now:()=>1},storage:{read:async key=>data.get(key)??null,write:async(key,value)=>data.set(key,value),remove:async key=>data.delete(key)}};
 return{data,store:createSaveStore(platform)};
}

test('remote authority cannot overwrite the personal local village save',async()=>{
 const f=fixture(),world=new World();setVillageSaveReadOnly(false);await f.store.save(world);const original=f.data.get(SAVE_KEY);
 world.gain('wood',9);setVillageSaveReadOnly(true);const result=await f.store.save(world);assert.equal(result.skipped,'peer-read-only');assert.equal(f.data.get(SAVE_KEY),original);assert.equal(f.store.readOnly,true);
 setVillageSaveReadOnly(false);await f.store.save(world);const loaded=await f.store.load();assert.equal(loaded.stock.wood,9);assert.equal(f.store.readOnly,false);
});
