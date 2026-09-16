import test from 'node:test';
import assert from 'node:assert/strict';
import {THREE as T} from '@soul/rendering';
import {createVisualSceneTracker} from '../src/visual-scene-tracker.js';
test('nested async replacements invalidate only their scene root and detached models no longer notify',()=>{
 const outside=new T.Group(),actors=new T.Group(),asset=new T.Group(),fallback=new T.Group();outside.add(asset);asset.add(fallback);const t=createVisualSceneTracker([outside,actors]);const first=t.revision(outside);
 asset.remove(fallback);asset.add(new T.Mesh());assert.ok(t.revision(outside)>first);assert.equal(t.revision(actors),1);
 const after=t.revision(outside);fallback.add(new T.Mesh());assert.equal(t.revision(outside),after);
 for(let i=0;i<120;i++){asset.position.x=i;assert.equal(t.revision(outside),after);}
 t.dispose();asset.add(new T.Mesh());assert.equal(t.revision(outside),0);
});
