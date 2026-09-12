import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const online=readFileSync(new URL('../src/web/online.js',import.meta.url),'utf8');

test('real-player villages have no normal demon raid entry',()=>{
 assert.match(online,/friend-invite-only/);
 assert.doesNotMatch(online,/実プレイヤーの村/);
 assert.doesNotMatch(online,/role:\s*['"]demon['"]/);
 assert.doesNotMatch(online,/acceptHostOffer/);
});
