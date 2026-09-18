import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const village=read('apps/village/src/online.js');
const rinne=read('apps/rinne/src/online.js');
const demon=read('apps/demon/src/web/online.js');
const darkness=read('packages/shared-ui/src/world-darkness.js');
const saveGuard=read('apps/village/src/peer-save-guard.js');
const villagePause=read('apps/village/src/peer-authority-pause.js');
const demonPause=read('apps/demon/src/peer-authority-pause.js');

test('current Village friend visits consume peer authority without exporting private simulation',()=>{
 assert.match(village,/createFriendVisitHost/);
 assert.match(village,/m\.role!==['"]visitor['"]/);
 assert.match(village,/visualSnapshot/);
 assert.doesNotMatch(village,/RaidHost|raidHost|createVillageCheckpoint|applyRemoteCheckpoint/);
 const guest=read('apps/village/src/friend-visit.js');
 assert.match(guest,/createFriendVisitGuest/);
 assert.match(guest,/installWorldDarknessOverlay/);
 assert.doesNotMatch(guest,/createSaveStore|localStorage\.setItem/);
});

test('Demon keeps the current friend-invite-only disabled adapter',()=>{
 assert.match(demon,/enabled: false/);
 assert.match(demon,/friend-invite-only/);
 assert.doesNotMatch(demon,/connectPeerHostedWorld|createPeerHostedWorldNode|document\.createElement/);
});

test('darkness overlay and app pause bridges freeze authority during migration',()=>{
 for(const text of ['闇が村へ迫っている','闇が晴れていく','村は闇に閉ざされている'])assert.ok(darkness.includes(text));
 assert.match(villagePause,/__VILLAGE_SIMULATION_PAUSED__/);assert.match(demonPause,/__DEMON_SHARED_WORLD_PAUSED__/);assert.match(saveGuard,/setVillageSaveReadOnly/);
});

test('peer hosted phase does not introduce a mandatory dedicated-server or ECS path',()=>{
 const doc=read('docs/PEER_HOSTED_SHARED_WORLD.md');assert.match(doc,/peer-hosted/i);assert.match(doc,/without replacing.*mandatory dedicated servers/i);assert.match(doc,/ECS rewrite/i);
});
