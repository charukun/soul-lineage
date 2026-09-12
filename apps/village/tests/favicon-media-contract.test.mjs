import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const indexUrl=new URL('../index.html',import.meta.url);
const mainUrl=new URL('../src/main.js',import.meta.url);

test('village installs an explicit favicon instead of an empty data icon',async()=>{
 const html=await readFile(indexUrl,'utf8');
 assert.match(html,/rel="icon"[^>]+favicon\.svg/);
 assert.doesNotMatch(html,/rel="icon"\s+href="data:,"/);
});

test('village default BGM avoids native HTML audio autoplay',async()=>{
 const source=await readFile(mainUrl,'utf8');
 assert.match(source,/autoStart:false/);
 assert.match(source,/mura-background-bgm\.js/);
});
