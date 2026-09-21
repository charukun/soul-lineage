import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Box3,BoxGeometry,Group,Mesh,MeshBasicMaterial} from 'three';
import {
  MOTION_REVIEW_WEAPON_OPTIONS,
  applyMotionReviewWeaponGrip,
  keepMotionReviewWeaponAboveFloor,
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

test('motion review exposes the weapon selector directly through the stage gear',()=>{
  const source=readFileSync(new URL('../src/review-motion.js',import.meta.url),'utf8');
  const settings=source.indexOf("compatibility.dataset.reviewStageControl='true'");
  const mount=source.indexOf("mountRinneReviewShell('motion')");
  assert.ok(settings>=0&&mount>settings);
  assert.match(source,/compatibility\.open=true/);
  assert.match(source,/keepMotionReviewWeaponAboveFloor\(equippedWeapon\)/);
});

test('motion review floor guard keeps equipped geometry above the ground without accumulating drift',()=>{
  const parent=new Group(),root=new Group(),mesh=new Mesh(new BoxGeometry(.2,1,.2),new MeshBasicMaterial());
  root.add(mesh);parent.add(root);root.userData.motionReviewGripPosition=[0,-.7,0];root.position.fromArray(root.userData.motionReviewGripPosition);
  const first=keepMotionReviewWeaponAboveFloor(root,.02),settledY=root.position.y;
  const box=new Box3().setFromObject(root);
  assert.ok(first>0);assert.ok(box.min.y>=.019999);
  const second=keepMotionReviewWeaponAboveFloor(root,.02);
  assert.ok(second>0);assert.ok(Math.abs(root.position.y-settledY)<1e-9);
  mesh.geometry.dispose();mesh.material.dispose();
});
