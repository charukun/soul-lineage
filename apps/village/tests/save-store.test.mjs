import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, initial } from '../src/game/core.js';
import { createSaveStore, SAVE_KEY } from '../src/game/save-store.js';
function fixture(initialEntries = []) {
  const data = new Map(initialEntries);
  const platform = { clock: { now: () => 123456 }, storage: {
    read: async key => data.get(key) ?? null,
    write: async (key, value) => { data.set(key, value); },
    remove: async key => { data.delete(key); },
  }};
  return { data, platform, store: createSaveStore(platform) };
}
test('empty slot and envelope round-trip preserve gameplay', async () => {
  const f=fixture(); assert.equal(await f.store.load(), null);
  const world=new World(); world.gain('wood',42); await f.store.save(world);
  const raw=JSON.parse(f.data.get(SAVE_KEY));
  assert.equal(raw.gameId,'village');assert.equal(raw.playerId,'local');assert.equal(raw.updatedAt,123456);
  const loaded=await f.store.load();assert.equal(loaded.stock.wood,42);assert.equal(loaded.people.length,2);
});
test('invalid saved data is not replaced by a fresh village', async () => {
  const f=fixture([[SAVE_KEY,'{broken']]);
  await assert.rejects(f.store.load(),/上書きしていません/);
  await assert.rejects(f.store.save(new World()));
  assert.equal(f.data.get(SAVE_KEY),'{broken');assert.equal(f.store.blocked,true);
});
test('foreign game/player and unknown envelope schema fail closed', async () => {
  for (const patch of [{gameId:'demon'},{playerId:'another-player'},{schemaVersion:99},{revision:-1}]) {
    const raw=JSON.stringify({schemaVersion:1,gameId:'village',playerId:'local',revision:1,updatedAt:123456,payload:initial(),...patch});
    const f=fixture([[SAVE_KEY,raw]]);await assert.rejects(f.store.load());assert.equal(f.data.get(SAVE_KEY),raw);
  }
});
test('queued async writes cannot regress to an older gameplay snapshot', async () => {
  const f=fixture();let finish;let calls=0;
  f.platform.storage.write=async (key,value)=>{
    if(++calls===1)await new Promise(resolve=>{finish=resolve;});f.data.set(key,value);
  };
  const w=new World();const first=f.store.save(w);w.gain('wood',7);const second=f.store.save(w);w.gain('wood',9);
  while(!finish)await new Promise(resolve=>setImmediate(resolve));finish();await Promise.all([first,second]);
  assert.equal(JSON.parse(f.data.get(SAVE_KEY)).payload.stock.wood,7);
  assert.equal(JSON.parse(f.data.get(SAVE_KEY)).revision,2);
});
test('a failed write is observable and does not poison later saves', async () => {
  const f=fixture();const original=f.platform.storage.write;f.platform.storage.write=async ()=>{throw Error('quota');};
  await assert.rejects(f.store.save(new World()),/quota/);assert.ok(f.store.error);
  f.platform.storage.write=original;await f.store.save(new World());assert.equal(f.store.error,null);
});
test('recovery keeps the original unless a backup was successfully written', async () => {
  const f=fixture([[SAVE_KEY,'bad-json']]);await assert.rejects(f.store.load());
  const original=f.platform.storage.write;f.platform.storage.write=async ()=>{throw Error('quota');};
  await assert.rejects(f.store.recover(),/quota/);assert.equal(f.data.get(SAVE_KEY),'bad-json');
  f.platform.storage.write=original;await f.store.recover();assert.equal(f.data.get(`${SAVE_KEY}.recovery.123456`),'bad-json');
  assert.equal(f.data.has(SAVE_KEY),false);assert.equal(f.store.blocked,false);
});
test('unscoped legacy saves are never read automatically across environments', async () => {
  const f=fixture([['rinne-village-living-v5',JSON.stringify(initial())]]);
  assert.equal(await f.store.load(),null);await f.store.save(new World());
  assert.ok(f.data.has('rinne-village-living-v5'));assert.ok(f.data.has(SAVE_KEY));
});
test('existing v4 migration remains available through explicit JSON import', () => {
  const state=initial();state.version=4;state.objects=state.objects.filter(o=>o.kind!=='guardhome');state.people=[];
  const w=new World();assert.deepEqual(w.load(JSON.stringify(state)),{ok:true});
  assert.equal(w.state.version,5);assert.ok(w.people.some(p=>p.id==='guard-npc'));
});

test('the real Web platform keeps DEV saves separate from Production', async () => {
  const { createWebPlatform } = await import('@soul/platform-web');
  const old = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map([['soul:v1:prod:village:local:living-v5', 'production-save']]);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  }});
  try {
    const platform = createWebPlatform({ gameId: 'village', environment: 'dev', playerId: 'local' });
    const store = createSaveStore(platform);
    assert.equal(await store.load(), null);
    await store.save(new World());
    assert.ok(values.has('soul:v1:dev:village:local:living-v5'));
    assert.equal(values.get('soul:v1:prod:village:local:living-v5'), 'production-save');
  } finally {
    if (old) Object.defineProperty(globalThis, 'localStorage', old);
    else delete globalThis.localStorage;
  }
});
