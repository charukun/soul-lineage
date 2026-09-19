import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('Village primary HUD uses finite game pages instead of internal scrolling',async()=>{
 const [source,css,doc]=await Promise.all([
  read('src/web/interface.js'),
  read('src/web/consumer-game-ui.css'),
  read('docs/MURAAAAAAA.md'),
 ]);
 assert.match(source,/RESOURCE_PAGE_SIZE=6/);
 assert.match(source,/muraHudLifeTab/);
 assert.match(source,/muraHudResourceTab/);
 assert.match(source,/muraHudPager/);
 assert.match(css,/#muraHudDetails\{[\s\S]*?overflow:hidden/);
 assert.doesNotMatch(css,/#muraHudDetails\{[^}]*overflow:auto/);
 assert.match(doc,/縦スクロール領域・内部スクロールバー/);
});

test('Village build tray paginates candidates and never scrolls its catalog',async()=>{
 const [html,source,css]=await Promise.all([
  read('index.html'),
  read('src/web/main.js'),
  read('src/web/consumer-game-ui.css'),
 ]);
 assert.match(html,/id="catalogPager"/);
 assert.match(source,/CATALOG_PAGE_SIZE=6/);
 assert.doesNotMatch(source,/scrollIntoView/);
 assert.match(css,/#catalog\{[\s\S]*?overflow:hidden!important/);
});

test('Village chronicle, help, journal and population history are fixed pages',async()=>{
 const [chronicleSource,chronicleCss,mainSource,gameCss,populationCss]=await Promise.all([
  read('src/web/event-chronicle.js'),
  read('src/web/event-chronicle.css'),
  read('src/web/main.js'),
  read('src/web/consumer-game-ui.css'),
  read('src/web/population-history.css'),
 ]);
 assert.match(chronicleSource,/const PAGE_SIZE=4/);
 assert.match(chronicleCss,/\.muraChronicleList\{[^}]*overflow:hidden/);
 assert.match(mainSource,/JOURNAL_PAGE_SIZE=4/);
 assert.match(mainSource,/showHelpPage/);
 assert.match(gameCss,/dialog\{[\s\S]*?overflow:hidden/);
 assert.match(populationCss,/\.muraPopulationHistory\{[\s\S]*?overflow:hidden/);
});


test('facility controls follow the selected building and placement exposes free rotation',async()=>{
 const [html,source,view,css]=await Promise.all([
  read('index.html'),
  read('src/web/main.js'),
  read('src/web/view.js'),
  read('src/web/consumer-game-ui.css'),
 ]);
 assert.match(source,/focusFacility\(o,room\)/);
 assert.match(source,/view\.focus\(o\.x,o\.z/);
 assert.match(source,/positionFacilityContext\(\)/);
 assert.match(source,/view\.objectControlPoint\(o\)/);
 assert.match(view,/objectControlPoint\(o,roomId=null\)/);
 assert.match(css,/#context\.muraWorldContext/);
 assert.match(html,/id="muraRotation" type="range" min="0" max="360" step="1"/);
 assert.match(html,/aria-label="回転角度を自由に調整"/);
 assert.match(html,/id="rotate" aria-label="45度回転">45°<\/button>/);
 assert.match(source,/ui\.pending\.rot\+Math\.PI\/4/);
});
