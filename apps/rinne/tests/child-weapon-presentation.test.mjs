import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MIN_WEAPON_AGE_YEARS,SHINO_MASTER,ageAppearance} from '@soul/characters';
import {applyEquipmentStation,createLife} from '../src/rebuild/domain.js';
import {applyChildWeaponPose,childWeaponSwingScale,rinneWeaponPresentation} from '../src/rebuild/weapon-presentation.js';

const WEAPONS=Object.freeze(['dagger','sword','great','spear','axe','staff']);
const finite=value=>Array.isArray(value)&&value.every(Number.isFinite);
const bones=()=>Object.fromEntries(['rightUpperArm','rightLowerArm','leftUpperArm','leftLowerArm'].map(name=>[name,{rotation:{x:0,y:0,z:0}}]));

test('weapon eligibility starts exactly at four without changing the wardrobe contract',()=>{
  assert.equal(MIN_WEAPON_AGE_YEARS,4);
  assert.equal(ageAppearance(3.999).canEquipWeapon,false);
  assert.equal(ageAppearance(4).canEquipWeapon,true);
  assert.equal(ageAppearance(11.999).canEquipWeapon,true);
  assert.equal(SHINO_MASTER.wardrobeMode,'complete-outfit');
  assert.deepEqual(SHINO_MASTER.outfits.map(row=>row.id),['shino.uniform.original.v1','shino.uniform.moss.v1','shino.uniform.ember.v1']);
});

test('4-11 shared-child weapon profiles keep size, attachment and grip calibration per weapon',()=>{
  for(const weapon of WEAPONS){
    const four=rinneWeaponPresentation(weapon,4),eleven=rinneWeaponPresentation(weapon,11),adult=rinneWeaponPresentation(weapon,12);
    assert.equal(four.band,'child');assert.equal(eleven.band,'child');assert.equal(adult.band,'adult');
    assert.equal(four.scale,eleven.scale,weapon);assert.deepEqual(four.socketPosition,eleven.socketPosition,weapon);
    assert.equal(four.objectRotationZ,eleven.objectRotationZ,weapon);
    assert.ok(four.scale>0&&four.scale<=adult.scale,weapon);
    assert.ok(finite(four.socketPosition)&&finite(four.objectPosition),weapon);
    assert.equal(four.socketQuaternion.length,4,weapon);assert.ok(four.socketQuaternion.every(Number.isFinite),weapon);
    assert.ok(four.motion&&four.motion.rightSwing<1,weapon);
  }
  assert.ok(Math.abs(rinneWeaponPresentation('great',4).objectPosition[0])>.05);
  assert.ok(Math.abs(rinneWeaponPresentation('spear',4).objectPosition[0])>.2);
});

test('child armed motion suppresses weapon-hand swing and gives two-handed weapons a support-arm pose',()=>{
  const sword=rinneWeaponPresentation('sword',4),swordBones=bones();
  assert.ok(childWeaponSwingScale(sword,'right')<childWeaponSwingScale(sword,'left'));
  assert.equal(applyChildWeaponPose(swordBones,sword,{moving:true,combat:false},.2),true);
  assert.notEqual(swordBones.rightUpperArm.rotation.x,0);
  assert.equal(swordBones.leftUpperArm.rotation.x,0);

  const spear=rinneWeaponPresentation('spear',11),spearBones=bones();
  assert.equal(spear.twoHanded,true);
  assert.equal(applyChildWeaponPose(spearBones,spear,{moving:true,combat:true,attacking:true},.35),true);
  assert.notEqual(spearBones.rightUpperArm.rotation.x,0);
  assert.notEqual(spearBones.leftUpperArm.rotation.x,0);

  const adult=rinneWeaponPresentation('spear',12);
  assert.equal(adult.motion,null);
  assert.equal(applyChildWeaponPose(bones(),adult,{moving:true},.2),false);
});

test('automatic station boundary is weapon-only at four and the runtime stage consumes age-aware visual tuning',async()=>{
  const weaponStation={id:'rack.weapon.sword',label:'片手剣',equipment:{weapon:'sword'}};
  const armorStation={id:'rack.armor.light',label:'軽鎧',equipment:{armor:'light'}};
  const tooYoung=createLife({seed:61});tooYoung.phase='living';tooYoung.ageYears=3.999;tooYoung.ageSeconds=3.999*60;
  assert.equal(applyEquipmentStation(tooYoung,weaponStation),null);

  const child=createLife({seed:62});child.phase='living';child.ageYears=4;child.ageSeconds=4*60;
  assert.equal(applyEquipmentStation(child,weaponStation)?.weapon,'sword');
  assert.ok(child.knownSkills.includes('basic.sword'));
  assert.equal(applyEquipmentStation(child,armorStation),null);

  const seven=createLife({seed:63});seven.phase='living';seven.ageYears=7;seven.ageSeconds=7*60;
  assert.equal(applyEquipmentStation(seven,armorStation)?.armor,'light');

  const stage=await readFile(new URL('../src/rebuild/runtime-character-stage-base.js',import.meta.url),'utf8');
  assert.match(stage,/rinneWeaponPresentation\(weapon,ageYears\)/);
  assert.match(stage,/object\.position\.fromArray\(presentation\.objectPosition\)/);
  assert.match(stage,/scale:presentation\.scale/);
  assert.match(stage,/applyChildWeaponPose/);
  assert.match(stage,/equipment\.syncEquipment\(life\.equipment,life\.ageYears\)/);
});
