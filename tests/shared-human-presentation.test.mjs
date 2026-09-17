import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url),read=path=>readFile(new URL(path,root),'utf8');

test('all three apps keep the shared human presentation contract',async()=>{
  const [resolver,rinne,villageAdapter,villageIntegration,demonAdapter,demonModel]=await Promise.all([
    read('packages/characters/src/presentation-resolver.js'),
    read('apps/rinne/src/rebuild/character-presentation.js'),
    read('apps/village/src/character-runtime-adapter.js'),
    read('apps/village/src/character-runtime-integration.js'),
    read('apps/demon/src/character-runtime-adapter.js'),
    read('apps/demon/src/master-model.js')
  ]);
  assert.match(resolver,/\['rinne', 'village', 'demon'\]/);
  assert.match(rinne,/KAYKIT_FOUNDATION/);
  assert.match(rinne,/kaykitRuntimeAsset/);
  assert.match(villageAdapter,/KAYKIT_FAMILY_ID/);
  assert.match(villageAdapter,/KAYKIT_RIG_ID/);
  assert.match(villageIntegration,/loadKaykitRuntimeModel/);
  assert.match(villageIntegration,/manifestationSource='kaykit-model'/);
  assert.doesNotMatch(villageIntegration,/SHINO_review|Sendagaya_Shino/);
  assert.match(demonAdapter,/KAYKIT_MODEL_BY_KEY\.knight/);
  assert.match(demonModel,/loadKaykitRuntimeModel/);
  assert.match(demonModel,/\.\/assets\/kaykit\//);
  assert.doesNotMatch(demonModel,/\.\.\/rinne\//);
});

test('Village and Demon materialize the same pinned KayKit foundation inside their own app',async()=>{
  const [script,villagePackage,demonPackage]=await Promise.all([
    read('scripts/prepare-kaykit-foundation.mjs'),
    read('apps/village/package.json'),
    read('apps/demon/package.json')
  ]);
  assert.match(script,/apps\/village\/public\/assets\/kaykit/);
  assert.match(script,/apps\/demon\/public\/assets\/kaykit/);
  assert.match(script,/KAYKIT_SOURCE_REVISION/);
  assert.match(script,/verifyKayKitBytes/);
  assert.match(villagePackage,/prepare-kaykit-foundation\.mjs village/);
  assert.match(demonPackage,/prepare-kaykit-foundation\.mjs demon/);
});

test('Village shared human capacity covers the game population ceiling without normal procedural overflow',async()=>{
  const [integration,core]=await Promise.all([
    read('apps/village/src/character-runtime-integration.js'),
    read('apps/village/src/game/core.js')
  ]);
  const max=Number(core.match(/MAX_POPULATION=(\d+)/)?.[1]);
  const shards=Number(integration.match(/POOL_SHARDS=(\d+)/)?.[1]);
  const capacity=Number(integration.match(/POOL_CAPACITY=(\d+)/)?.[1]);
  assert.ok(Number.isFinite(max)&&Number.isFinite(shards)&&Number.isFinite(capacity));
  assert.ok(shards*capacity>=max,`shared human capacity ${shards*capacity} must cover village max population ${max}`);
});
