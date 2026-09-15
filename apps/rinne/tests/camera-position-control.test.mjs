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

test('camera control stays compact and renders its own readable rail and knob',()=>{
  assert.match(control,/camera-position-trigger/);assert.match(control,/camera-position-rail/);assert.match(control,/camera-position-knob/);assert.match(control,/knob\.style\.top/);assert.match(control,/panel\.hidden=true/);assert.match(control,/button\.addEventListener\('click'/);
  assert.match(css,/top:max\(54px/);assert.match(css,/width:44px;height:44px/);assert.match(css,/\.camera-position-panel\{[\s\S]*background:transparent;border:0;box-shadow:none/);assert.match(css,/\.camera-position-rail\{/);assert.match(css,/\.camera-position-knob\{/);assert.match(css,/opacity:0/);assert.doesNotMatch(css,/\.camera-position-panel\{[\s\S]{0,220}linear-gradient/);
  assert.match(renderer,/createCameraPositionControl/);assert.match(renderer,/camOffset\.set\(\.\.\.cameraOffsetForPosition\(position\)\)/);assert.match(renderer,/cameraControl\.setCombat\(!!combatFrame\)/);
});
