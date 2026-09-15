import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const controls=readFileSync(new URL('../src/review/review-controls.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/review/review-mobile-simple.css',import.meta.url),'utf8');
const nav=readFileSync(new URL('../src/review/unified-review-nav.js',import.meta.url),'utf8');
const navCss=readFileSync(new URL('../src/review/unified-review-nav.css',import.meta.url),'utf8');
const navV2Css=readFileSync(new URL('../src/review/unified-review-nav-v2.css',import.meta.url),'utf8');
const notebook=readFileSync(new URL('../src/review/notebook.js',import.meta.url),'utf8');

test('phone review keeps primary controls focused and hides secondary density',()=>{
  assert.match(controls,/button\('動作'/);
  assert.match(controls,/make\('summary','その他'\)/);
  assert.match(controls,/make\('summary','再生・視点・詳細'\)/);
  assert.match(controls,/advancedDetails\.prepend\(equipment\)/);
  assert.match(css,/\.review-controls-dock \.weapon-quick\{display:none!important\}/);
  assert.match(css,/\.review-controls-dock \.notebook-scroll\{overflow:hidden!important/);
  assert.match(css,/\.review-drawer-scroll \.review-controls-dock \.notebook-scroll\{overflow:auto!important/);
});

test('review drawer closes after selecting a model or motion target',()=>{
  assert.match(controls,/target\.classList\.contains\('review-select'\)\|\|target\.id==='preset'/);
  assert.match(controls,/queueMicrotask\(\(\)=>setOpen\(false\)\)/);
  assert.match(controls,/\[data-play-select\],\.sequence-review-action/);
  assert.match(nav,/playDirectMotion\(option\.value\);\s*closeDock\(\);/);
  assert.match(nav,/source\.click\(\);\s*closeDock\(\);/);
});

test('phone navigation exposes five task routes while tools and motions stay contextual',()=>{
  assert.match(nav,/\['model', 'モデル'\]/);
  assert.match(nav,/\['skill', '技'\]/);
  assert.match(nav,/\['performance', '演舞'\]/);
  assert.match(nav,/\['battle', '戦闘'\]/);
  assert.match(nav,/\['other', 'その他'\]/);
  assert.match(nav,/const BATTLE_MOTION_ITEMS = \[/);
  assert.match(nav,/\['posture-draw', '抜刀',/);
  assert.match(nav,/\['reaction-select', '被弾',/);
  assert.match(nav,/function renderSkillHub\(\)/);
  assert.match(nav,/function renderPerformanceHub\(\)/);
  assert.match(nav,/function renderBattleHub\(\)/);
  assert.match(nav,/review-tool-grid/);
  assert.doesNotMatch(nav,/\['motion', 'モーション'\]/);
  assert.match(navCss,/review-bottom-nav[\s\S]*grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(navV2Css,/\.review-category-grid\{[\s\S]*grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important/);
  assert.match(navV2Css,/\.unified-review-navigation \.picker-list\{[\s\S]*grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important/);
  assert.match(navV2Css,/\.unified-review-navigation \.model-picker-list\{[\s\S]*grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important/);
  assert.match(navV2Css,/body\[data-review-section="skill"\][\s\S]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
  assert.match(notebook,/placeholder = 'モーションを検索'/);
  assert.match(notebook,/picker-item/);
});
