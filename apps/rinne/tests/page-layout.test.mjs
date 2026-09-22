import test from 'node:test';
import assert from 'node:assert/strict';
import {packPages} from '../src/story/page-layout.js';
test('pages retain every control in order and keep chapters separate',()=>{
  const chapters=[{title:'攻',items:[{id:1,height:100},{id:2,height:90},{id:3,height:110}]},{title:'防',items:[{id:4,height:30}]}];
  const pages=packPages(chapters,200);
  assert.deepEqual(pages.map(p=>p.items.map(i=>i.id)),[[1,2],[3],[4]]);
  assert.deepEqual(pages.map(p=>p.title),['攻','攻','防']);
});
test('an oversized indivisible unit remains reachable on its own page',()=>{
  const pages=packPages([{title:'手帳',items:[{id:1,height:50},{id:2,height:600},{id:3,height:60}]}],120);
  assert.deepEqual(pages.map(p=>p.items.map(i=>i.id)),[[1],[2],[3]]);
});
