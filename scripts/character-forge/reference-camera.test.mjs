import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import * as THREE from 'three';
import {applyReferenceCamera} from '../../packages/assets/forge/reference_camera.js';
import {characterReferenceShot} from '../../packages/assets/src/character-create-forge/reference-view.js';
import {createCameraDirector} from '../../packages/rendering/src/camera-director.js';
import {applyCameraPresentation} from '../../packages/rendering/src/camera-presentation-three.js';

test('Three camera agrees with the pinned Python projector for nonzero rotations',()=>{
  const data=JSON.parse(execFileSync('python3',['-c',`
import sys,json
from pathlib import Path
sys.path.insert(0,'packages/assets/forge')
from upstream_workspace import install_boundary
c=Path('.cache/character-forge-upstream').resolve()
root=install_boundary(c,c/'host')['engine'];sys.path.insert(0,str(root))
from forge.stage1_intake.camera_fitting_math import project_landmark
from forge.stage1_intake.camera_fitting_types import CameraParameters
points=[[-.3,.1,.12],[.2,1.1,-.3],[0,.8,.05]]
cases=[]
for yaw,pitch,roll in [(13,-7,4),(-21,11,-8),(0,0,0)]:
 camera=CameraParameters(image_width=320,image_height=640,fov_degrees=27,yaw_degrees=yaw,pitch_degrees=pitch,roll_degrees=roll,position=(.15,.72,4.2))
 cases.append({'descriptor':{'imageWidth':320,'imageHeight':640,'fit':{'finalReprojectionError':0,'cameraParameters':{'position':[.15,.72,4.2],'fovDegrees':27,'yawDegrees':yaw,'pitchDegrees':pitch,'rollDegrees':roll}}},'expected':[project_landmark(p,camera) for p in points]})
print(json.dumps({'points':points,'cases':cases}))
`],{encoding:'utf8'}));
  for(const row of data.cases){
    const camera=applyReferenceCamera(THREE,new THREE.PerspectiveCamera(),row.descriptor);
    for(let i=0;i<data.points.length;i++){
      const p=new THREE.Vector3(...data.points[i]).project(camera),pixel=[(p.x+1)*160,(1-p.y)*320];
      assert.ok(Math.hypot(...pixel.map((v,axis)=>v-row.expected[i][axis]))<1e-9);
    }
  }
  assert.throws(()=>applyReferenceCamera(THREE,new THREE.PerspectiveCamera(),{...data.cases[0].descriptor,fit:{...data.cases[0].descriptor.fit,finalReprojectionError:3}}),/calibrated/);
});

test('reference pixels retain object-fit-contain placement through Camera Director and viewport changes',()=>{
  const descriptor={imageWidth:320,imageHeight:640,fit:{finalReprojectionError:0,cameraParameters:{position:[.15,.72,4.2],fovDegrees:27,yawDegrees:13,pitchDegrees:-7,rollDegrees:4}}};
  const manifest={referenceReview:{cameras:{front:descriptor,side:descriptor,back:descriptor}}};
  const reference=applyReferenceCamera(THREE,new THREE.PerspectiveCamera(),descriptor),point=new THREE.Vector3(.2,1.1,-.3),r=point.clone().project(reference);
  for(const aspect of [.35,.5,1,2]){
    const shot=characterReferenceShot(THREE,manifest,'front',aspect),camera=new THREE.PerspectiveCamera(50,aspect),director=createCameraDirector();
    camera.up.fromArray(shot.up);
    const vec=a=>({x:a[0],y:a[1],z:a[2]});
    const state=director.update({mode:'event',authoredShot:{position:vec(shot.position),lookTarget:vec(shot.lookTarget),fov:shot.fov}},0);
    applyCameraPresentation(camera,state);
    const p=point.clone().project(camera),width=640*aspect,scale=Math.min(width/320,1);
    assert.ok(Math.abs((p.x+1)*width/2-(width/2+r.x*160*scale))<1e-8);
    assert.ok(Math.abs((1-p.y)*320-(320-r.y*320*scale))<1e-8);
  }
  assert.equal(characterReferenceShot(THREE,{},'front',1),null);
  assert.equal(characterReferenceShot(THREE,manifest,'side',1).modelYaw,-Math.PI/2);
  assert.throws(()=>characterReferenceShot(THREE,{referenceReview:{cameras:{}}},'front',1),/Missing calibrated/);
});
