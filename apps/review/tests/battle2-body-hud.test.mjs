import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('battle2 uses the current hero model portrait and a decorated chibi body vessel',()=>{
 const html=read('battle2.html'),stage=read('src/nocturne-stage.js'),hud=read('src/battle2-body-hud.js'),css=read('src/battle2-body-hud.css'),player=read('../../packages/shared-ui/src/rinne-player-hud.js'),runtime=read('../../packages/johakyu-presentation/src/runtime.js'),version=read('src/battle2-version.js');
 assert.match(html,/id="battle2-body-hud" class="battle2-body-hud-host"/);assert.match(stage,/bodyHud\?\.update\(hero\)/);
 assert.match(stage,/renderPlayerPortrait\?\.\(playerHud\.canvas\)/);assert.doesNotMatch(stage,/portraitMode:'static'|playerHud\?\.capture\(world/);
 assert.match(runtime,/function renderSelfPortrait\(canvas\)/);assert.match(runtime,/selfBinding\.object\.traverse/);assert.match(runtime,/readRenderTargetPixels/);
 assert.doesNotMatch(player,/createStaticAvatar|AVATAR_SKIN|AVATAR_HAIR/);assert.match(player,/markPortrait/);assert.match(player,/clearPortrait/);
 assert.match(css,/width:48px;height:54px/);assert.match(css,/battle2-body-hud__figure::before/);assert.match(css,/battle2-body-hud__figure::after/);assert.match(css,/data-body-part=head\]\{left:18\.5px;top:5px;width:11px;height:11px/);assert.match(css,/data-body-part=torso\]\{left:17\.5px;top:17px;width:13px;height:17px;border-radius:6px 6px 7px 7px/);assert.doesNotMatch(css,/data-body-part=torso[^\n]*clip-path/);
 assert.match(hud,/battle2-body-hud__liquid/);assert.match(css,/@keyframes b2-body-hit/);assert.match(version,/BATTLE2_VERSION='2\.2\.44'/);
});
