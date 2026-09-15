import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const indexUrl=new URL('../index.html',import.meta.url);
const mainUrl=new URL('../src/main.js',import.meta.url);
const enhancementsUrl=new URL('../src/mura-enhancements.js',import.meta.url);

test('village installs an explicit favicon instead of an empty data icon',async()=>{
 const html=await readFile(indexUrl,'utf8');
 assert.match(html,/rel="icon"[^>]+favicon\.svg/);
 assert.doesNotMatch(html,/rel="icon"\s+href="data:,"/);
});

test('village default BGM avoids native HTML audio autoplay',async()=>{
 const [main,enhancements]=await Promise.all([readFile(mainUrl,'utf8'),readFile(enhancementsUrl,'utf8')]);
 assert.match(main,/autoStart:false/);
 assert.match(main,/mura-enhancements\.js/);
 assert.match(enhancements,/mura-background-bgm\.js/);
});
