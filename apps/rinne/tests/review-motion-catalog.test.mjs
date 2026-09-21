import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildMotionReviewCatalog,classifyReviewMotion,filterMotionReviewCatalog} from '../src/review/motion/catalog.js';
import {buildReviewMotionRegistry,canonicalMotionVariationKey,dedupeSourceMotions,motionRegistryCount} from '../src/review/motion/registry.js';
import {MOTION_LIBRARY_ARCHIVED_SOURCES,MOTION_LIBRARY_SOURCES} from '../src/review/motion/sources.js';
import {DEV_ASSET_ORIGIN,isThirdPartyRuntimeAssetUrl} from '@soul/assets';

const clips=[
  {name:'Idle',duration:2.1},{name:'Interact',duration:1.4},{name:'PickUp',duration:1.2},{name:'Cheer',duration:1.6},{name:'Wave',duration:1.5},{name:'Sitting_Idle',duration:3},
  {name:'Walking_A',duration:1},{name:'Running_A',duration:.8},{name:'Jump_Full',duration:1.1},{name:'Crouch_Idle',duration:2},{name:'Sneaking',duration:1.2},{name:'Dodge_Roll',duration:.9},
  {name:'1H_Melee_Attack_Chop',duration:.7},{name:'Heavy_Attack',duration:1.1},{name:'Attack_Combo',duration:1.3},{name:'Block',duration:1},{name:'Shoot_2H',duration:.8},{name:'Spellcast',duration:1.5},
  {name:'Hit_A',duration:.5},{name:'Death_A',duration:1.8},{name:'Spawn',duration:1.2},{name:'Look_Around',duration:2}
];

test('motion review classifies gameplay vocabulary and keeps provenance-backed source identities unique',()=>{
  assert.equal(classifyReviewMotion('Sitting_Idle'),'life');
  assert.equal(classifyReviewMotion('Farm_PlantSeed'),'life');
  assert.equal(classifyReviewMotion('Fishing_Cast'),'life');
  assert.equal(classifyReviewMotion('Dodge_Roll'),'move');
  assert.equal(classifyReviewMotion('ClimbUp_1m_RM'),'parkour');
  assert.equal(classifyReviewMotion('NinjaJump_Start'),'parkour');
  assert.equal(classifyReviewMotion('Slide_Loop'),'parkour');
  assert.equal(classifyReviewMotion('1H_Melee_Attack_Chop'),'combat');
  assert.equal(classifyReviewMotion('Sword_Regular_Combo'),'combat');
  assert.equal(classifyReviewMotion('Death_A'),'reaction');
  assert.equal(classifyReviewMotion('Look_Around'),'reaction');

  const registry=buildReviewMotionRegistry(clips),ids=new Set();
  assert.equal(registry.sourceMotionCount,motionRegistryCount(registry));
  for(const row of registry.motions){
    assert.ok(row.sourceRepository&&row.sourcePath&&row.upstreamClipName&&row.author&&row.license);
    assert.match(row.sourceRevision,/^[0-9a-f]{40}$/);
    assert.match(row.immutableHash,/^git-sha1:[0-9a-f]{40}$/);
    assert.ok(!ids.has(row.sourceIdentity));ids.add(row.sourceIdentity);
  }
  for(const source of MOTION_LIBRARY_SOURCES){
    assert.ok(source.license&&source.author&&source.licenseEvidence&&source.originalSource);
    assert.match(source.revision,/^[0-9a-f]{40}$/);
    assert.match(source.gitBlobSha,/^[0-9a-f]{40}$/);
    assert.ok(!source.path.includes('..')&&!source.path.startsWith('/'));
    if(source.discoverAtRuntime)assert.equal(source.family,'mesh2motion');
    assert.equal(source.selfHosted,true);assert.ok(source.runtimeUrl.startsWith(DEV_ASSET_ORIGIN));assert.equal(isThirdPartyRuntimeAssetUrl(source.runtimeUrl),false);
    if(source.reviewModel){assert.equal(source.id,'mesh2motion-review-mannequin');assert.equal(source.family,'mesh2motion');}
  }
  const cmuParkour=MOTION_LIBRARY_SOURCES.filter(source=>source.family==='cmu');
  assert.equal(cmuParkour.length,14);
  for(const source of cmuParkour){
    assert.equal(source.rig,'cmu-bvh');assert.equal(source.format,'bvh');assert.equal(source.clips.length,1);
    assert.equal(source.clips[0].category,'parkour');assert.match(source.path,/\.bvh$/i);
    assert.equal(source.revision,'22a4d6b7e4d6f9c9e10b5742fdc42ca8310ea624');
  }
  const parkourRows=filterMotionReviewCatalog(buildMotionReviewCatalog(registry.motions),'parkour');
  assert.ok(parkourRows.length>=14);
  const mesh2motionIds=MOTION_LIBRARY_SOURCES.filter(source=>source.discoverAtRuntime).map(source=>source.id);
  assert.deepEqual(mesh2motionIds,['mesh2motion-human-base','mesh2motion-human-addon','mesh2motion-human-mocap']);
  assert.deepEqual(MOTION_LIBRARY_ARCHIVED_SOURCES.map(row=>row.id),[]);
  for(const id of ['kaykit-tools','quaternius-ual1','quaternius-ual2'])assert.ok(MOTION_LIBRARY_SOURCES.some(row=>row.id===id&&row.selfHosted));
  const discovered={
    'mesh2motion-human-base':[{index:0,name:'Angry',duration:1.2},{index:1,name:'Attack_Ground_Pound',duration:1.1}],
    'mesh2motion-human-addon':[{index:0,name:'Fishing_Cast',duration:1.4}],
    'mesh2motion-human-mocap':[{index:0,name:'Cheer_One_Arm',duration:1.5}]
  };
  const expanded=buildReviewMotionRegistry(clips,discovered);
  for(const id of mesh2motionIds)assert.ok(expanded.motions.some(row=>row.sourceId===id));
  assert.ok(expanded.addedSourceMotionCount>=4);
});

test('motion review has a pinned unequipped mannequin as its dedicated default review body',async()=>{
  const source=MOTION_LIBRARY_SOURCES.find(row=>row.id==='mesh2motion-review-mannequin');
  assert.ok(source?.reviewModel);assert.equal(source.path,'static/models/model-human.glb');assert.equal(source.license,'CC0-1.0');
  const [js,runtimeJs]=await Promise.all([
    readFile(new URL('../src/review-motion.js',import.meta.url),'utf8'),
    readFile(new URL('../src/review-motion-source-runtime.js',import.meta.url),'utf8')
  ]);
  assert.match(js,/let selectedModel=MOTION_REVIEW_MODEL/);
  assert.match(js,/loadMotionReviewModel\(model\.id\)/);
  assert.match(runtimeJs,/BVHLoader/);assert.match(runtimeJs,/CMU_BVH_METERS_PER_UNIT=\.01/);
  assert.match(runtimeJs,/cmuHumanoidFromBVH/);assert.match(runtimeJs,/restBase,hips:bones\.hips\.position\.toArray\(\)/);
  assert.match(runtimeJs,/source\.format==='bvh'/);assert.doesNotMatch(runtimeJs,/raw\.githubusercontent\.com/);assert.match(js,/['"]parkour['"]/);
});

test('motion review recommendations stay bounded and presentation variants never increase source count',()=>{
  const catalog=buildMotionReviewCatalog(clips,{perCategory:3}),recommended=filterMotionReviewCatalog(catalog,'recommended');
  assert.ok(recommended.length<=12);
  for(const category of ['life','move','combat','reaction'])assert.ok(recommended.some(row=>row.category===category));
  assert.equal(filterMotionReviewCatalog(catalog,'all').length,clips.length);

  const base=buildReviewMotionRegistry(clips).motions[0];
  const variants=['speed','mirror','trim','loop','rootMotion','retarget','format','blend','additive','ik'].map(kind=>({...base,runtime:{...base.runtime,[kind]:true}}));
  const converted={...base,sourceIdentity:base.sourceIdentity+':converted',canonicalClipIdentity:base.canonicalClipIdentity};
  const deduped=dedupeSourceMotions([base,...variants,converted]);
  assert.equal(deduped.motions.length,1);
  assert.equal(deduped.duplicates.length,variants.length+1);
  for(const [a,b] of [['Dodge_Left','Dodge_Right'],['Roll','Roll_RM'],['Jump_Full_Long','Jump_Full_Short'],['Melee_Hook','Melee_Hook_Rec'],['Chop','Chopping']])assert.equal(canonicalMotionVariationKey(a),canonicalMotionVariationKey(b));
});

test('motion review preserves exact source fields and derives visible count without heavy preparation',async()=>{
  const catalog=buildMotionReviewCatalog(clips),attack=catalog.find(row=>row.name==='1H_Melee_Attack_Chop');
  assert.equal(attack.index,12);
  assert.equal(attack.duration,.7);
  assert.equal(attack.category,'combat');

  const registry=buildReviewMotionRegistry(clips);
  assert.equal(filterMotionReviewCatalog(buildMotionReviewCatalog(registry.motions),'all').length,motionRegistryCount(registry));
  const [html,js,pkg]=await Promise.all([
    readFile(new URL('../review-motion.html',import.meta.url),'utf8'),
    readFile(new URL('../src/review-motion.js',import.meta.url),'utf8'),
    readFile(new URL('../package.json',import.meta.url),'utf8')
  ]);
  assert.doesNotMatch(html+js,/MOTION CLIPS\s+\d+/);
  assert.match(js,/motionRegistryCount\(registry\)/);
  const scripts=JSON.parse(pkg).scripts;
  assert.doesNotMatch(String(scripts.predev)+String(scripts.prebuild),/review-motion|playwright|chromium/i);
});
