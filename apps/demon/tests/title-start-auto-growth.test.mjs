import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {freshProgress, PROGRESS_KEY, automaticGrowth, bodyStats, settleProgress, huntPlan} from '../src/hunt/balance.js';

const fresh = () => ({id:'actor', unlocked:[], form:'hollow', visits:{}, hunts:0, lives:[], [PROGRESS_KEY]:freshProgress()});

test('returned saves use cumulative loot for automatic permanent growth',()=>{
  const p=fresh();
  Object.assign(p[PROGRESS_KEY],{essence:9,returns:2,upgrades:{fang:1,heart:0,stride:0}});
  const growth=automaticGrowth(p),stats=bodyStats(p);
  assert.equal(growth.active,true);
  assert.equal(growth.power,17);
  assert.equal(growth.stage,1);
  assert.equal(stats.baseHP,132);
  assert.equal(stats.techniqueSpeed,106);
  assert.equal(stats.moveBonus,3.5);
});

test('the first successful return switches progression to automatic growth',()=>{
  const p=fresh(),plan=huntPlan(p);
  settleProgress(p,'escaped',2,{plan,carried:4,targetEaten:false,returnVerified:true});
  assert.equal(p[PROGRESS_KEY].autoGrowth,true);
  assert.equal(p[PROGRESS_KEY].returns,1);
  assert.equal(automaticGrowth(p).stage,1);
});

test('title reaches a visible start command quickly and manual body-upgrade UI is gone',()=>{
  const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
  const entry=read('../src/main.js'),main=read('../src/web/main.js'),flow=read('../src/web/hunt-flow-ui.js'),css=read('../src/web/title-readability.css');
  assert.match(entry,/setTimeout\(\(\)=>\{/);
  assert.match(entry,/4800/);
  assert.match(entry,/stage==='intro'/);
  assert.match(main,/\$\('begin'\)\.onclick = \(\) => void randomHunt\(\)/);
  assert.doesNotMatch(flow,/肉体を強化|campButton|data-hunt-upgrade|upgradeHtml|byId\('begin'\)\.innerHTML/);
  assert.match(css,/#title #begin::after\{content:"開始"/);
  assert.match(css,/min-height:56px/);
});
