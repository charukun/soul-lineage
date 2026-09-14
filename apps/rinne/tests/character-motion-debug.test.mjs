import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('Character Workshop loads the Motion QA debug overlay',async()=>{const html=await readFile(new URL('../characters.html',import.meta.url),'utf8'),source=await readFile(new URL('../src/character-motion-debug.js',import.meta.url),'utf8');assert.match(html,/character-motion-debug\.js/);assert.match(source,/motion-debug-overlay/);assert.match(source,/motion-debug-summary/);assert.match(source,/window\.masterCharacterReview/);assert.match(source,/qa\?\.active/);});
test('overlay visualizes real COM/support and semantic evidence without gameplay inference',async()=>{const source=await readFile(new URL('../src/character-motion-debug.js',import.meta.url),'utf8');assert.match(source,/estimateCenterOfMass/);assert.match(source,/leftFoot/);assert.match(source,/rightFoot/);assert.match(source,/createSemanticMotionTimeline/);assert.match(source,/authored-slash\.js/);assert.match(source,/gameplay input時のみ/);assert.doesNotMatch(source,/\.x\s*=|\.z\s*=|\.yaw\s*=/,'debug overlay must not write actor authority');});
