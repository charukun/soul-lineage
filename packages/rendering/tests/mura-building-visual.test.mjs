import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createMuraBuildingVisual,resolveMuraHouseVisual} from '../src/mura/building-visual.js';
import {defs} from '@soul/world/mura/catalog';

const sizeOf=group=>{group.updateMatrixWorld(true);const size=new THREE.Vector3();new THREE.Box3().setFromObject(group).getSize(size);return size;};

test('MURA residential kinds resolve to 尽喰廻遊 house silhouettes',()=>{
  assert.deepEqual(resolveMuraHouseVisual('home','base',1),{type:'cottage',palette:2,floors:1});
  assert.deepEqual(resolveMuraHouseVisual('home','timber',1),{type:'roundhouse',palette:3,floors:1});
  assert.deepEqual(resolveMuraHouseVisual('home','stone',2),{type:'tallhouse',palette:5,floors:2});
  assert.deepEqual(resolveMuraHouseVisual('lodge','base',1),{type:'tallhouse',palette:2,floors:2});
  assert.deepEqual(resolveMuraHouseVisual('clanManor','stone',1),{type:'manor',palette:5,floors:2});
  assert.equal(resolveMuraHouseVisual('school','base',1),null);
});

test('shared house visuals fit the existing MURA footprint without changing its contract',()=>{
  const fallback={building(){throw new Error('residential visuals must not use the legacy MURA building renderer');}};
  for(const [kind,material,level] of [['home','base',1],['home','timber',1],['home','stone',2],['lodge','base',1],['clanManor','stone',1]]){
    const model=createMuraBuildingVisual(THREE,fallback,kind,material,level),size=sizeOf(model),def=defs[kind];
    assert.equal(model.userData.sharedHouseVisual,true);
    assert.equal(model.userData.houseVisualSource,'@soul/housing-assets');
    assert.equal(model.userData.muraKind,kind);
    assert.ok(size.x<=def.w*.86+.02,`${kind} width ${size.x} exceeds visual footprint`);
    assert.ok(size.z<=def.d*.86+.02,`${kind} depth ${size.z} exceeds visual footprint`);
    const bounds=new THREE.Box3().setFromObject(model);
    assert.ok(Math.abs(bounds.min.y)<.02,`${kind} should remain grounded`);
  }
});

test('non-residential buildings remain on the existing MURA renderer',()=>{
  const sentinel=new THREE.Group();let args=null;
  const models={building(...next){args=next;return sentinel;}};
  assert.equal(createMuraBuildingVisual(THREE,models,'school','stone',2),sentinel);
  assert.deepEqual(args,['school','stone',2]);
});
