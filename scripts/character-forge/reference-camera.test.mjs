import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import * as THREE from 'three';
import {applyReferenceCamera} from '../../packages/assets/forge/reference_camera.js';

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
