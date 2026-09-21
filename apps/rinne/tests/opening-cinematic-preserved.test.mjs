import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(path,import.meta.url),'utf8');

test('saved families do not suppress the existing opening movie on app boot',async()=>{
  const [main,html,cinematic,css]=await Promise.all([
    read('../src/main.js'),
    read('../index.html'),
    read('../src/title-cinematic.js'),
    read('../src/family-origin.css'),
  ]);
  assert.match(html,/id="title-cinematic-video"/);
  assert.match(cinematic,/TITLE_MANIFEST_URL/);
  assert.match(cinematic,/this\.video\.src=/);
  const start=main.indexOf('function beginTitleCinematic()');
  const end=main.indexOf('\nconst onBrandEnter',start);
  assert.ok(start>=0&&end>start,'opening cinematic bootstrap must exist');
  const boot=main.slice(start,end);
  assert.match(boot,/titleCinematic\.begin\(\)/);
  assert.doesNotMatch(boot,/hasSave/,'a saved family must not skip the cold-start movie');
  assert.doesNotMatch(boot,/setPhase\('idle'\)/,'cold boot must not jump straight to the landing title');
});

test('family return artwork appears only after the cinematic has landed',async()=>{
  const css=await read('../src/family-origin.css');
  assert.match(css,/\.title-screen:not\(\[data-intro=idle\]\) \.family-return-world\{visibility:hidden\}/);
  assert.doesNotMatch(css,/data-family=unborn\]:not\(\[data-intro=idle\]\).*family-return-world/);
});

test('returning from active gameplay keeps the existing landing shortcut without deleting the movie',async()=>{
  const cinematic=await read('../src/title-cinematic.js');
  assert.match(cinematic,/if\(this\.returning\)\{this\.returning=false;this\.land\(\{seek:true,immediate:true\}\);return;\}/);
  assert.match(cinematic,/if\(this\.started\)return;/);
  assert.match(cinematic,/this\.started=true;this\.setPhase\('cinematic'\)/);
});
