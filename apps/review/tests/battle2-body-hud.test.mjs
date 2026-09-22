import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('battle2 body HUD stays compact and opens one six-part durability list',()=>{
 const html=read('battle2.html'),stage=read('src/nocturne-stage.js'),hud=read('src/battle2-body-hud.js'),css=read('src/battle2-body-hud.css'),version=read('src/battle2-version.js');
 assert.match(html,/id="battle2-body-hud" class="battle2-body-hud-host"/);assert.match(stage,/createBattle2BodyHud/);assert.match(stage,/bodyHud\?\.update\(hero\)/);
 assert.match(hud,/COMBAT_BODY_PARTS/);assert.match(hud,/combatBodySnapshot/);assert.doesNotMatch(hud,/combatBodyOutcome|selectedPart|META=/);
 assert.match(hud,/battle2-body-hud__list/);assert.match(hud,/for\(const part of COMBAT_BODY_PARTS\)/);assert.match(hud,/const label=document\.createElement\('span'\)/);assert.match(hud,/gauge\.label\.textContent=part\.label/);assert.match(hud,/aria-expanded/);assert.match(hud,/function toggle\(\)/);
 assert.match(css,/grid-template-columns:40px minmax\(0,168px\)/);assert.match(css,/width:40px;height:62px/);assert.match(css,/battle2-body-hud__gauge/);assert.match(css,/grid-template-columns:28px minmax\(0,1fr\) 48px/);
 assert.match(css,/grid-template-columns:28px minmax\(0,1fr\)!important/);assert.match(css,/battle2-body-hud__gauge>span/);assert.match(css,/data-hit=true/);assert.match(version,/BATTLE2_VERSION='2\.2\.35'/);
});
