import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

test('all independently deployable web apps live under apps',()=>{
  for(const id of ['rinne','village','demon','review','character-studio','pulse','wayfinder']) assert.equal(existsSync(new URL('../apps/'+id+'/',import.meta.url)),true,id);
  assert.equal(existsSync(new URL('../ops-board/',import.meta.url)),false);
  assert.equal(existsSync(new URL('../portal/',import.meta.url)),false);
});

test('RINNE no longer owns Character Studio HTML entries',()=>{
  for(const path of ['../apps/rinne/characters.html','../apps/rinne/characters-advanced.html','../apps/rinne/review.html']) assert.equal(existsSync(new URL(path,import.meta.url)),false,path);
  const vite=readFileSync(new URL('../apps/rinne/vite.config.js',import.meta.url),'utf8');
  assert.doesNotMatch(vite,/characters(?:Advanced)?:fileURLToPath|review:fileURLToPath/);
});

test('canonical app structure documents one independent DEV identity per app',()=>{
  const doc=readFileSync(new URL('../docs/APPLICATION_STRUCTURE.md',import.meta.url),'utf8');
  assert.match(doc,/apps\/character-studio/);
  assert.match(doc,/apps\/pulse/);
  assert.match(doc,/apps\/wayfinder/);
  assert.match(doc,/one canonical DEV\/public Worker URL/);
});
