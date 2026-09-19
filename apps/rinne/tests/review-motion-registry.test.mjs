import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {
  buildReviewMotionRegistry,
  canonicalMotionVariationKey,
  kaykitMotionRecords,
  dedupeSourceMotions,
  motionRegistryCount
} from '../src/review-motion-registry.js';
import {MOTION_LIBRARY_SOURCES,MOTION_LIBRARY_CLIP_OCCURRENCES} from '../src/review-motion-sources.js';
import {buildMotionReviewCatalog,filterMotionReviewCatalog,REVIEW_MOTION_CATEGORY_LABELS} from '../src/review-motion-catalog.js';

const knightUrl=new URL('../public/simulator/assets/kaykit/Knight.glb',import.meta.url);
function glbJson(buffer){
  assert.equal(buffer.readUInt32LE(0),0x46546c67,'GLB magic');
  assert.equal(buffer.readUInt32LE(4),2,'GLB version');
  let offset=12;
  while(offset+8<=buffer.length){
    const length=buffer.readUInt32LE(offset),type=buffer.readUInt32LE(offset+4),start=offset+8,end=start+length;
    if(type===0x4e4f534a)return JSON.parse(buffer.subarray(start,end).toString('utf8').replace(/\0+$/,'').trim());
    offset=end;
  }
  throw new Error('GLB JSON chunk not found');
}
async function actualRegistry(){
  const document=glbJson(await readFile(fileURLToPath(knightUrl)));
  assert.ok(Array.isArray(document.animations)&&document.animations.length>0,'Knight.glb must contain animations');
  return {document,registry:buildReviewMotionRegistry(document.animations)};
}

test('source registry is mechanically derived from current KayKit plus pinned upstream clip inventories',async()=>{
  const {document,registry}=await actualRegistry();
  const baseline=kaykitMotionRecords(document.animations);
  const baselineDeduped=dedupeSourceMotions(baseline.records);
  assert.equal(baseline.records.length+baseline.exclusions.length,document.animations.length,'no existing embedded source clip is silently lost');
  assert.equal(baselineDeduped.motions.length+baselineDeduped.duplicates.length+baseline.exclusions.length,document.animations.length);
  assert.equal(registry.existingSourceMotionCount,baselineDeduped.motions.length);
  assert.equal(registry.externalSourceClipOccurrences,MOTION_LIBRARY_CLIP_OCCURRENCES);
  assert.equal(registry.sourceMotionCount,registry.existingSourceMotionCount+registry.addedSourceMotionCount);
  assert.ok(registry.addedSourceMotionCount>=100,'the verified source pool should add at least 100 genuinely distinct review motions');
  console.log('MOTION_BASELINE_SOURCE_COUNT',registry.existingSourceMotionCount);
  console.log('MOTION_ADDED_SOURCE_COUNT',registry.addedSourceMotionCount);
  console.log('MOTION_FINAL_SOURCE_COUNT',registry.sourceMotionCount);
  console.log('MOTION_DUPLICATE_EXCLUSIONS',registry.duplicateSourceClipCount);
  console.log('MOTION_POLICY_EXCLUSIONS',registry.excludedSourceClipCount);
});

test('every registered motion has unique immutable provenance, license and safe deployment metadata',async()=>{
  const {registry}=await actualRegistry(),ids=new Set();
  for(const row of registry.motions){
    assert.ok(row.sourceRepository);
    assert.match(row.sourceRevision,/^[0-9a-f]{40}$/);
    assert.ok(row.sourcePath&&!row.sourcePath.includes('..')&&!row.sourcePath.startsWith('/'));
    assert.ok(row.upstreamClipName);
    assert.ok(Number.isSafeInteger(row.upstreamClipIndex));
    assert.ok(row.license);
    assert.ok(row.author);
    assert.match(row.immutableHash,/^git-sha1:[0-9a-f]{40}$/);
    assert.ok(Object.hasOwn(REVIEW_MOTION_CATEGORY_LABELS,row.category));
    assert.ok(!ids.has(row.sourceIdentity),'source identity must be unique');
    ids.add(row.sourceIdentity);
    if(row.runtime.url){
      assert.match(row.runtime.url,/^https:\/\/raw\.githubusercontent\.com\//);
      assert.ok(row.runtime.url.includes(row.sourceRevision),'remote runtime path must be revision-pinned');
    }
  }
  assert.equal(ids.size,motionRegistryCount(registry));
  for(const source of MOTION_LIBRARY_SOURCES){
    assert.ok(source.license&&source.author&&source.licenseEvidence&&source.originalSource);
    assert.match(source.revision,/^[0-9a-f]{40}$/);
    assert.match(source.gitBlobSha,/^[0-9a-f]{40}$/);
    assert.ok(!source.path.includes('..')&&!source.path.startsWith('/'));
    assert.ok(source.runtimeUrl.includes(source.revision));
  }
});

test('retarget, speed, mirror, trim, loop, additive and IK derivatives never increase source count',async()=>{
  const {registry}=await actualRegistry(),base=registry.motions[0];
  const sameIdentity=['retarget','speed','mirror','trim','loop','additive','ik'].map(kind=>({
    ...base,runtime:{...base.runtime,kind:'test-'+kind,[kind]:true}
  }));
  const converted={
    ...base,
    sourceIdentity:base.sourceIdentity+':converted',
    sourcePath:'converted/clip.fbx',
    runtime:{kind:'converted'},
    canonicalClipIdentity:base.canonicalClipIdentity
  };
  const deduped=dedupeSourceMotions([base,...sameIdentity,converted]);
  assert.equal(deduped.motions.length,1);
  assert.equal(deduped.duplicates.length,sameIdentity.length+1);
});

test('known upstream presentation variations collapse to the same canonical motion',()=>{
  for(const [a,b] of [
    ['Roll','Roll_RM'],
    ['Dodge_Left','Dodge_Right'],
    ['Jump_Full_Long','Jump_Full_Short'],
    ['Ranged_Bow_Draw','Ranged_Bow_Draw_Up'],
    ['Ranged_Magic_Spellcasting','Ranged_Magic_Spellcasting_Long'],
    ['Skeletons_Taunt','Skeletons_Taunt_Longer'],
    ['Melee_Hook','Melee_Hook_Rec'],
    ['Chop','Chopping'],
    ['Dig','Digging'],
    ['Hammer','Hammering'],
    ['Work_A','Working_A']
  ])assert.equal(canonicalMotionVariationKey(a),canonicalMotionVariationKey(b),`${a} vs ${b}`);
});

test('catalog all-view exposes every unique source motion and UI count comes only from the registry',async()=>{
  const {registry}=await actualRegistry(),catalog=buildMotionReviewCatalog(registry.motions,{perCategory:8});
  assert.equal(filterMotionReviewCatalog(catalog,'all').length,motionRegistryCount(registry));
  for(const filter of ['recommended','life','move','combat','reaction','other','all'])assert.doesNotThrow(()=>filterMotionReviewCatalog(catalog,filter));
  const [standalone,workshop,standaloneJs,qaJs]=await Promise.all([
    readFile(new URL('../review-motion.html',import.meta.url),'utf8'),
    readFile(new URL('../characters.html',import.meta.url),'utf8'),
    readFile(new URL('../src/review-motion.js',import.meta.url),'utf8'),
    readFile(new URL('../src/character-motion-qa.js',import.meta.url),'utf8')
  ]);
  assert.match(standalone,/id="motion-source-count"/);
  assert.match(workshop,/id="qa-motion-count"/);
  for(const source of [standalone,workshop,standaloneJs,qaJs])assert.doesNotMatch(source,/MOTION CLIPS\s+\d+/);
  assert.match(standaloneJs,/motionRegistryCount\(registry\)/);
  assert.match(qaJs,/motionRegistryCount\(registry\)/);
  assert.match(qaJs,/data-motion-filter/);
});

test('excluded source clips remain auditable with explicit reasons',async()=>{
  const {registry}=await actualRegistry();
  assert.ok(registry.exclusions.length>0);
  for(const row of registry.exclusions){
    assert.ok(row.record?.sourceIdentity);
    assert.ok(row.reason&&typeof row.reason==='string');
  }
  assert.ok(registry.exclusions.some(row=>/firearm/i.test(row.reason)));
  assert.ok(registry.exclusions.some(row=>/reference pose/i.test(row.reason)));
});
