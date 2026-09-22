import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generatedTechniqueCandidates,
  generatedTechniqueNaming,
  techniqueArchetypeName,
} from '../src/index.js';

test('repeated strike structures collapse to a shared martial archetype name', () => {
  const rows=generatedTechniqueCandidates({weapon:'spear'});
  const triple=rows.find(row=>row.steps.length===3&&row.steps.every(step=>step.kind==='thrust'));
  assert.ok(triple,'triple thrust structure should be generatable');
  assert.equal(techniqueArchetypeName(triple),'三段突き');

  const variants=rows.filter(row=>row.steps.length===3&&row.steps.every(step=>['thrust','pierce'].includes(step.kind)));
  assert.ok(variants.length>1);
  assert.ok(variants.some(row=>techniqueArchetypeName(row)==='三段突き'));
});

test('personal naming occasionally promotes a generated technique to chuunibyou or katakana signature names', () => {
  const row=generatedTechniqueCandidates({weapon:'spear',phase:'ha'}).find(item=>item.steps.length===3);
  assert.ok(row);
  const styles=new Set();
  const names=new Set();
  for(let seed=0;seed<1200;seed++){
    const naming=generatedTechniqueNaming(row,{seed,motifs:['advance','precision','return']});
    styles.add(naming.style);names.add(naming.name);
  }
  assert.ok(styles.has('archetype'));
  assert.ok(styles.has('chuunibyou'));
  assert.ok(styles.has('katakana'));
  assert.ok(names.has('ドラゴンドライブ'));
});

test('attributes do not rename a technique, while rule-changing traits switch the naming grade', () => {
  const row=generatedTechniqueCandidates({weapon:'sword',phase:'ha'}).find(item=>item.steps.length===2);
  assert.ok(row);
  const normal=generatedTechniqueNaming({...row,attributes:['fire']},{seed:41,motifs:['timing']});
  const status=generatedTechniqueNaming({...row,attributes:['fire']},{seed:41,motifs:['timing'],specialEffects:[{id:'burn',label:'燃焼',impact:'status',rarity:'rare'}]});
  assert.equal(status.displayName,normal.displayName);
  assert.equal(status.grade,'normal');

  const secret=generatedTechniqueNaming(row,{seed:41,motifs:['timing'],specialEffects:[{id:'rule',label:'間合い連鎖',impact:'rule',rarity:'rare'}]});
  assert.equal(secret.grade,'secret');
  assert.match(secret.displayName,/^秘技・/);

  const ultimate=generatedTechniqueNaming(row,{seed:41,motifs:['timing'],specialEffects:[{id:'law',label:'防御則反転',impact:'rule',rarity:'singular',unlockCondition:'系譜と実戦条件'}]});
  assert.equal(ultimate.grade,'ultimate');
  assert.match(ultimate.displayName,/^奥義・/);
});
