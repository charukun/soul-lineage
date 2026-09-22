import test from 'node:test';
import assert from 'node:assert/strict';
import {EXPERIMENTAL_GENERATED_ASSETS} from '../generated/experimental-assets.js';

test('generated experimental assets stay review-only and self-describing',()=>{
  assert.ok(EXPERIMENTAL_GENERATED_ASSETS.length>=1);
  for(const asset of EXPERIMENTAL_GENERATED_ASSETS){
    assert.equal(asset.origin,'ai-generated');
    assert.equal(asset.status,'MATERIALIZED');
    assert.equal(asset.usage,'experimental-review');
    assert.equal(asset.productionEligible,false);
    assert.match(asset.runtimePath,/^experimental\/hi3dgen\//);
    assert.match(asset.provenancePath,/\.provenance\.json$/);
    assert.match(asset.thumbnailPath,/\/input\//);
    assert.match(asset.sha256,/^[a-f0-9]{64}$/);
    assert.ok(asset.byteLength>0 && asset.byteLength<=20*1024*1024);
    assert.ok(asset.inspection.triangles>0 && asset.inspection.triangles<=20000);
    assert.equal(asset.inspection.externalDependencies,0);
    assert.equal(asset.up,'+Y');
    assert.equal(asset.originPlacement,'ground-center');
  }
});
