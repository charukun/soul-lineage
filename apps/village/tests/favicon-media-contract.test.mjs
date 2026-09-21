import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const indexUrl=new URL('../index.html',import.meta.url);
const mainUrl=new URL('../src/main.js',import.meta.url);
const enhancementsUrl=new URL('../src/mura-enhancements.js',import.meta.url);

test('village favicon and install icon share the 宝満叡智 crest',async()=>{
 const [html,favicon,appIcon,manifestRaw]=await Promise.all([
  readFile(indexUrl,'utf8'),
  readFile(new URL('../public/favicon.svg',import.meta.url),'utf8'),
  readFile(new URL('../public/icons/app-icon.svg',import.meta.url),'utf8'),
  readFile(new URL('../public/manifest.webmanifest',import.meta.url),'utf8'),
 ]);
 assert.match(html,/favicon\.svg\?v=5/);
 assert.equal(appIcon,favicon);
 assert.match(favicon,/<title id="title">宝満叡智<\/title>/);
 assert.match(favicon,/宝珠を抱く山/);
 const manifest=JSON.parse(manifestRaw);
 assert.equal(manifest.icons[0].src,'./icons/app-icon.svg?v=2');
 assert.match(manifest.icons[0].purpose,/maskable/);
});

test('village default BGM avoids native HTML audio autoplay',async()=>{
 const [main,enhancements]=await Promise.all([readFile(mainUrl,'utf8'),readFile(enhancementsUrl,'utf8')]);
 assert.match(main,/autoStart:false/);
 assert.match(main,/mura-enhancements\.js/);
 assert.match(enhancements,/mura-background-bgm\.js/);
});
