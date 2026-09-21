import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(path,import.meta.url),'utf8');

test('family ritual is launched after Start without owning any title markup',async()=>{
  const [main,ui,css]=await Promise.all([read('../src/main.js'),read('../src/family-origin-ui.js'),read('../src/family-origin.css')]);
  assert.match(main,/await openFamilyOrigin/);
  assert.match(main,/titleCinematic\.pause\(\);enterRinneLineageAudio\(\)/);
  assert.doesNotMatch(main,/renderFamilyTitle/);
  assert.doesNotMatch(ui,/export function renderFamilyTitle/);
  for(const retired of ['family-return-world','title-family-caption','data-family'])assert.doesNotMatch(css,new RegExp(retired));
  assert.doesNotMatch(css,/\.title-screen/);
});

test('ritual choices are spatial memory orbs rather than the retired flat card surface',async()=>{
  const [ui,css]=await Promise.all([read('../src/family-origin-ui.js'),read('../src/family-origin.css')]);
  for(const token of ['family-ritual-world','family-ancestral-gate','family-water-horizon','family-memory-altar','family-memory-orb','family-orb-rings','family-orb-core','family-oath-gate'])assert.match(ui,new RegExp(token),token);
  assert.match(ui,/dialog\.dataset\.scene = 'ritual'/);
  assert.match(ui,/dialog\.dataset\.transitioning = 'true'/);
  assert.doesNotMatch(ui,/family-memory-choice/);
  assert.doesNotMatch(css,/family-memory-choice/);
  assert.ok((css.match(/@keyframes family-/g)||[]).length>=12,'ritual requires layered animation rather than a static page');
  assert.match(css,/perspective\(430px\)/);
  assert.match(css,/conic-gradient/);
  assert.match(css,/clip-path:polygon/);
});

test('ritual audio layers onto the existing Rinne audio graph and restores it on exit',async()=>{
  const [audio,main,ui]=await Promise.all([read('../src/gameplay-audio.js'),read('../src/main.js'),read('../src/family-origin-ui.js')]);
  for(const name of ['enterRinneLineageAudio','exitRinneLineageAudio','playRinneLineageAudio'])assert.match(audio,new RegExp(`export const ${name}`));
  assert.match(audio,/function startLineageAmbience\(\)/);
  assert.match(audio,/createBiquadFilter\(\)/);
  assert.match(audio,/createOscillator\(\)/);
  assert.match(audio,/createBufferSource\(\)/);
  assert.match(audio,/titleGainTo\(TITLE_MUSIC_GAIN\*\.36/);
  assert.match(audio,/function enterGameplay\(\)\{[\s\S]*exitLineage\(\)/);
  assert.ok(main.indexOf('enterRinneLineageAudio()')<main.indexOf('await openFamilyOrigin'),'ritual sound must begin with the post-Start scene');
  assert.match(main,/finally\{originOpen=false;exitRinneLineageAudio\(\);\}/);
  for(const cue of ["'focus'","'choose'","'back'","'cancel'","'confirm'"])assert.match(ui,new RegExp(`playRinneLineageAudio\\(${cue}`));
});

test('ritual keeps accessibility and reduced-motion escape routes',async()=>{
  const [ui,css]=await Promise.all([read('../src/family-origin-ui.js'),read('../src/family-origin.css')]);
  assert.match(ui,/aria-labelledby/);
  assert.match(ui,/aria-pressed/);
  assert.match(ui,/data-origin-back/);
  assert.match(ui,/data-origin-cancel/);
  assert.match(ui,/dataset\.replaceFamily/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/family-origin\[data-motion=off\]/);
});
