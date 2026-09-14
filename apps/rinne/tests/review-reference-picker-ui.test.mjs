import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const models=readFileSync(new URL('../src/review/reference-character-models.js',import.meta.url),'utf8');
test('role references include the ten requested selectable designs',()=>{
  for(const name of ['Child Boy','Child Girl','Elderly Man','Elderly Woman','Guard','Knight','Blacksmith','Laborer','Hunter','Arcanist'])assert.match(models,new RegExp(`name:'${name}'`));
});
