import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createJohakyuP7ReviewScenario} from '../src/nocturne/johakyu-p7-review.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('序破急HUD upper line is the technique name and situation prose is not injected',()=>{
  const stage=read('src/nocturne-stage.js');
  assert.match(stage,/battle2SelectionLabel/);
  assert.match(stage,/activeLoadout\?\.technique\?\.\[meta\.phase\]/);
  assert.match(stage,/selection\?battle2SelectionLabel\(selection\)/);
  assert.match(stage,/cueNode\.hidden=!technique/);
  assert.doesNotMatch(stage,/for\(const row of \[\.\.\.activity\].*pushNarration/);
});

test('heart copy says 意識 and selected heart/body choices feed combat tuning',()=>{
  const ui=read('src/nocturne/battle2-loadout.js'),source=read('src/nocturne/johakyu-p7-review.js');
  assert.match(ui,/戦闘で意識する心得/);assert.match(ui,/意識中/);assert.doesNotMatch(ui,/戦闘へ持ち込む心得/);
  for(const id of ['skill.breath','skill.observe','skill.balance','skill.focus','skill.danger'])assert.ok(source.includes(id),id);
  for(const body of ['body.style','body.stance','body.zanshin'])assert.ok(source.includes(body),body);
  assert.match(source,/battle2Tuning/);assert.match(source,/preferredWeaponSpacing/);
});

test('weapon reach owns preferred spacing and combo chains are faster with stronger closing footwork',()=>{
  const source=read('src/nocturne/johakyu-p7-review.js'),catalog=read('src/nocturne/battle2-technique-catalog.js');
  assert.match(source,/WEAPONS\[actor\?\.equipment\?\.weapon\]/);
  assert.match(source,/comboScale=chainLength>1\?\.9:1/);
  assert.match(source,/comboBoost=action\?\.chainLength>1&&closing\?1\.12:1/);
  assert.ok((catalog.match(/action\.lunge/g)||[]).length>=3);
});

test('bounded range assist prevents the mutual no-damage deadlock when rendered contact samples are absent',()=>{
  const source=read('src/nocturne/johakyu-p7-review.js');
  assert.match(source,/visualAssist=Boolean/);assert.match(source,/weapon-range-assist/);
  const scenario=createJohakyuP7ReviewScenario({mode:'duel',enemyLeadSeconds:.16});let hits=0,player=0,enemy=0;
  for(let i=0;i<1500&&(!player||!enemy);i++){
    const r=scenario.step(1/60,[]);
    for(const event of r.events){if(event.type==='player-hit'){hits++;player++;}if(event.type==='enemy-hit'){hits++;enemy++;}}
  }
  assert.ok(hits>0);assert.ok(player>0,'player damage must occur');assert.ok(enemy>0,'enemy damage must occur');
});

test('loadout menu leaves the four primary buttons above the sheet',()=>{
  const css=read('src/battle2.css'),shared=read('../../packages/shared-ui/src/rinne-loadout-menu.css');
  assert.match(css,/\.battle2-loadout-shell \.rinne-primary-four\{z-index:180!important\}/);
  assert.match(shared,/bottom:max\(118px,calc\(env\(safe-area-inset-bottom\) \+ 112px\)\)/);
});


test('range arrival uses the same tolerance for maneuver completion and attack launch so spacing cannot deadlock',()=>{
  const source=read('src/nocturne/johakyu-p7-review.js');
  assert.match(source,/RANGE_ARRIVAL_TOLERANCE=\.06/);
  assert.match(source,/distance<=maneuver\.stopDistance\+RANGE_ARRIVAL_TOLERANCE/);
  assert.match(source,/distance>launchDistance\+RANGE_ARRIVAL_TOLERANCE/);
  assert.match(source,/distance>COUNTER_PRESS_DISTANCE\+RANGE_ARRIVAL_TOLERANCE/);

  const scenario=createJohakyuP7ReviewScenario({mode:'duel',enemyLeadSeconds:.16});
  let nearRangeReissues=0,stageStarts=0,contacts=0;
  for(let i=0;i<1200;i++){
    const r=scenario.step(1/60,[]);
    for(const row of r.meta.activity||[]){
      if(row.type==='stage-start')stageStarts++;
      if(row.type==='maneuver-start'&&row.reason==='engage-range'&&Number.isFinite(row.stopDistance)&&Number.isFinite(row.distance)&&row.distance>row.stopDistance&&row.distance<=row.stopDistance+.06)nearRangeReissues++;
    }
    contacts+=r.events.filter(event=>['player-hit','enemy-hit','guard','parry','slip','clash'].includes(event.type)).length;
  }
  assert.equal(nearRangeReissues,0,'arrival-band frames must launch instead of reissuing the same approach');
  assert.ok(stageStarts>8,'combat must continue advancing through authored stages');
  assert.ok(contacts>0,'combat must keep resolving contacts');
});


test('player portrait copies the presented canvas immediately without pixel-read rejection',()=>{
  const hud=read('../../packages/shared-ui/src/rinne-player-hud.js');
  assert.match(hud,/ctx\.drawImage/);
  assert.match(hud,/return draw\(source,options\)/);
  assert.match(hud,/root\.dataset\.portrait='live'/);
  assert.doesNotMatch(hud,/getImageData|requestAnimationFrame/);
});
