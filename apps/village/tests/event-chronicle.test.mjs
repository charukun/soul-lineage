import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {collectAddedNews} from '../src/web/event-chronicle.js';

const event=(text,type='life')=>({text,type,day:1});
const readSibling=relative=>readFileSync(fileURLToPath(new URL(relative,import.meta.url)),'utf8');

test('chronicle ignores an unchanged news head',()=>{
 const old=event('old');
 const result=collectAddedNews([old],old);
 assert.deepEqual(result.added,[]);
 assert.equal(result.head,old);
});

test('chronicle collects a burst since the previous head',()=>{
 const old=event('old'),first=event('first'),second=event('second');
 const result=collectAddedNews([second,first,old],old);
 assert.deepEqual(result.added,[second,first]);
 assert.equal(result.head,second);
});

test('chronicle counts the first events after an empty village log',()=>{
 const first=event('first'),second=event('second');
 const result=collectAddedNews([second,first],null);
 assert.deepEqual(result.added,[second,first]);
});

test('chronicle degrades to the newest entry when history was replaced',()=>{
 const missing=event('missing'),latest=event('latest'),older=event('older');
 const result=collectAddedNews([latest,older],missing);
 assert.deepEqual(result.added,[latest]);
 assert.equal(result.head,latest);
});

test('automatic village moments never create a center-screen popup',()=>{
 const interfaceSource=readSibling('../src/web/interface.js');
 const chronicleSource=readSibling('../src/web/event-chronicle.js');
 assert.equal(interfaceSource.includes('muraIdleDetails'),false);
 assert.equal(interfaceSource.includes('world.state.moments'),false);
 assert.match(chronicleSource,/moment:'暮らし'/);
});
