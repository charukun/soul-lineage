import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {additionalAssets} from '../additional-assets.mjs';
const root=new URL('../public/',import.meta.url);
const sha256=b=>createHash('sha256').update(b).digest('hex');
test('compatible UAL1 is an independently hashed motion dependency, not a displayed mannequin',()=>{
 const manifest=JSON.parse(readFileSync(new URL('models/manifest.json',root),'utf8'));
 const source=additionalAssets[0],record=manifest.find(m=>m.id==='RangerAnimations').additionalMotion;
 assert.equal(record.role,'animation-only');assert.equal(record.id,source.id);
 assert.equal(record.source,source.sourceUrl);assert.equal(record.sha256,source.expectedSHA256);
 const bytes=readFileSync(new URL(record.file,root));assert.equal(sha256(bytes),source.expectedSHA256);
 const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
 for(const required of ['Jog_Fwd_Loop','Sword_Idle','Death01'])assert.ok(json.animations.some(a=>a.name===required));
 for(const bone of ['Head','hand_r','pelvis'])assert.ok(json.nodes.some(n=>n.name===bone));
});
test('texture delivery is compact, independently hashed, and leaves original source images intact',()=>{
 const delivery=JSON.parse(readFileSync(new URL('models/delivery.json',root),'utf8'));
 assert.equal(delivery.geometryChanges,0);assert.ok(delivery.textures.length>0);
 assert.ok(delivery.deliveryTextureBytes<delivery.originalTextureBytes*.2);
 for(const record of delivery.textures){
  const original=readFileSync(new URL(record.original.split('/').map(encodeURIComponent).join('/'),root));
  const delivered=readFileSync(new URL(record.file,root));
  assert.equal(sha256(original),record.originalSHA256);assert.equal(sha256(delivered),record.sha256);
  assert.ok(record.dimensions.every(n=>n>0&&n<=1024));
  assert.equal(delivery.byOriginal[record.original],record.file);
 }
});
