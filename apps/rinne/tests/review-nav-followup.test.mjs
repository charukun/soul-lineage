import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('unified review navigation uses category-specific selectors and never routes the battle button to battle scene playback', async () => {
  const nav = await read('src/review/unified-review-nav.js');

  assert.match(nav, /const BATTLE_MOTION_ITEMS = \[/);
  assert.match(nav, /\['stance-select', '構え', '戦闘の起点'\]/);
  assert.match(nav, /\['parry-select', 'パリィ', '防御・受け流し'\]/);
  assert.match(nav, /\['reaction-select', '被弾', 'ヒット反応'\]/);
  assert.match(nav, /function renderBattleHub\(\)/);
  assert.match(nav, /setCategoryCopy\('戦闘モーションを選ぶ'/);
  assert.match(nav, /url\.searchParams\.set\('tab', 'battle-motion'\)/);
  assert.doesNotMatch(nav, /section === 'battle'[\s\S]{0,180}data-review-tab=\\"battle\\"/);

  assert.match(nav, /function renderSkillHub\(\)/);
  assert.match(nav, /playDirectMotion\(option\.value\);\s*closeDock\(\);/);
  assert.match(nav, /function renderPerformanceHub\(\)/);
  assert.match(nav, /source\.click\(\);\s*closeDock\(\);/);
  assert.match(nav, /const TOOL_ITEMS = \[[\s\S]*?\['axis', '心技体'/);
  assert.doesNotMatch(nav, /const TOOL_ITEMS = \[[\s\S]*?\['reaction', '被弾'/);
});

test('all phone selection surfaces stay five columns and the closed legacy drawer is fully hidden', async () => {
  const css = await read('src/review/unified-review-nav-v2.css');

  assert.match(css, /\.review-category-grid\{[\s\S]*?grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important/);
  assert.match(css, /\.unified-review-navigation \.picker-list\{[\s\S]*?grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important/);
  assert.match(css, /\.unified-review-navigation \.model-picker-list\{[\s\S]*?grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important/);
  assert.match(css, /\.unified-review-navigation \.review-tool-grid\{[\s\S]*?grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important/);
  assert.doesNotMatch(css, /grid-template-columns:repeat\([1-4],minmax\(0,1fr\)\)/);
  assert.match(css, /review-controls-dock:not\(\[data-open="true"\]\)[\s\S]*?visibility:hidden!important/);
  assert.match(css, /body\[data-review-section="battle"\][\s\S]*?review-page\[data-review-page="battle"\][\s\S]*?display:none!important/);
  assert.match(css, /\.battle-quick-link,[\s\S]*?\.review-primary-switch\{display:none!important\}/);
});
