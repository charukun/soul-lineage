import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('resident visibility is owned synchronously by the actor renderer',()=>{
 const view=fs.readFileSync(new URL('../src/web/view.js',import.meta.url),'utf8');
 assert.match(view,/n\.visible=!p\.dead&&\(!p\.hidden\|\|this\.world\.people\.includes\(p\)\)/);
 assert.ok(!view.includes('setInterval('));
});
