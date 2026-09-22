import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const index=readFileSync(new URL('../public/lanternfell/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/lanternfell/village-atmosphere.css',import.meta.url),'utf8');
const view=readFileSync(new URL('../public/lanternfell/night-view.mjs',import.meta.url),'utf8');

test('Lanternfell keeps its moonlit renderer and receives shared village atmosphere techniques',()=>{
 assert.match(index,/village-atmosphere\.css/);
 assert.match(css,/radial-gradient/);assert.match(css,/contrast\(/);assert.match(css,/saturate\(/);
 assert.match(view,/Fog\('#14213b'/);assert.match(view,/PointLight/);assert.match(view,/DirectionalLight/);assert.match(view,/UnrealBloomPass/);
});
