import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const appRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFile(resolve(appRoot,path),'utf8');

test('Visual Review launcher is only five direct destinations',async()=>{
  const html=await read('review.html');
  for(const [target,href] of [['characters','./characters.html?review=character'],['motion','./characters.html?review=motion'],['assets','./review-assets.html'],['effects','./review-effects.html'],['battle','./review-battle.html']]){
    assert.match(html,new RegExp(`data-review-target="${target}"[^>]*href="${href.replace(/[.?]/g,'\\$&')}"`));
  }
  assert.equal((html.match(/data-review-target=/g)||[]).length,5);
  assert.doesNotMatch(html,/<iframe\b/);
  assert.doesNotMatch(html,/develop-review\.js/);
  assert.doesNotMatch(html,/focus-shell|app-context|対象・正本/);
});

test('Battle is a dedicated page using real RaidHost and runtime models',async()=>{
  const [html,review,battle]=await Promise.all([read('review-battle.html'),read('src/review-battle.js'),read('src/review-battle-stage.js')]);
  assert.match(html,/id="battle-canvas"/);assert.match(html,/id="battle-hero-model"/);assert.match(html,/id="battle-enemy-model"/);
  assert.match(html,/<a href="\/" aria-label="Visual Reviewへ戻る">← Review<\/a>/);
  assert.match(review,/from '@soul\/network\/raid-host'/);assert.match(review,/new RaidHost/);assert.match(review,/createReviewBattleStage/);
  assert.match(review,/stage\.setModel\('hero'/);assert.match(review,/stage\.setModel\('enemy'/);
  assert.match(battle,/createKaykitCharacterPools/);assert.match(battle,/tidebreakFrameFromSnapshot/);assert.match(battle,/applyTidebreakPose/);assert.match(battle,/battleGeometry='runtime-models'/);
});

test('authored effect review reuses the runtime effect player and backend',async()=>{
  const js=await read('src/review-effects.js');
  assert.match(js,/createAuthoredEffectPlayer/);assert.match(js,/createEffekseerBackend/);assert.match(js,/authoredEffectBase/);assert.match(js,/combatEffectBudget/);
});

test('RINNE build includes launcher, VFX and battle review entries',async()=>{
  const vite=await read('vite.config.js');
  assert.match(vite,/review:fileURLToPath\(new URL\('\.\/review\.html'/);
  assert.match(vite,/reviewEffects:fileURLToPath\(new URL\('\.\/review-effects\.html'/);
  assert.match(vite,/reviewBattle:fileURLToPath\(new URL\('\.\/review-battle\.html'/);
});
