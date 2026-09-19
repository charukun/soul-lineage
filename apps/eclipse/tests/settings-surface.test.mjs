import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('settings use app-owned choices instead of native select and checkbox controls',async()=>{
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
  assert.doesNotMatch(html,/<select\b/i);
  assert.doesNotMatch(html,/type=["']checkbox["']/i);
  assert.match(html,/data-quality="auto"/);
  assert.match(html,/id="shake-setting"[^>]*aria-pressed="true"/);
  assert.match(main,/settings\.quality=button\.dataset\.quality/);
  assert.match(main,/settings\.shake=!settings\.shake/);
});
