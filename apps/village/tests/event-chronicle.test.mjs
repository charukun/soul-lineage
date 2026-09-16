import test from 'node:test';
import assert from 'node:assert/strict';
import {collectAddedNews} from '../src/web/event-chronicle.js';

const event=(text,type='life')=>({text,type,day:1});

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
