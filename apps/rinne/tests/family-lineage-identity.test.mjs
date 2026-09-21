import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createFamily,validateFamily,inheritFamily,familyAffinityForSkill,settleFamily} from '../src/rebuild/family-origin.js';
import {createLife,rebirth,serializeLife,deserializeLife} from '../src/rebuild/domain.js';

const answers={cultureId:'wa',ethosId:'discern',traditionId:'katana'};
const makeFamily=()=>createFamily(answers,'family-account');

test('family v1 saves migrate to the permanent identity schema without changing origin',()=>{
  const old={schemaVersion:1,id:'family-old',origin:'chosen',...answers,contributions:[{lifeId:'life-1',generation:1,name:'祖先',returns:1,defeats:2,skills:['action.step']}],archivedGenerations:0};
  const family=validateFamily(old);
  assert.equal(family.schemaVersion,2);
  assert.equal(family.id,'family-old');
  assert.equal(family.cultureId,'wa');
  assert.equal(family.homeVillageId,null);
  assert.equal(family.legacies[0].skillId,'action.step');
  assert.equal(family.legacies[0].generations,1);
});

test('one family survives rebirth and a different birth village becomes migration history',()=>{
  const first=createLife({seed:10,family:makeFamily(),villageIds:['village-a']});
  assert.equal(first.family.id,'family-account');
  assert.equal(first.family.homeVillageId,'village-a');
  first.homelands=['village-a','village-b'];
  first.knownSkills.push('action.foreign-step');
  const second=rebirth(first,{villageId:'village-b',villageIds:['village-a','village-b']});
  assert.equal(second.family.id,first.family.id);
  assert.equal(second.family.cultureId,first.family.cultureId);
  assert.equal(second.family.ethosId,first.family.ethosId);
  assert.equal(second.family.traditionId,first.family.traditionId);
  assert.equal(second.family.homeVillageId,'village-b');
  assert.deepEqual(second.family.migrations,[{generation:2,lifeId:second.id,fromVillageId:'village-a',toVillageId:'village-b'}]);
  assert.deepEqual(deserializeLife(serializeLife(second)).family,second.family);
});

test('skills brought home by several generations become family lore without auto-granting the skill',()=>{
  let family=settleFamily(makeFamily(),'village-a',{generation:1,lifeId:'life-root'});
  for(let generation=1;generation<=3;generation++){
    family=inheritFamily({id:`life-${generation}`,generation,name:'旅人',returns:1,defeats:0,knownSkills:['basic.fist','action.foreign-step'],family});
  }
  const legacy=family.legacies.find(row=>row.skillId==='action.foreign-step');
  assert.ok(legacy);
  assert.equal(legacy.generations,3);
  assert.equal(legacy.established,true);
  assert.ok(legacy.strength>0);
  const next=createLife({seed:40,generation:4,family,villageIds:['village-a']});
  assert.deepEqual(next.knownSkills,['basic.fist']);
  assert.equal(next.family.id,'family-account');
});

test('family history changes inspiration preference but never creates an exclusive lock',()=>{
  let family=settleFamily(makeFamily(),'village-a',{generation:1,lifeId:'life-root'});
  const sword={id:'action.new-sword',weapons:['sword']},spear={id:'action.new-spear',weapons:['spear']};
  assert.ok(familyAffinityForSkill(family,sword)>0);
  assert.equal(familyAffinityForSkill(family,spear),0);
  family=inheritFamily({id:'life-1',generation:1,name:'旅人',returns:0,defeats:0,knownSkills:['basic.fist','action.new-spear'],family});
  assert.ok(familyAffinityForSkill(family,spear)>0);
  const other=createFamily({cultureId:'forest',ethosId:'guard',traditionId:'staff'},'family-other');
  assert.equal(familyAffinityForSkill(other,spear),0);
});

test('inspiration uses family affinity only as candidate score after normal availability gates',()=>{
  const inspiration=readFileSync(new URL('../src/rebuild/inspiration-state.js',import.meta.url),'utf8');
  const availability=inspiration.indexOf("if(!answerAvailability(state,row.id,{context}).usable)continue");
  const score=inspiration.indexOf('score+=familyAffinityForSkill(state.family,row)');
  assert.ok(availability>=0&&score>=0);
  assert.doesNotMatch(inspiration,/familyAffinityForSkill\([^\n]+\).*continue/);
});

test('title and death flow share the family home without hiding new life',()=>{
  const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  const familyUi=readFileSync(new URL('../src/family-origin-ui.js',import.meta.url),'utf8');
  const runtime=readFileSync(new URL('../src/rebuild/runtime.js',import.meta.url),'utf8');
  assert.match(main,/start\.hidden=false/);
  assert.match(main,/openFamilyOrigin\(\{document,hasSave:expectedSave!==null/);
  assert.match(main,/openFamilyHome\(\{document,state:saved,source:'title'/);
  assert.match(main,/onLifeHome:openLifeEndFamilyHome/);
  assert.match(runtime,/if\(onLifeHome&&!familyHomePending\)/);
  assert.match(runtime,/await rebirthCurrent\(null\)/);
  assert.match(familyUi,/export function openFamilyHome/);
  assert.match(familyUi,/data\.familyAction = action/);
});
