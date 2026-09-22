import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {RINNE_SOUND_REVIEW_LIBRARY,filterSoundReviewLibrary,soundReviewCounts} from '../src/review/sound/catalog.js';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('sound review exposes distinct real RINNE audio assets',()=>{
  const counts=soundReviewCounts();
  assert.deepEqual(counts,{total:94,bgm:48,sfx:46});
  assert.equal(new Set(RINNE_SOUND_REVIEW_LIBRARY.map(item=>item.id)).size,94);
  assert.equal(RINNE_SOUND_REVIEW_LIBRARY.filter(item=>item.kind==='sfx').length,46);
  assert.equal(RINNE_SOUND_REVIEW_LIBRARY.filter(item=>item.kind==='bgm').length,48);
  for(const item of RINNE_SOUND_REVIEW_LIBRARY){
    assert.ok(item.url);
    assert.match(item.url,/\.ogg(?:\?|$)/);
  }
});

test('sound review filtering supports kind and Japanese metadata search',()=>{
  assert.equal(filterSoundReviewLibrary({kind:'sfx'}).length,46);
  assert.equal(filterSoundReviewLibrary({kind:'bgm'}).length,48);
  assert.ok(filterSoundReviewLibrary({query:'斬撃'}).some(item=>item.id==='sfx-slash-a'));
  assert.ok(filterSoundReviewLibrary({query:'通常戦闘'}).some(item=>item.id==='r05'));
  assert.ok(filterSoundReviewLibrary({query:'木床'}).some(item=>item.id==='kenney-footstep-wood'));
  assert.equal(RINNE_SOUND_REVIEW_LIBRARY.filter(item=>item.provenance?.license==='CC0-1.0').length,43);
});

test('sound review UI stays isolated from motion and VFX',async()=>{
  const [html,source]=await Promise.all([read('review-sound.html'),read('src/review-sound.js')]);
  for(const id of ['sound-play','sound-restart','sound-seek','sound-volume','sound-loop','sound-search','sound-catalog'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(html,/モーション・VFX・ゲームロジックとの同期はここでは行いません/);
  assert.match(source,/new Audio\(\)/);
  assert.match(source,/filterSoundReviewLibrary/);
  assert.match(source,/document\.hidden/);
});
