import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {detectFlickDash,FLICK_DASH_BURST_MS} from '../src/rebuild/flick-dash.js';

test('quick directional flick becomes a normalized dash burst',()=>{
  const dash=detectFlickDash({startX:20,startY:30,endX:92,endY:66,durationMs:150});
  assert.ok(dash);
  assert.equal(dash.durationMs,FLICK_DASH_BURST_MS);
  assert.ok(Math.abs(Math.hypot(dash.axis.x,dash.axis.y)-1)<1e-9);
  assert.ok(dash.axis.x>0);
  assert.ok(dash.axis.y>0);
});

test('short movement and slow drag stay normal movement',()=>{
  assert.equal(detectFlickDash({startX:0,startY:0,endX:20,endY:0,durationMs:90}),null);
  assert.equal(detectFlickDash({startX:0,startY:0,endX:80,endY:0,durationMs:420}),null);
});

test('current Rinne UI stays intact while runtime owns flick dash',async()=>{
  const [ui,runtime,upgrade]=await Promise.all([
    readFile(new URL('../src/gameplay-ui.js',import.meta.url),'utf8'),
    readFile(new URL('../src/rebuild/runtime.js',import.meta.url),'utf8'),
    readFile(new URL('../src/gameplay-upgrade.js',import.meta.url),'utf8'),
  ]);
  assert.match(ui,/data-heart/);
  assert.match(ui,/data-body/);
  assert.doesNotMatch(ui,/data-dash/);
  assert.match(ui,/フリックするとダッシュ/);
  assert.match(runtime,/detectFlickDash/);
  assert.match(runtime,/movementAxis/);
  assert.match(runtime,/rinne:flick-dash/);
  assert.match(runtime,/renderCoopFrame\(dt,frameMs,now\)/);
  assert.match(upgrade,/addEventListener\('rinne:flick-dash'/);
  assert.match(upgrade,/DASH_DRAIN=30/);
  assert.match(upgrade,/ui\.dash\.addEventListener/);
});
