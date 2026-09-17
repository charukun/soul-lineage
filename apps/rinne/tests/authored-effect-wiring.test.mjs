import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('solo and co-op confirmed events feed presentation with history-independent replay identity',async()=>{
  const runtime=await readFile(new URL('../src/rebuild/runtime.js',import.meta.url),'utf8');
  assert.match(runtime,/from '\.\/combat-effects-renderer\.js'/);
  assert.match(runtime,/presentCombatEvents\?\.\(events,\{state,front,eventKey\}\)/);
  assert.match(runtime,/handleEvents\(shared.events\|\|\[\],`coop:\$\{coop.worldId\}:\$\{shared.epoch\}:\$\{shared.tick\}`\)/);
  assert.match(runtime,/const battle=tickFront\(state,front,dt\);handleEvents\(battle\)/);
  assert.ok((runtime.match(/clearCombatEffects\?\.\(\)/g)||[]).length>=3);
});
test('both development and production preparation include pinned VFX acquisition',async()=>{
  const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  for(const key of ['predev','prebuild'])assert.ok(pkg.scripts[key].includes('node ../../scripts/prepare-rinne-effects.mjs'));
});
