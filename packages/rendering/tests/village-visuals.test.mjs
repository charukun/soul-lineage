import test from 'node:test';
import assert from 'node:assert/strict';
import {VILLAGE_VISUAL_PRESETS} from '../src/village-visuals.js';

test('shared village visual language defines distinct app moods',()=>{
 const day=VILLAGE_VISUAL_PRESETS.villageDay,night=VILLAGE_VISUAL_PRESETS.demonNight,lantern=VILLAGE_VISUAL_PRESETS.lanternNight;
 for(const p of [day,night,lantern]){assert.ok(p.fogNear<p.fogFar);assert.ok(p.exposure>0);assert.ok(p.hemiIntensity>0);assert.ok(p.keyIntensity>0);}
 assert.notEqual(day.background,night.background);assert.notEqual(night.background,lantern.background);
 assert.ok(day.fogFar>night.fogFar);assert.ok(lantern.fillIntensity>0);assert.ok(night.rimIntensity>0);
});
