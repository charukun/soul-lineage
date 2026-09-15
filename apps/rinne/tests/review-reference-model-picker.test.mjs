import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { MOTION_LIBRARY_MODELS, motionLibraryModel, motionLibraryModelURL } from '../src/review/motion-library-models.js';
import { MODEL_PICKER_PRESENTATION, modelPickerPortrait, presentModelPickerRow, visibleModelPickerRows } from '../src/review/model-picker-catalog.js';

const adapter=readFileSync(new URL('../src/review/review-adapter.js',import.meta.url),'utf8');
const ux=readFileSync(new URL('../src/review/review-ux.js',import.meta.url),'utf8');
const retiredReferenceCatalog=new URL('../src/review/reference-character-models.js',import.meta.url);

test('Visual Review Lab keeps the retired generic procedural catalog out while preserving the explicit Atlas study',()=>{
  assert.equal(existsSync(retiredReferenceCatalog),false,`${retiredReferenceCatalog.pathname} must stay retired`);
  assert.doesNotMatch(adapter,/REVIEW_REFERENCE_MODELS|reference-character-models/);
  assert.match(adapter,/arcanist\.atlas-study\.v1|ARCANIST_ATLAS_STUDY_ID/);
  assert.match(adapter,/ARCANIST_ATLAS_STUDY \/ BLOCKOUT/);
  assert.match(adapter,/modelingMode:'runtime-procedural'/);
  assert.match(adapter,/productionReady:false/);
  assert.match(adapter,/attachArcanistAtlasStudy/);
  assert.match(adapter,/\.\.\.baseReviewPresets/);
});

test('public model picker collapses same-source Shino variants without removing internal presets',()=>{
  const rows=[
    {id:'model.SHINO',portrait:'SHINO'},
    {id:'model.SHINO_SLENDER',portrait:'SHINO'},
    {id:'model.SHINO_STURDY',portrait:'SHINO'},
    {id:'model.SHINO_COMPACT',portrait:'SHINO'},
    {id:'model.A',portrait:'A'}
  ];
  const visible=visibleModelPickerRows(rows);
  assert.deepEqual(visible.map(row=>row.id),['model.SHINO','model.A']);
  for(const id of ['model.SHINO_SLENDER','model.SHINO_STURDY','model.SHINO_COMPACT']){
    const row=presentModelPickerRow(rows.find(candidate=>candidate.id===id));
    assert.equal(row.pickerHidden,true);
    assert.equal(row.pickerCanonicalId,'model.SHINO');
  }
  assert.equal(modelPickerPortrait(rows[0]),'./simulator/assets/portrait_SHINO.webp');
});

test('visible Motion Library cards have pinned distinct character portraits',()=>{
  const visibleIds=['motion-library.knight','motion-library.barbarian','motion-library.mage','motion-library.rogue'];
  const portraits=visibleIds.map(id=>modelPickerPortrait({id,label:id}));
  assert.equal(new Set(portraits).size,visibleIds.length);
  for(const portrait of portraits){
    assert.match(portrait,/raw\.githubusercontent\.com\/KayKit-Game-Assets\/KayKit-Character-Pack-Adventures-1\.0\/672074b73ba276876a19e8816ecdc5241817ab47\/addons\/kaykit_character_pack_adventures\/Samples\/(knight|barbarian|mage|rogue)\.png$/);
  }
  assert.equal(MODEL_PICKER_PRESENTATION['motion-library.rogue-hooded'].pickerHidden,true);
  assert.equal(MODEL_PICKER_PRESENTATION['motion-library.rogue-hooded'].pickerCanonicalId,'motion-library.rogue');
  assert.match(modelPickerPortrait({id:'arcanist.atlas-study.v1'}),/charukun\/soul-lineage\/d8bc6d3814bca199d33c53783b1d1386405d8614\/docs\/characters\/references\/npc-role-set\/arcanist\.avif$/);
});

test('picker never invents a Shino face for unknown models and has a neutral image-failure fallback',()=>{
  assert.equal(modelPickerPortrait({id:'future.model',label:'Future Model'}),null);
  assert.doesNotMatch(ux,/portrait:'SHINO'/);
  assert.match(ux,/model-picker-portrait-fallback/);
  assert.match(ux,/row\.pickerLabel\|\|row\.label\|\|row\.id/);
  assert.match(ux,/visibleModelPickerRows\(allRows\(\)\)/);
});

test('Visual Review Lab keeps the five real Motion Library characters', () => {
  assert.equal(MOTION_LIBRARY_MODELS.length, 5);
  assert.deepEqual(MOTION_LIBRARY_MODELS.map(row => row.label), ['Knight','Barbarian','Mage','Rogue','Rogue Hooded']);
  for (const row of MOTION_LIBRARY_MODELS) {
    assert.equal(motionLibraryModel(row.presetId), row);
    assert.equal(motionLibraryModel(row.id), row);
    assert.ok(motionLibraryModelURL(row).endsWith('/' + row.file));
  }
  assert.ok(adapter.includes('...MOTION_LIBRARY_PRESETS'));
  assert.ok(adapter.includes('loadMotionLibraryPreset'));
  assert.ok(adapter.includes('motionLibraryModel(args?.presetId)'));
  assert.ok(adapter.includes('Motion Library / 埋め込みモーション'));
});
