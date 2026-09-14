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

test('MURAAAAAAA is the recoverable world-host candidate and checkpoints real village state',()=>{
 for(const token of ['createPeerHostedWorldNode','createPeerMeshCoordinator','createVillageCheckpoint','hostEligible:true','raidHost.checkpoint()','applyRemoteCheckpoint','gracefulHandoff'])assert.match(village,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
 assert.match(village,/__VILLAGE_REMOTE_WORLD_ACTIVE__/);assert.match(village,/__VILLAGE_SIMULATION_PAUSED__/);
});

test('rinne and demon participate in quorum and mesh without pretending to own village simulation',()=>{
 for(const source of [rinne,demon]){assert.match(source,/connectPeerHostedWorld/);assert.match(source,/hostEligible:false/);assert.match(source,/installWorldDarknessOverlay/);}
 assert.doesNotMatch(rinne,/createPeerHostedWorldNode/);assert.doesNotMatch(demon,/createPeerHostedWorldNode/);
});

test('darkness overlay and app pause bridges freeze authority during migration',()=>{
 for(const text of ['闇が村へ迫っている','闇が晴れていく','村は闇に閉ざされている'])assert.ok(darkness.includes(text));
 assert.match(villagePause,/__VILLAGE_SIMULATION_PAUSED__/);assert.match(demonPause,/__DEMON_SHARED_WORLD_PAUSED__/);assert.match(saveGuard,/setVillageSaveReadOnly/);
});

test('peer hosted phase does not introduce a mandatory dedicated-server or ECS path',()=>{
 const doc=read('docs/PEER_HOSTED_SHARED_WORLD.md');assert.match(doc,/peer-hosted/i);assert.match(doc,/without replacing.*mandatory dedicated servers/i);assert.match(doc,/ECS rewrite/i);
});
