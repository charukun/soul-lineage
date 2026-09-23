import test from 'node:test';
import assert from 'node:assert/strict';
import {SNAP_CAMERA_STEP,rotateCameraOffset,tiltCameraOffsetForZoom,snapCameraYaw,zoomFromVerticalSwipe} from '../src/snap-camera-control.js';

test('snap camera uses eight 45 degree headings',()=>{
  assert.equal(snapCameraYaw(1),SNAP_CAMERA_STEP);
  assert.equal(snapCameraYaw(8),0);
  assert.equal(snapCameraYaw(-1),SNAP_CAMERA_STEP*7);
});

test('camera offset rotates around target and preserves vertical scale',()=>{
  const rotated=rotateCameraOffset({x:0,y:10,z:10},Math.PI/2,.8);
  assert.ok(Math.abs(rotated.x+8)<1e-9);
  assert.ok(Math.abs(rotated.z)<1e-9);
  assert.equal(rotated.y,8);
});

test('vertical swipe zooms in upward and out downward with clamps',()=>{
  assert.equal(zoomFromVerticalSwipe(1,-20,{min:.6,max:1.4,sensitivity:.01}),.8);
  assert.equal(zoomFromVerticalSwipe(1,20,{min:.6,max:1.4,sensitivity:.01}),1.2);
  assert.equal(zoomFromVerticalSwipe(1,-100,{min:.6,max:1.4,sensitivity:.01}),.6);
  assert.equal(zoomFromVerticalSwipe(1,100,{min:.6,max:1.4,sensitivity:.01}),1.4);
});

test('zooming in lowers the camera toward the horizon without changing its orbit heading',()=>{
  const offset={x:8,y:8,z:11};
  const pitch=zoom=>{const view=tiltCameraOffsetForZoom(offset,zoom);assert.equal(view.x,offset.x);assert.equal(view.z,offset.z);return Math.atan2(view.y,Math.hypot(view.x,view.z));};
  assert.ok(pitch(.64)<pitch(1));
  assert.ok(pitch(1)<pitch(1.48));
  assert.ok(pitch(.64)>0);
  assert.ok(Math.abs(tiltCameraOffsetForZoom(offset,1).y-offset.y)<1e-9);
});
