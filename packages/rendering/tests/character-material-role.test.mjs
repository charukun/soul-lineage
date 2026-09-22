import test from 'node:test';
import assert from 'node:assert/strict';
import { Bone, BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { characterMaterialRole } from '../src/character-material-role.js';
import { attachModularAppearanceController } from '../src/master-character-modular.js';
import { createMasterCharacterPool } from '../src/master-character.js';

const ATLAS = 'HeroineDawn_SoftClothAndHair';

test('dedicated legacy surfaces retain their role', () => {
  for (const [name, expected] of [['HAIR','hair'],['Body_SKIN','skin'],['EyeIris','eyes'],['CLOTH','dye'],['armor','other']])
    assert.equal(characterMaterialRole(name), expected);
});
test('mixed atlases cannot be classified by whichever keyword appears first', () => {
  for (const name of [ATLAS,'SkinHair','HairSkin','CLOTH_EyeIris','SKIN_CLOTH',''])
    assert.equal(characterMaterialRole(name), 'other');
  assert.equal(characterMaterialRole(), 'other');
});

function fixture(name) {
  const template=new Group(),humanoid={};
  const names=['hips','spine','head',...['left','right'].flatMap(s=>['UpperArm','LowerArm','Hand','UpperLeg','LowerLeg','Foot'].map(n=>s+n))];
  for(const name of names){const b=new Bone();b.name=name;b.position.y=.02;humanoid[name]=b;template.add(b);}
  const geometry=new BoxGeometry(.5,2,.3),material=new MeshStandardMaterial({name});
  template.add(new Mesh(geometry,material));
  const pool=createMasterCharacterPool({template,humanoid}),actor=pool.spawn('atlas-regression');
  return {actor,material,dispose(){pool.dispose();geometry.dispose();material.dispose();}};
}
const appearance={scale:1,headScale:1,height:1,width:1,gray:1,stoop:0,skinAge:0,adultHeightMetres:2,
  canEquipWeapon:true,dead:false,hair:[.1,.2,.3],eyes:[.2,.3,.4],skin:[.3,.2,.1],dye:[.1,.3,.2]};

test('saved replacement-hair profile cannot hide the face/limbs supplied by a shared atlas', () => {
  const f=fixture(ATLAS);
  try {
    const controller=attachModularAppearanceController(f.actor);
    controller.setProfile({version:1,face:'classic',hair:'tail',body:'balanced',outfit:'tunic',accessory:'none'});
    f.actor.sample(appearance);
    assert.equal(controller.diagnostics().sourceHairMaterials,0);
    const source=f.actor.visual.children.find(n=>n.isMesh);
    assert.equal(source.material.visible,true);
    assert.ok(source.material.color.equals(f.material.color));
    f.actor.reset();assert.equal(source.material.visible,true);
  } finally {f.dispose();}
});
test('shared atlas keeps authored texture shader rather than becoming all hair-colored', () => {
  const f=fixture(ATLAS);
  try {
    f.actor.sample(appearance);
    const source=f.actor.visual.children.find(n=>n.isMesh),shader={fragmentShader:'#include <map_fragment>',uniforms:{}};
    source.material.onBeforeCompile(shader,null);
    assert.equal(shader.fragmentShader,'#include <map_fragment>');
    assert.equal(shader.uniforms.masterHair,undefined);
    assert.ok(source.material.color.equals(f.material.color));
  } finally {f.dispose();}
});
test('dedicated hair still supports its existing tint and replacement behavior', () => {
  const f=fixture('HAIR');
  try {
    const controller=attachModularAppearanceController(f.actor);
    controller.setProfile({hair:'bob'});f.actor.sample(appearance);
    const source=f.actor.visual.children.find(n=>n.isMesh),shader={fragmentShader:'#include <map_fragment>',uniforms:{}};
    source.material.onBeforeCompile(shader,null);
    assert.equal(source.material.visible,false);assert.equal(controller.diagnostics().sourceHairMaterials,1);
    assert.ok(shader.uniforms.masterHair);assert.match(shader.fragmentShader,/masterGray/);
    f.actor.reset();assert.equal(source.material.visible,true);
  } finally {f.dispose();}
});
