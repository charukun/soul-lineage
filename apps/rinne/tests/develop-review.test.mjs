import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const appRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFile(resolve(appRoot,path),'utf8');

test('Visual Review keeps canonical sources while moving source detail behind the chooser',async()=>{
  const js=await read('src/develop-review.js');
  assert.match(js,/from '@soul\/game-data'/);
  assert.match(js,/INSPIRATION_WEAPON_ARTS/);
  assert.match(js,/INSPIRATION_MOTION_IDS/);
  assert.match(js,/from '@soul\/characters'/);
  assert.match(js,/KAYKIT_FAMILY_ID/);
  assert.match(js,/KAYKIT_RIG_ID/);
  assert.match(js,/from '@soul\/assets'/);
  assert.match(js,/publicWebAssetCatalog/);
  assert.match(js,/from '@soul\/network\/raid-host'/);
  assert.match(js,/new RaidHost/);
  assert.doesNotMatch(js,/work\/visual-review-lab-v2/);
});

test('Visual Review is chooser-first and hides navigation while a focused tool is open',async()=>{
  const [html,js]=await Promise.all([read('review.html'),read('src/develop-review.js')]);
  assert.match(html,/id="review-home"[^>]*class="review-home"/);
  assert.match(html,/id="focus-shell"[^>]*hidden/);
  assert.match(html,/id="focus-back"/);
  assert.match(html,/id="focus-app-context"/);
  for(const panel of ['characters','motion','assets','effects','battle']){
    assert.match(html,new RegExp(`data-view="${panel}"`));
    assert.match(html,new RegExp(`data-panel="${panel}"`));
  }
  assert.doesNotMatch(html,/data-panel="overview"/);
  assert.match(js,/function enterFocus\(name\)/);
  assert.match(js,/q\('#review-home'\)\.hidden=true/);
  assert.match(js,/document\.body\.dataset\.reviewMode='focused'/);
  assert.match(js,/function leaveFocus\(\)/);
  assert.match(js,/q\('#review-home'\)\.hidden=false/);
});

test('focused review surfaces still point at the real current tools',async()=>{
  const html=await read('review.html');
  assert.match(html,/data-src="\.\/characters\.html"/);
  assert.match(html,/data-src="\.\/characters\.html\?review=motion"/);
  assert.match(html,/data-src="\.\/review-assets\.html"/);
  assert.match(html,/data-src="\.\/review-effects\.html"/);
});

test('battle review presents RaidHost state through real KayKit runtime models',async()=>{
  const [html,review,battle]=await Promise.all([read('review.html'),read('src/develop-review.js'),read('src/review-battle-stage.js')]);
  assert.match(html,/id="battle-hero-model"/);
  assert.match(html,/id="battle-enemy-model"/);
  assert.match(html,/表示だけ切替/);
  assert.match(review,/createReviewBattleStage/);
  assert.match(review,/stage\.setModel\('hero'/);
  assert.match(review,/stage\.setModel\('enemy'/);
  assert.match(battle,/createKaykitCharacterPools/);
  assert.match(battle,/tidebreakFrameFromSnapshot/);
  assert.match(battle,/applyTidebreakPose/);
  assert.match(battle,/actor\.sample/);
  assert.match(battle,/characterModel/);
  assert.match(battle,/battleGeometry='runtime-models'/);
  assert.doesNotMatch(review,/\.arc\(/);
});

test('authored effect review reuses the runtime effect player and backend',async()=>{
  const js=await read('src/review-effects.js');
  assert.match(js,/createAuthoredEffectPlayer/);
  assert.match(js,/createEffekseerBackend/);
  assert.match(js,/authoredEffectBase/);
  assert.match(js,/combatEffectBudget/);
  assert.match(js,/type:'player-hit'/);
  assert.match(js,/type:'enemy-hit'/);
  assert.match(js,/type:'one-motion'/);
  assert.doesNotMatch(js,/damage\s*[-+*/]?=/);
});

test('RINNE build includes the review and authored effect entries',async()=>{
  const vite=await read('vite.config.js');
  assert.match(vite,/review:fileURLToPath\(new URL\('\.\/review\.html'/);
  assert.match(vite,/reviewEffects:fileURLToPath\(new URL\('\.\/review-effects\.html'/);
});
