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

test('Rinne has no dash button and wires flick dash through runtime',async()=>{
  const [ui,runtime,upgrade,main]=await Promise.all([
    readFile(new URL('../src/gameplay-ui.js',import.meta.url),'utf8'),
    readFile(new URL('../src/rebuild/runtime.js',import.meta.url),'utf8'),
    readFile(new URL('../src/gameplay-upgrade.js',import.meta.url),'utf8'),
    readFile(new URL('../src/main.js',import.meta.url),'utf8'),
  ]);
  assert.doesNotMatch(ui,/data-dash/);
  assert.match(runtime,/detectFlickDash/);
  assert.match(runtime,/rinne:flick-dash/);
  assert.match(upgrade,/addEventListener\('rinne:flick-dash'/);
  assert.match(main,/フリックでダッシュ/);
});
