import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('Village retains the shared brand/audio gate and loads the app exactly once through it',async()=>{
 const index=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const start=await readFile(new URL('../src/brand-start.js',import.meta.url),'utf8');
 assert.equal((index.match(/src="\.\/src\/brand-start\.js"/g)||[]).length,1);
 assert.doesNotMatch(index,/src="\.\/src\/main\.js"/);
 assert.match(start,/openBrandBootGate\(\{/);
 assert.match(start,/app:'village'/);
 assert.match(start,/await import\('\.\/main\.js'\)/);
});
