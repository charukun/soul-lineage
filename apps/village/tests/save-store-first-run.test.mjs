import test from 'node:test';
import assert from 'node:assert/strict';
import {consumeFreshVillageLoad,createSaveStore,SAVE_KEY} from '../src/game/save-store.js';

function emptyPlatform(){
 const values=new Map();
 return {
  clock:{now:()=>123456789},
  storage:{
   read:async key=>values.has(key)?values.get(key):null,
   write:async(key,value)=>{values.set(key,value);},
   remove:async key=>{values.delete(key);},
  },
 };
}

test('first-run boot signal is emitted only for an empty save slot and consumed once',async()=>{
 consumeFreshVillageLoad();
 const store=createSaveStore(emptyPlatform());
 assert.equal(await store.load(),null);
 assert.equal(consumeFreshVillageLoad(),true);
 assert.equal(consumeFreshVillageLoad(),false);
});

test('recover clears a pending fresh-load signal',async()=>{
 consumeFreshVillageLoad();
 const platform=emptyPlatform();
 const store=createSaveStore(platform);
 assert.equal(await store.load(),null);
 await platform.storage.write(SAVE_KEY,'temporary');
 await store.recover();
 assert.equal(consumeFreshVillageLoad(),false);
});
