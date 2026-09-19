import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {manifest} from '../model-manifest.mjs';
test('fresh source packs only; no excluded-game models',()=>{assert.equal(manifest.length,22);assert.equal(new Set(manifest.map(m=>m.sourcePath)).size,manifest.length);for(const m of manifest){assert.equal(m.author,'Quaternius');assert.equal(m.license,'CC0-1.0');assert.doesNotMatch(m.sourcePath,/KayKit|Kenney|Ultimate Monsters|Beholder|Chomper|Glub|Goleling/i);}});
test('no hand-built geometry or animation-library mannequin in the scene',async()=>{const world=await readFile(new URL('../src/adapters/world.js',import.meta.url),'utf8');const actor=await readFile(new URL('../src/adapters/actor.js',import.meta.url),'utf8');assert.doesNotMatch(world+actor,/new\s+THREE\.(?:Box|Sphere|Plane|Cylinder|Cone|Extrude|Lathe|Buffer)Geometry/);assert.match(actor,/assets\.model\(this\.isHero\?'RangerAnimations'/);assert.doesNotMatch(actor,/assets\.character\('RangerAnimations'/);});
