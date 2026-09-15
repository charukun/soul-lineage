import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../src/mura-ux-polish-4.js',import.meta.url),'utf8');
const compat=fs.readFileSync(new URL('../src/mura-ux-polish-4b.js',import.meta.url),'utf8');

test('mobile UX polish includes requested tactile and guidance features',()=>{
 for(const needle of[
  'muraUiRipple','muraTutorialTarget','muraPersonDialog','muraHudExpanded',
  "#drawer footer #more{display:none!important}","translate:0 -30px",
  "kind==='logging'","kind==='storage'","kind==='wheat'","kind==='quarry'",
  '一族の家にはNPCは入居できません'
 ])assert.ok(source.includes(needle),needle);
});

test('facility decoration enriches live nodes without a second full boot rebuild',()=>{
 assert.ok(source.includes('muraFacilityDecorated'));
 assert.ok(source.includes('view.objectNodes.get(o.id)'));
 assert.ok(source.includes('view.renderer.shadowMap.needsUpdate=true'));
 assert.ok(!source.includes('view.buildingCache?.clear?.();view.rebuild?.();'));
});

test('facility rooms stay editable by the mayor',()=>{
 assert.ok(compat.includes("d?.building&&!d.capacity"));
 assert.ok(compat.includes("title.textContent='施設内装'"));
 assert.ok(compat.includes("text.textContent='村長が整えられます'"));
});
