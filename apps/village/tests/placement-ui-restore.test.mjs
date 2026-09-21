import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('placement UI restores the rounded felt Village treatment',async()=>{
 const css=await readFile(new URL('../src/web/soft-placement-ui.css',import.meta.url),'utf8');
 for(const required of ['#drawer{','border-radius:19px!important','.card{','border-radius:16px!important','#placement{','border-radius:17px!important','村に、何を置こう。']){}
 assert.match(css,/#drawer\{[\s\S]*border-radius:19px!important/);
 assert.match(css,/\.card\{[\s\S]*border-radius:16px!important/);
 assert.match(css,/#placement\{[\s\S]*border-radius:17px!important/);
 assert.doesNotMatch(css,/#drawer\{[^}]*clip-path:polygon/);
 const [html,main]=await Promise.all([
  readFile(new URL('../index.html',import.meta.url),'utf8'),
  readFile(new URL('../src/web/main.js',import.meta.url),'utf8'),
 ]);
 assert.match(html,/drawerTitle">村に、何を置こう。/);
 assert.match(html,/選んで地面をタップ · 長押しでドラッグ/);
 assert.match(html,/id="cancelPlace">完了/);
 assert.match(html,/m3 11 9-8 9 8/);
 const confirm=main.slice(main.indexOf('function confirmPlacement()'),main.indexOf("$('build').onclick"));
 assert.match(confirm,/cancelPlacement\(\);deselect\(\);void save\(\)/);
 assert.doesNotMatch(confirm,/selection\(/);
});
