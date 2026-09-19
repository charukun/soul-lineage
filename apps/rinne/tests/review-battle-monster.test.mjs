import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../../../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('technique review renders actual monster GLBs instead of humanoid disguises',async()=>{
  const [stage,battle,monsters]=await Promise.all([
    read('apps/rinne/src/review-battle-stage.js'),
    read('apps/rinne/src/review-battle.js'),
    read('apps/rinne/src/review-battle-monster.js')
  ]);
  assert.match(battle,/enemyModel='goblin-runt'/);
  assert.match(stage,/loadReviewMonsterModel\('goblin-runt'\)/);
  assert.match(stage,/loadReviewMonsterModel\('horn-brute'\)/);
  assert.match(stage,/loadReviewMonsterModel\('maw-stalker'\)/);
  assert.match(stage,/battleGeometry='runtime-monster-models'/);
  assert.doesNotMatch(stage,/ReviewMonsterSilhouette|installReviewEquipment\(side\.actor/);
  assert.match(monsters,/gobkit-free-assets/);
  assert.match(monsters,/reviewMonsterSpecies=id/);
  assert.match(monsters,/minion\/minion-a01\.glb/);
});

test('1v3 extras are real monster instances and retain multi-hit reactions',async()=>{
  const stage=await read('apps/rinne/src/review-battle-stage.js');
  assert.match(stage,/const specs=\[\[monsterFlankA,0,1\.35,1\.35\],\[monsterFlankB,1,1\.5,-1\.25\]\]/);
  assert.match(stage,/updateReviewMonsterAnimation\(actor,source,time\+extra\.index\*\.17/);
  assert.match(stage,/reviewBattleMultiHitFrame\(core\.hero,\{encounterMode\}\)/);
});
