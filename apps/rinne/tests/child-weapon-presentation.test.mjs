import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MIN_WEAPON_AGE_YEARS,SHINO_MASTER,ageAppearance} from '@soul/characters';
import {applyEquipmentStation,createLife} from '../src/rebuild/domain.js';
import {equipmentAccess,requestEquipmentChange} from '../src/rebuild/gameplay-contract.js';
import {guidanceFor} from '../src/rebuild/guidance.js';
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

test('weapon access and inventory boundary is four while armor remains seven',()=>{
  const weaponStation={id:'rack.weapon.sword',label:'片手剣',x:0,z:0,equipment:{weapon:'sword'},equipmentRadius:1.55};
  const armorAccess={id:'rack.armor.light',label:'軽鎧',x:0,z:0,armor:'light',equipmentAccess:true,equipmentRadius:1.55};
  const armorStation={id:'rack.armor.light',label:'軽鎧',equipment:{armor:'light'}};

  const tooYoung=createLife({seed:61});tooYoung.phase='living';tooYoung.ageYears=3.999;tooYoung.ageSeconds=3.999*60;tooYoung.position={x:0,z:0};
  tooYoung.inventory={weapons:['fist','sword'],armors:['cloth','light'],shields:[false]};
  const blocked=equipmentAccess(tooYoung,{stations:[weaponStation],kind:'weapon'});
  assert.equal(blocked.ok,false);assert.match(blocked.reason,/4歳/);
  assert.equal(applyEquipmentStation(tooYoung,weaponStation),null);

  const child=createLife({seed:62});child.phase='living';child.ageYears=4;child.ageSeconds=4*60;child.position={x:0,z:0};
  child.inventory={weapons:['fist','sword'],armors:['cloth','light'],shields:[false]};
  assert.equal(equipmentAccess(child,{stations:[weaponStation],kind:'weapon'}).ok,true);
  const changed=requestEquipmentChange(child,{kind:'weapon',value:'sword',stations:[weaponStation]});
  assert.equal(changed.ok,true);assert.equal(changed.changed,true);assert.equal(child.equipment.weapon,'sword');
  assert.ok(child.knownSkills.includes('basic.sword'));
  assert.equal(applyEquipmentStation(child,armorStation),null);
  const armorBlocked=requestEquipmentChange(child,{kind:'armor',value:'light',stations:[armorAccess]});
  assert.equal(armorBlocked.ok,false);assert.match(armorBlocked.reason,/7歳/);

  const seven=createLife({seed:63});seven.phase='living';seven.ageYears=7;seven.ageSeconds=7*60;
  assert.equal(applyEquipmentStation(seven,armorStation)?.armor,'light');
});

test('child guidance exposes the four-year weapon unlock without replacing earlier childhood learning',()=>{
  const rack={id:'rack.weapon.sword',label:'片手剣',x:1,z:0,equipment:{weapon:'sword'}};
  const child=createLife({seed:64});child.phase='living';child.ageYears=5;child.ageSeconds=5*60;child.position={x:0,z:0};
  const guide=guidanceFor({state:child,stations:[rack]});
  assert.equal(guide.objective,'武具を選ぶ');assert.equal(guide.badge,'武器解禁');assert.equal(guide.target.label,'片手剣');
});

test('runtime stage consumes age-aware weapon visuals and no stale seven-year weapon copy remains',async()=>{
  const [stage,domain,contract,guidance]=await Promise.all([
    readFile(new URL('../src/rebuild/runtime-character-stage-base.js',import.meta.url),'utf8'),
    readFile(new URL('../src/rebuild/domain.js',import.meta.url),'utf8'),
    readFile(new URL('../src/rebuild/gameplay-contract.js',import.meta.url),'utf8'),
    readFile(new URL('../src/rebuild/guidance.js',import.meta.url),'utf8')
  ]);
  assert.match(stage,/rinneWeaponPresentation\(weapon,ageYears\)/);
  assert.match(stage,/object\.position\.fromArray\(presentation\.objectPosition\)/);
  assert.match(stage,/scale:presentation\.scale/);
  assert.match(stage,/applyChildWeaponPose/);
  assert.match(stage,/equipment\.syncEquipment\(life\.equipment,life\.ageYears\)/);
  for(const source of [domain,contract,guidance])assert.doesNotMatch(source,/7歳から武具|武具 7歳/);
});
