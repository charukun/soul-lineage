import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { THREE } from '@soul/rendering';
import { REVIEW_DOWNLOADS, REVIEW_KAYKIT_EQUIPMENT, REVIEW_KAYKIT_EQUIPMENT_SOURCE } from '@soul/assets/review-catalog';
import { EQUIPMENT_CATALOG, EQUIPMENT_REFERENCE, equipmentForSlot } from '../src/review/equipment-catalog.js';
import { createGrowthEquipmentController } from '../src/review/growth-equipment.js';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function vrmFixture() {
  const root=new THREE.Group(),hips=new THREE.Bone(),spine=new THREE.Bone(),chest=new THREE.Bone(),head=new THREE.Bone();
  hips.name='hips';hips.position.y=1;spine.name='spine';spine.position.y=.3;chest.name='chest';chest.position.y=.3;head.name='head';head.position.y=.35;
  root.add(hips);hips.add(spine);spine.add(chest);chest.add(head);
  const bones={hips,spine,chest,head};
  for(const [side,sign] of [['left',1],['right',-1]]){
    const upper=new THREE.Bone(),lower=new THREE.Bone(),hand=new THREE.Bone();upper.name=`${side}UpperArm`;lower.name=`${side}LowerArm`;hand.name=`${side}Hand`;
    upper.position.set(sign*.22,.22,0);lower.position.set(sign*.28,0,0);hand.position.set(sign*.25,0,0);chest.add(upper);upper.add(lower);lower.add(hand);
    bones[`${side}UpperArm`]=upper;bones[`${side}LowerArm`]=lower;bones[`${side}Hand`]=hand;
    for(const [part,y] of [['IndexProximal',.045],['MiddleProximal',0],['LittleProximal',-.045]]){
      const finger=new THREE.Bone();finger.name=`${side}${part}`;finger.position.set(sign*.09,y,0);hand.add(finger);bones[`${side}${part}`]=finger;
    }
  }
  root.updateMatrixWorld(true);return{root,bones};
}

function kaykitFixture() {
  const root=new THREE.Group();
  for(const name of ['hips','spine','chest','head','handslot.r','handslot.l','1H_Sword','1H_Sword_Offhand','Round_Shield']){
    const node=new THREE.Bone();node.name=name;root.add(node);
  }
  root.updateMatrixWorld(true);return root;
}

test('equipment geometry is pinned, bundled and exposes every review slot', () => {
  assert.match(REVIEW_KAYKIT_EQUIPMENT_SOURCE.commit,/^[0-9a-f]{40}$/);
  assert.equal(REVIEW_KAYKIT_EQUIPMENT_SOURCE.repository,'KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0');
  assert.equal(REVIEW_KAYKIT_EQUIPMENT_SOURCE.license,'CC0-1.0');
  assert.equal(EQUIPMENT_REFERENCE.attachmentCommit,'83347159f70103c887768fc0aa0e6aff0d030e8d');
  assert.equal(EQUIPMENT_REFERENCE.attachmentLicense,'MIT');
  assert.ok(EQUIPMENT_CATALOG.length>=20);
  for(const slot of ['main','off','back'])assert.ok(equipmentForSlot(slot).length>=3,`${slot} should have equipment`);
  for(const item of REVIEW_KAYKIT_EQUIPMENT){
    assert.match(item.publicPath,/^asset-review\/equipment\/[\w-]+\.gltf$/);
    assert.ok(REVIEW_DOWNLOADS.some(row=>row.output===`equipment/${item.file}.gltf`));
    assert.ok(REVIEW_DOWNLOADS.some(row=>row.output===`equipment/${item.file}.bin`));
  }
  assert.ok(REVIEW_DOWNLOADS.every(row=>!row.commit||/^[0-9a-f]{40}$/.test(row.commit)));
});

test('all-model growth UI preserves equipment selection in URL state', async () => {
  const [html,js,css,prepare,doc] = await Promise.all([
    read('growth-review.html'),read('src/review/growth-review.js'),read('src/review/growth-review.css'),
    read('../../scripts/prepare-review-assets.mjs'),read('docs/GROWTH_EQUIPMENT_REVIEW.md'),
  ]);
  assert.match(html,/id="growth-equipment-picker"/);
  assert.match(html,/data-equipment-trigger="main"/);
  assert.match(html,/data-equipment-trigger="off"/);
  assert.match(html,/data-equipment-trigger="back"/);
  assert.match(html,/id="growth-equipment-clear"/);
  assert.match(js,/createGrowthEquipmentController/);
  for(const key of ['eqMain','eqOff','eqBack'])assert.match(js,new RegExp(key));
  assert.match(js,/url\.searchParams\.set\('view', currentView\)/);
  assert.match(js,/previous\.equipment\?\.dispose\(\)/);
  assert.match(js,/bodyBounds\(\)/);
  assert.match(css,/growth-equipment-slots/);
  assert.match(css,/growth-equipment-picker/);
  assert.match(prepare,/verifyEquipmentBundle/);
  assert.match(prepare,/equipmentSource:REVIEW_KAYKIT_EQUIPMENT_SOURCE/);
  assert.match(doc,/Every model selectable in Growth Review can use the same equipment UI/);
  assert.doesNotMatch(js+doc,/visualApproval\s*=|productionStage\s*=/);
});

test('VRM and KayKit rigs resolve real attachment anchors without floating fallbacks', () => {
  const vrm=vrmFixture(),vrmController=createGrowthEquipmentController({root:vrm.root,bones:vrm.bones,model:{id:'SHINO',kind:'vrm'}});
  const vrmReport=vrmController.diagnostics();
  assert.equal(vrmReport.kind,'vrm');
  assert.match(vrmReport.anchors.main,/GrowthEquipmentSocket:right/);
  assert.match(vrmReport.anchors.off,/GrowthEquipmentSocket:left/);
  assert.equal(vrmReport.anchors.back,'chest');
  vrmController.dispose();

  const kaykitRoot=kaykitFixture(),bones={chest:kaykitRoot.getObjectByName('chest')};
  const kaykitController=createGrowthEquipmentController({root:kaykitRoot,bones,model:{id:'motion-library.knight',kind:'kaykit'}});
  const kk=kaykitController.diagnostics();
  assert.equal(kk.kind,'kaykit');
  assert.equal(kk.anchors.main,'handslot.r');
  assert.equal(kk.anchors.off,'handslot.l');
  assert.equal(kk.anchors.back,'chest');
  assert.equal(kaykitRoot.getObjectByName('1H_Sword').visible,false);
  kaykitController.dispose();
});

test('missing required rig anchors fail closed', () => {
  assert.throws(()=>createGrowthEquipmentController({root:new THREE.Group(),bones:{},model:{id:'broken',kind:'vrm'}}),/rightHand/);
  assert.throws(()=>createGrowthEquipmentController({root:new THREE.Group(),bones:{},model:{id:'broken',kind:'kaykit'}}),/handslot/);
});
