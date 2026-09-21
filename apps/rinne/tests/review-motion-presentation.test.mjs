import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Group} from 'three';
import {applyMotionReviewWeaponGrip,motionReviewWeaponOption} from '../src/review-motion-equipment.js';
import {MOTION_LIBRARY_SOURCES} from '../src/review-motion-sources.js';
import {buildMotionReviewCatalog,reviewMotionDisplayName} from '../src/review-motion-catalog.js';

const read=relative=>readFileSync(new URL(relative,import.meta.url),'utf8');
const hasJapanese=value=>/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(value);

test('all registered motion names render as Japanese display labels',()=>{
  let checked=0;
  for(const source of MOTION_LIBRARY_SOURCES){
    for(const clip of source.clips){
      const label=reviewMotionDisplayName(clip.name,clip.index);
      assert.equal(/[A-Za-z]/.test(label),false,`${clip.name} -> ${label}`);
      assert.equal(hasJapanese(label),true,`${clip.name} -> ${label}`);
      checked++;
    }
  }
  assert.ok(checked>100);
  for(const [name,index] of [['Running_A',0],['Melee_1H_Attack_Slice_Diagonal',1],['Parkour_Run_Jump_Walk',2],['Acrobat_Fancy_Twist_42',41]]){
    const label=reviewMotionDisplayName(name,index);
    assert.equal(/[A-Za-z]/.test(label),false,`${name} -> ${label}`);
    assert.equal(hasJapanese(label),true,`${name} -> ${label}`);
  }
  const [record]=buildMotionReviewCatalog([{name:'Sword_Attack',duration:1}]);
  assert.equal(record.displayName,'剣・攻撃');
});

test('motion review uses Japanese names in stage, cards and legacy selector',()=>{
  const source=read('../src/review-motion.js');
  assert.match(source,/row\.displayName\|\|reviewMotionDisplayName/);
  assert.match(source,/record\.displayName\|\|reviewMotionDisplayName/);
  assert.match(source,/new Option\(reviewMotionDisplayName\(c\.name,i\)/);
  assert.match(source,/motionUpstreamName/);
  assert.doesNotMatch(source,/formatName\(/);
});

test('motion stage starts farther away and selected motion caption stays top-left',()=>{
  const source=read('../src/review-motion.js');
  const css=read('../src/review-motion.css');
  const preview=read('../src/review-motion-preview.css');
  const html=read('../review-motion.html');
  assert.match(source,/padding:1\.75,minDistance:1,maxDistance:12/);
  assert.match(source,/controls\.minDistance=1/);
  assert.match(css,/\.motion-stage-caption\{[^}]*left:max\(16px,env\(safe-area-inset-left\)\)[^}]*top:14px[^}]*bottom:auto/);
  assert.match(css,/@media\(max-width:620px\)[\s\S]*?\.motion-stage-caption\{left:10px;top:10px;bottom:auto;max-width:44%\}/);
  assert.match(preview,/\.motion-quality\{position:absolute;top:10px;left:auto;right:10px/);
  assert.match(html,/aria-label="主人公モデルのモーション。ドラッグで回転、ピンチで拡大"/);
});


test('motion gear opens downward with compact controls and collapsed diagnostics',()=>{
  const source=read('../src/review-motion.js');
  const preview=read('../src/review-motion-preview.css');
  assert.match(source,/createElement\('section'\).*motion-compatibility/);
  assert.match(source,/motion-setting-grid/);
  assert.match(source,/接地補正/);
  assert.match(source,/補正なし/);
  assert.match(source,/motion-diagnostics/);
  assert.match(source,/<summary>技術詳細<\/summary>/);
  assert.match(source,/reviewStagePanelHost='\.motion-library-primary'/);
  assert.match(preview,/\.motion-review \.motion-library-primary\{position:relative\}/);
  assert.match(preview,/\.motion-review \.motion-library-primary>\.review-stage-controls__panel\{position:absolute!important;top:8px!important;right:8px!important/);
});

test('motion review settings can equip a right-hand weapon without changing the motion source',()=>{
  const source=read('../src/review-motion.js');
  const preview=read('../src/review-motion-preview.css');
  assert.match(source,/id="motion-weapon"/);
  assert.match(source,/MOTION_REVIEW_WEAPON_OPTIONS/);
  assert.match(source,/loadMotionReviewWeapon/);
  assert.match(source,/targetAdapter\.bones\?\.rightHand/);
  assert.match(source,/hideEmbeddedCombatProps\(gltf\.scene\)/);
  assert.match(source,/canvas\.dataset\.motionWeapon/);
  assert.match(preview,/\.motion-compatibility label\{display:grid/);
  for(const id of ['skeleton-blade','skeleton-axe','skeleton-staff','skeleton-crossbow']){
    const root=new Group();applyMotionReviewWeaponGrip(root,motionReviewWeaponOption(id).spec);
    assert.equal(root.position.lengthSq(),0,id+' must seat at the right-hand anchor');
  }
});

test('shared stage controls portal into the motion-derived workbench host',()=>{
  const shared=read('../../../packages/shared-ui/src/review-stage.js');
  const workbench=read('../../../packages/shared-ui/src/review-workbench.css');
  const html=read('../review-motion.html');
  assert.match(shared,/stage\.dataset\.reviewStagePanelHost\?doc\.querySelector/);
  assert.match(shared,/\(panelHost\|\|root\)\.append\(panel\)/);
  assert.match(shared,/!root\.contains\(event\.target\)&&!panel\.contains\(event\.target\)/);
  assert.match(shared,/panel\.remove\(\)/);
  assert.match(workbench,/\.review-workbench__panel-host>\.review-stage-controls__panel/);
  assert.match(html,/data-review-stage-panel-host="\.motion-library-primary"/);
  assert.match(html,/motion-library-primary review-workbench__library review-workbench__panel-host/);
});
