import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(path,import.meta.url),'utf8');

test('coach steps use one short action line instead of title plus instructional paragraph',async()=>{
 const view=await read('../src/mura-first-run-guide-view.js');
 for(const line of ['「つくる」をタップ','「空きテント」をタップ','指で場所を動かす','ここでタップ'])assert.match(view,new RegExp(line));
 assert.match(view,/build:\{number:1,title:'「つくる」をタップ',text:''/);
 assert.match(view,/place:\{number:4,title:'ここでタップ',text:''/);
 assert.match(view,/nodes\.replay\.hidden=true/);
});

test('coach surface removes ornate frame and hides secondary reading chrome',async()=>{
 const css=await read('../src/mura-first-run-guide.css');
 assert.match(css,/#muraFirstRunGuide\[data-mode="coach"\] \.muraFirstRunGuideCard:before,/);
 assert.match(css,/clip-path:none;border:0;border-radius:12px/);
 assert.match(css,/\.muraFirstRunGuideEyebrow\{display:none\}/);
 assert.match(css,/\.muraFirstRunGuideCard p\{display:none\}/);
 assert.match(css,/\.muraFirstRunGuideFooter\{display:none/);
});

test('error hints can still expand when the player needs an explanation',async()=>{
 const css=await read('../src/mura-first-run-guide.css');
 assert.match(css,/mura-first-run-hint \.muraFirstRunGuideCard p\{[\s\S]*display:block/);
});
