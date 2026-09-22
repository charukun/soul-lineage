import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {measureReviewSubject,normalizeReviewSubject,positionReviewCamera} from '../src/review-preview-stage.js';

function controls(){return{target:new THREE.Vector3(),update(){this.updated=true;}};}

test('review subject normalization preserves proportions while grounding and centering',()=>{
  const root=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(2,4,1),new THREE.MeshBasicMaterial());
  mesh.position.set(3,5,-2);root.add(mesh);
  const before=measureReviewSubject(root).size;
  const frame=normalizeReviewSubject(root,{targetLongest:2});
  assert.ok(Math.abs(frame.box.min.y)<1e-9);
  assert.ok(Math.abs(frame.center.x)<1e-9);
  assert.ok(Math.abs(frame.center.z)<1e-9);
  assert.ok(Math.abs((frame.size.x/frame.size.y)-(before.x/before.y))<1e-9);
});

test('review camera framing accounts for viewport aspect without scaling the subject',()=>{
  const root=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(2,4,1),new THREE.MeshBasicMaterial());root.add(mesh);
  const camera=new THREE.PerspectiveCamera(38,.55,.01,80),orbit=controls();
  const scale=root.scale.clone();
  const result=positionReviewCamera({camera,controls:orbit,root,preset:'front'});
  assert.ok(result.distance>0);
  assert.deepEqual(root.scale.toArray(),scale.toArray());
  assert.equal(orbit.updated,true);
});
