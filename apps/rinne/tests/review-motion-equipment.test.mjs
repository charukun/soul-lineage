import test from 'node:test';
import assert from 'node:assert/strict';
import {Group} from 'three';
import {
  MOTION_REVIEW_WEAPON_OPTIONS,
  applyMotionReviewWeaponGrip,
  motionReviewWeaponOption
} from '../src/review-motion-equipment.js';

test('motion review weapon settings expose only repository-local main-hand review assets',()=>{
  assert.deepEqual(MOTION_REVIEW_WEAPON_OPTIONS.map(row=>row.label),['なし','剣','斧','杖','クロスボウ']);
  for(const option of MOTION_REVIEW_WEAPON_OPTIONS.slice(1)){
    assert.ok(option.spec);
    assert.equal(option.spec.slots.includes('main'),true);
    assert.match(option.spec.runtime.url,/^\.\/asset-review\/equipment\//);
  }
});

test('motion review weapon grips resolve finite right-hand transforms',()=>{
  for(const id of ['skeleton-blade','skeleton-axe','skeleton-staff','skeleton-crossbow']){
    const option=motionReviewWeaponOption(id);
    const root=new Group();
    assert.equal(applyMotionReviewWeaponGrip(root,option.spec),root);
    assert.ok(root.position.toArray().every(Number.isFinite));
    assert.ok(root.quaternion.toArray().every(Number.isFinite));
    assert.ok(root.scale.toArray().every(value=>Number.isFinite(value)&&value>0));
  }
});

test('unknown weapon ids fall back to none instead of loading arbitrary URLs',()=>{
  const option=motionReviewWeaponOption('not-registered');
  assert.equal(option.id,'none');
  assert.equal(option.spec,null);
});
