import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../../../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('battle review keeps loop and follow implicit and exposes only the player model selector',async()=>{
  const [html,js]=await Promise.all([read('apps/rinne/review-battle.html'),read('apps/rinne/src/review-battle.js')]);
  assert.match(html,/自プレイヤーモデル/);
  assert.match(html,/id="battle-hero-model"/);
  assert.doesNotMatch(html,/battle-enemy-model|battle-loop|battle-camera/);
  assert.doesNotMatch(html,/hero-action|enemy-action|hero-hp|enemy-hp|class="hud"/);
  assert.match(js,/const AUTO_LOOP=true;/);
  assert.match(js,/const FOLLOW_CAMERA=true;/);
  assert.match(js,/OPPONENT_MODEL='kaykit\.knight\.v1'/);
  assert.match(js,/details:true/);
  assert.match(js,/opponentHp:core\?\.enemy\?\.hp/);
  assert.match(js,/opponentMaxHp:core\?\.enemy\?\.maxhp/);
  assert.doesNotMatch(js,/getElementById\('battle-loop'\)|getElementById\('battle-camera'\)/);
});

test('review and Jinku gameplay mount the same shared phase panel',async()=>{
  const [review,demonHtml,demonEntry,pkg,panelCss]=await Promise.all([
    read('apps/rinne/src/review-battle.js'),
    read('apps/demon/index.html'),
    read('apps/demon/src/main.js'),
    read('packages/shared-ui/package.json'),
    read('packages/shared-ui/src/phase-panel.css')
  ]);
  assert.match(review,/@soul\/shared-ui\/phase-panel/);
  assert.match(demonEntry,/@soul\/shared-ui\/phase-panel/);
  assert.match(pkg,/"\.\/phase-panel"/);
  assert.match(demonHtml,/<div id="battle"><\/div>/);
  assert.doesNotMatch(demonHtml,/class="phases"/);
  assert.match(panelCss,/data-skin="jinku"/);
  assert.match(panelCss,/#battle\.soul-phase-panel\[data-skin="jinku"\]/);
  assert.match(panelCss,/data-skin="jinku"\][^{]*\{[^}]*background:transparent/);
  assert.doesNotMatch(panelCss,/data-skin="jinku"\][^{]*\{[^}]*clip-path/);
});
