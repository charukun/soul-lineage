import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('PULSE exposes shared-world operations without signaling secrets',()=>{
  const html=read('ops-board/public/index.html'),ui=read('ops-board/public/world-board.js'),worker=read('ops-board/worker.mjs');
  assert.match(html,/id="world-section"/);assert.match(html,/id="shared-world"/);assert.match(html,/world-board\.js/);assert.match(html,/world-board\.css/);
  for(const label of ['Host','Peers','Epoch','Checkpoint','Quorum','Migration','split-brain'])assert.match(ui,new RegExp(label,'i'));
  assert.match(worker,/\/api\/peer-world\//);assert.match(worker,/sharedWorld/);
  assert.doesNotMatch(ui,/hostToken|guestToken|offer-code|answer-code/);
});
