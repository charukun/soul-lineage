import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTHORED_EFFECTS,
  EFFECT_ASSETS,
  REVIEW_AUTHORED_EFFECTS,
  REVIEW_EFFECT_SOURCE,
  REVIEW_VFX_LIBRARY_SOURCE,
} from '../src/rebuild/authored-effect-manifest.js';
import {
  REVIEW_VFX_LIBRARY_ASSETS,
  REVIEW_VFX_LIBRARY_EFFECTS,
  REVIEW_VFX_LIBRARY_COUNT,
} from '../src/rebuild/review-vfx-library-manifest.js';
import {REVIEW_EFFECT_CATALOG,REVIEW_REAL_EFFECT_COUNT} from '../src/review-effect-catalog.js';
import {EFFECT_DOWNLOADS} from '../scripts/prepare-effects.mjs';

test('production VFX stays bounded while review gets distinct source originals',()=>{
  assert.deepEqual(Object.keys(AUTHORED_EFFECTS),['slash','impact','finisher']);
  assert.equal(REVIEW_REAL_EFFECT_COUNT,REVIEW_VFX_LIBRARY_COUNT);
  assert.equal(REVIEW_VFX_LIBRARY_COUNT,245);
  assert.equal(Object.keys(REVIEW_AUTHORED_EFFECTS).length,7+REVIEW_VFX_LIBRARY_COUNT);
  for(const effect of REVIEW_VFX_LIBRARY_EFFECTS)assert.equal(REVIEW_AUTHORED_EFFECTS[effect.id],effect);
  for(const row of REVIEW_EFFECT_CATALOG)for(const effect of row.effects)assert.ok(REVIEW_AUTHORED_EFFECTS[effect],`unknown review effect: ${effect}`);
});

test('core review originals remain pinned separately from the CC0 real library',()=>{
  const core=EFFECT_ASSETS.filter(row=>row.reviewOnly&&!row.reviewLibrary&&row.repository===REVIEW_EFFECT_SOURCE.repository);
  assert.ok(core.length>=31);
  assert.equal(REVIEW_EFFECT_SOURCE.repository,'effekseer/EffekseerForWebGL');
  assert.match(REVIEW_EFFECT_SOURCE.revision,/^[a-f\d]{40}$/);
  for(const row of core){
    assert.equal(row.license,'MIT');
    assert.match(row.gitBlobSha,/^[a-f\d]{40}$/);
    assert.ok(Number.isInteger(row.byteLength)&&row.byteLength>0);
  }
});

test('real review library is a unique pinned CC0 source closure',()=>{
  assert.equal(REVIEW_VFX_LIBRARY_SOURCE.repository,'munokura/Effekseer-sample-for-RPG-Tkool-MZ');
  assert.match(REVIEW_VFX_LIBRARY_SOURCE.revision,/^[a-f\d]{40}$/);
  assert.equal(REVIEW_VFX_LIBRARY_SOURCE.license,'CC0-1.0');
  const effects=REVIEW_VFX_LIBRARY_ASSETS.filter(row=>row.reviewLibrary);
  assert.equal(effects.length,REVIEW_VFX_LIBRARY_COUNT);
  assert.equal(new Set(effects.map(row=>row.gitBlobSha)).size,REVIEW_VFX_LIBRARY_COUNT);
  assert.equal(effects.some(row=>row.sourcePath==='MAGICALxSPIRAL/MxS_Thunder3.efkefc'),true);
  assert.equal(effects.filter(row=>row.sourcePath.startsWith('MAGICALxSPIRAL/')).length,91);
  for(const n of [1,2,3,4,5,6,7,8])assert.equal(effects.some(row=>row.sourcePath===`MAGICALxSPIRAL/MxS_foot_smoke${n}.efkefc`),false);
  assert.equal(effects.some(row=>row.sourcePath==='MAGICALxSPIRAL/MxS_StairBroken3.efkefc'),false);
  assert.equal(effects.some(row=>row.sourcePath==='Tktk02/Tktk02_Blow1.efkefc'),false);
  assert.ok(REVIEW_VFX_LIBRARY_ASSETS.length>effects.length);
  for(const row of REVIEW_VFX_LIBRARY_ASSETS){
    assert.match(row.path,/^[\x20-\x7E]+$/,`deployment-unsafe asset path: ${row.path}`);
    assert.match(row.sourcePath,/^[\x20-\x7E]+$/,`deployment-unsafe source path: ${row.sourcePath}`);
    assert.equal(row.repository,REVIEW_VFX_LIBRARY_SOURCE.repository);
    assert.equal(row.revision,REVIEW_VFX_LIBRARY_SOURCE.revision);
    assert.equal(row.license,'CC0-1.0');
  }
});

test('download plan preserves provenance and namespaces the real review library',()=>{
  const libraryDownloads=EFFECT_DOWNLOADS.filter(row=>row.reviewLibrary);
  assert.equal(libraryDownloads.length,REVIEW_VFX_LIBRARY_COUNT);
  for(const row of libraryDownloads){
    assert.equal(row.repository,REVIEW_VFX_LIBRARY_SOURCE.repository);
    assert.equal(row.revision,REVIEW_VFX_LIBRARY_SOURCE.revision);
    assert.equal(row.sourcePath?.startsWith('review-library/'),false);
    assert.equal(row.target.startsWith('review-library/'),true);
  }
  assert.equal(EFFECT_DOWNLOADS.some(row=>row.target==='LICENSE-REVIEW-LIBRARY-CC0.txt'),true);
  assert.equal(EFFECT_DOWNLOADS.some(row=>row.target==='effekseer.wasm'),true);
  assert.equal(EFFECT_DOWNLOADS.some(row=>row.sourcePath==='Tktk02/Tktk02_Blow1.efkefc'),false);
  assert.equal(EFFECT_DOWNLOADS.some(row=>row.sourcePath==='Tktk02/Parts/のnoise.png'),false);
  assert.equal(EFFECT_DOWNLOADS.some(row=>row.sourcePath==='MAGICALxSPIRAL/MxS_Thunder3.efkefc'),true);
});

test('catalog keeps legacy compositions separate from 245 real source originals',()=>{
  const real=REVIEW_EFFECT_CATALOG.filter(row=>row.realSource);
  const legacyOriginals=REVIEW_EFFECT_CATALOG.filter(row=>row.kind==='original'&&!row.realSource);
  const compositions=REVIEW_EFFECT_CATALOG.filter(row=>row.kind==='composition');
  assert.equal(real.length,245);
  assert.equal(legacyOriginals.length,7);
  assert.ok(compositions.length>=5);
  assert.ok(real.every(row=>row.cues.length===1&&row.effects.length===1));
});
