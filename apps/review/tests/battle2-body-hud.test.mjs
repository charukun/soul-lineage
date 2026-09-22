import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('battle2 body HUD is a compact six-part liquid gauge beside the player card',()=>{
 const html=read('battle2.html'),stage=read('src/nocturne-stage.js'),hud=read('src/battle2-body-hud.js'),css=read('src/battle2-body-hud.css'),version=read('src/battle2-version.js');
 assert.match(html,/id="battle2-body-hud" class="battle2-body-hud-host"/);assert.match(stage,/createBattle2BodyHud/);assert.match(stage,/bodyHud\?\.update\(hero\)/);
 assert.match(hud,/COMBAT_BODY_PARTS/);assert.match(hud,/combatBodySnapshot/);assert.match(hud,/battle2-body-hud__liquid/);assert.match(hud,/--level/);
 assert.doesNotMatch(hud,/battle2-body-hud__detail|battle2-body-hud__gauge|function toggle|aria-expanded|addEventListener\('click'/);
 assert.match(css,/width:40px;height:46px/);assert.match(css,/height:var\(--level\)/);assert.match(css,/@keyframes b2-body-water/);assert.match(css,/@keyframes b2-body-bubbles/);assert.match(css,/@keyframes b2-body-surge/);assert.match(css,/@keyframes b2-body-splash/);
 assert.match(css,/data-body-part=head/);assert.match(css,/data-body-part=torso/);assert.match(css,/data-hit=true/);assert.match(version,/BATTLE2_VERSION='2\.2\.38'/);
});
