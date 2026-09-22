import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('battle2 body HUD is medium-compact with a softly shaped torso and static player avatar',()=>{
 const html=read('battle2.html'),stage=read('src/nocturne-stage.js'),hud=read('src/battle2-body-hud.js'),css=read('src/battle2-body-hud.css'),player=read('../../packages/shared-ui/src/rinne-player-hud.js'),version=read('src/battle2-version.js');
 assert.match(html,/id="battle2-body-hud" class="battle2-body-hud-host"/);assert.match(stage,/createBattle2BodyHud/);assert.match(stage,/bodyHud\?\.update\(hero\)/);
 assert.match(css,/width:44px;height:50px/);assert.match(css,/data-body-part=torso\]\{left:16px;top:14px;width:12px;height:15px;border-radius:5px 5px 6px 6px\}/);assert.doesNotMatch(css,/data-body-part=torso[^\n]*clip-path/);
 assert.match(stage,/portraitMode:'static'/);assert.doesNotMatch(stage,/playerHud\?\.capture\(world/);assert.match(player,/createStaticAvatar/);assert.match(player,/avatarSeed:n/);
 assert.match(hud,/battle2-body-hud__liquid/);assert.match(version,/BATTLE2_VERSION='2\.2\.43'/);
});
