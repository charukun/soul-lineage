import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,existsSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

test('Forge keeps observed views, exports real skin/clips, and registers only validated candidates',{timeout:180000},()=>{
  const root=mkdtempSync(join(tmpdir(),'rinne-forge-')),fixture=join(root,'fixture');
  const python=process.env.CHARACTER_FORGE_PYTHON||'python3';
  if(spawnSync(python,['-c','import PIL']).status!==0)execFileSync(python,['-m','pip','install','--user','-r','packages/assets/forge/requirements.txt'],{stdio:'inherit',timeout:90000});
  execFileSync(python,['scripts/character-forge/fixture.py',fixture]);
  const create=(id,args)=>{execFileSync(python,['packages/assets/forge/pipeline.py','--root',root,'--id',id,'--name','Fixture','--provenance',join(fixture,'provenance.json'),...args],{stdio:'pipe'});const path=join(root,'packages/assets/characters/forge',id);return {path,spec:JSON.parse(readFileSync(join(path,'spec/reconstruction.json'))),manifest:JSON.parse(readFileSync(join(path,'manifest.json'))),report:JSON.parse(readFileSync(join(path,'validation-report.json')))};};
  try{
    const multi=create('multi',['--front',join(fixture,'front.png'),'--side',join(fixture,'side.png'),'--back',join(fixture,'back.png')]);
    assert.equal(multi.spec.reconstructionMode,'multi-view');assert.equal(multi.manifest.reviewStatus,'review-candidate');assert.equal(multi.manifest.productionReady,false);
    for(const view of ['front','side','back']){assert.ok(multi.spec.textureProjection.sampleContributions[view]>100);assert.ok(multi.report.comparisons[view]);assert.ok(multi.report.comparisons[view].silhouetteMismatch<.30);}
    assert.ok(multi.report.performance.triangles>2000);assert.equal(multi.report.structuralStatus,'passed');
    assert.ok(multi.report.sideDepthDiagnostics.chest);assert.ok(multi.spec.depthMeasurements.chest.frontDepth>0);assert.ok(multi.spec.depthMeasurements.chest.backDepth>0);
    assert.ok(multi.spec.components.find(c=>c.id==='torso').rings.some(r=>Math.abs(r.frontDepth-r.backDepth)>1e-5),'Side reconstruction must preserve front/back asymmetry');
    const refinement=JSON.parse(readFileSync(join(multi.path,'review/quality-refinement.json')));assert.equal(refinement.status,'pending-dcc-review');assert.deepEqual(refinement.requiredFixedViews,['front','side','back','three-quarter']);assert.equal(refinement.modelSha256,multi.manifest.model.sha256);
    assert.ok(multi.manifest.skeleton.bones.length>=20);assert.ok(multi.manifest.animations.length>=6);
    const sheet=create('sheet',['--sheet',join(fixture,'character-sheet.png')]);assert.equal(sheet.spec.reconstructionMode,'multi-view');assert.equal(Object.keys(sheet.spec.views).length,3);
    const single=create('single',['--front',join(fixture,'front.png')]);assert.equal(single.spec.reconstructionMode,'single-view');assert.equal(single.spec.depthMeasurements.chest.status,'inferred');
    const baseAnalysis=join(fixture,'base-only.json');writeFileSync(baseAnalysis,JSON.stringify({baseMeshOnly:true,parts:[]}));
    const baseOnly=create('base-only',['--front',join(fixture,'front.png'),'--side',join(fixture,'side.png'),'--back',join(fixture,'back.png'),'--analysis',baseAnalysis]);
    assert.ok(!baseOnly.spec.components.some(c=>c.id==='clothing'||c.id==='rearHair'),'Golden Base must not synthesize clothing or hair shells');
    assert.notDeepEqual(single.spec.components.find(c=>c.id==='head').rings,multi.spec.components.find(c=>c.id==='head').rings,'Side must change depth geometry');
    execFileSync(python,['-c','from PIL import Image; import sys; Image.open(sys.argv[1]).resize((220,360)).save(sys.argv[2])',join(fixture,'back.png'),join(fixture,'wide-back.png')]);
    const wider=create('wide-back',['--front',join(fixture,'front.png'),'--side',join(fixture,'side.png'),'--back',join(fixture,'wide-back.png')]);
    assert.notDeepEqual(wider.spec.components.find(c=>c.id==='rearHair').rings,multi.spec.components.find(c=>c.id==='rearHair').rings,'Back silhouette must change rear geometry');
    assert.notEqual(wider.manifest.model.sha256,multi.manifest.model.sha256);
    const five=create('five',['front','front34','side','back34','back'].flatMap(v=>['--'+v,join(fixture,v+'.png')]));assert.equal(five.spec.reconstructionMode,'enhanced-multi-view');assert.ok(five.spec.textureProjection.sampleContributions.front34>0);
    const registry=readFileSync(join(root,'packages/assets/generated/create-forge-registry.js'),'utf8');assert.match(registry,/multi\/manifest/);assert.match(registry,/qualityRefinementUrl/);
    create('multi',['--front',join(fixture,'front.png'),'--side',join(fixture,'side.png'),'--back',join(fixture,'back.png'),'--replace']);
    assert.doesNotMatch(readFileSync(join(root,'packages/assets/generated/create-forge-registry.js'),'utf8'),/previous/,'Atomic replace must not publish its temporary backup');
    assert.throws(()=>create('invalid',['--front',join(fixture,'front.png'),'--side',join(fixture,'side.png')]));
    assert.throws(()=>create('../escape',['--front',join(fixture,'front.png')]));
    const bytes=readFileSync(join(multi.path,'build/character.glb')),length=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+length));
    assert.ok(gltf.meshes.every(m=>m.primitives[0].attributes.WEIGHTS_0!==undefined));
    assert.ok(gltf.animations.every(a=>a.channels.length>0));assert.ok(gltf.nodes.some(n=>n.extras?.socket==='weapon'));
  }finally{rmSync(root,{recursive:true,force:true});}
});
