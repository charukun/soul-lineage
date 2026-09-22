import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

test('Golden Base retains Blender DCC review evidence',()=>{
  const pkg='packages/assets/characters/forge/golden-base-v1';
  assert.ok(existsSync(pkg+'/source/golden-base.blend'));
  assert.equal(readFileSync(pkg+'/source/golden-base.blend').subarray(0,7).toString(),'BLENDER');
  for(const view of ['front','side','back'])assert.ok(existsSync(pkg+'/review/blender/'+view+'.png'));
  const review=JSON.parse(readFileSync(pkg+'/review/blender/review.json','utf8'));
  assert.ok(review.armatures.length);
  assert.ok(['Blink','Smile','MouthOpen'].every(name=>review.morphs.includes(name)));
  for(const socket of ['socket_head','socket_leftHand','socket_rightHand','socket_weapon'])assert.ok(review.sockets.includes(socket));
});
