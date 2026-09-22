import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

test('review DEV worker binds async Hi3DGen Durable Objects',()=>{
  const config=JSON.parse(readFileSync('wrangler.dev.review.jsonc','utf8'));
  assert.equal(config.main,'apps/review/worker.mjs');assert.equal(config.assets.binding,'ASSETS');assert.ok(existsSync(config.main));
  const bindings=new Map(config.durable_objects.bindings.map(row=>[row.name,row.class_name]));
  assert.equal(bindings.get('HI3DGEN_JOBS'),'Hi3DGenJob');assert.equal(bindings.get('HI3DGEN_LIMITS'),'Hi3DGenRateLimit');
  assert.ok(config.migrations.some(row=>row.new_sqlite_classes?.includes('Hi3DGenJob')));
});
