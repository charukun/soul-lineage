import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('battle2 mounts a compact body-part HUD on the live stage',()=>{
  const html=read('battle2.html'),stage=read('src/nocturne-stage.js'),hud=read('src/battle2-body-hud.js'),css=read('src/battle2-body-hud.css'),version=read('src/battle2-version.js');
  assert.match(html,/id="battle2-body-hud" class="battle2-body-hud-host"/);
  assert.match(stage,/createBattle2BodyHud/);
  assert.match(stage,/runtime\?\.inspectActors\?\.\(\)\.find\(actor=>actor\.self\)/);
  assert.match(stage,/bodyHud\?\.update\(hero\)/);
  assert.match(stage,/bodyHud\?\.setVisible\(started&&prepared&&next!==\'ERROR\'\)/);
  assert.match(hud,/COMBAT_BODY_PARTS/);
  assert.match(hud,/combatBodySnapshot/);
  assert.match(hud,/combatBodyOutcome/);
  assert.match(hud,/previous\.get\(p\.id\)/);
  assert.match(hud,/flash\(p\.id\)/);
  assert.match(css,/left:max\(8px,env\(safe-area-inset-left\)\)/);
  assert.match(css,/top:max\(8px,env\(safe-area-inset-top\)\)/);
  assert.match(css,/data-tone=disabled/);
  assert.match(css,/data-hit=true/);
  assert.match(version,/BATTLE2_VERSION='2\.2\.11'/);
});
