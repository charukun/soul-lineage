import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {cameraOffsetForPosition} from '../src/rebuild/camera-position-control.js';

const control=await readFile(new URL('../src/rebuild/camera-position-control.js',import.meta.url),'utf8');
const css=await readFile(new URL('../src/rebuild/camera-position-control.css',import.meta.url),'utf8');
const renderer=await readFile(new URL('../src/rebuild/renderer.js',import.meta.url),'utf8');

test('camera seek keeps the existing default view while allowing near and far positions',()=>{
  assert.deepEqual(cameraOffsetForPosition(0),[6,4.5,8]);
  assert.deepEqual(cameraOffsetForPosition(.5),[10.5,11.5,14.5]);
  assert.deepEqual(cameraOffsetForPosition(1),[15,18.5,21]);
  assert.deepEqual(cameraOffsetForPosition(-2),[6,4.5,8]);
  assert.deepEqual(cameraOffsetForPosition(4),[15,18.5,21]);
});

test('camera seek is a vertical center-left range control wired into the follow camera offset',()=>{
  assert.match(control,/slider\.type=['"]range['"]/);assert.match(control,/aria-orientation['"],['"]vertical['"]/);assert.match(control,/addEventListener\(['"]input['"]/);
  assert.match(css,/\.camera-position-control\{/);assert.match(css,/left:max\(/);assert.match(css,/top:50%/);assert.match(css,/transform:rotate\(-90deg\)/);
  assert.match(renderer,/createCameraPositionControl/);assert.match(renderer,/camOffset\.set\(\.\.\.cameraOffsetForPosition\(position\)\)/);assert.match(renderer,/desired\.copy\(target\)\.add\(camOffset\)/);
});
