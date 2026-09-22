import test from 'node:test';
import assert from 'node:assert/strict';
import {PREY} from '@soul/raid/world';
import {renderLineage} from '../src/web/lineage.js';

const profile=(powers=[])=>({
  id:'p1', unlocked:[...powers], equipped:[...powers].slice(0,3), form:'hollow',
  adaptations:{}, visits:{}, lives:[],
  currentLife:{number:1,bornAt:1,hunts:0,eaten:0,battles:0,powers:[...powers],moves:[]}
});

test('acquired power renders canonical name and canonical effect',()=>{
  const html=renderLineage(profile(['traveller']));
  assert.ok(html.includes('命の余熱'));
  assert.ok(html.includes(PREY.traveller.desc));
  assert.ok(html.includes('data-power="traveller"'));
});

test('unowned powers are not disclosed',()=>{
  const html=renderLineage(profile(['traveller']));
  assert.ok(!html.includes('声喰い'));
  assert.ok(!html.includes(PREY.bellkeeper.desc));
});

test('active hunt progress stays separate from acquired power meaning',()=>{
  const p=profile(['traveller']);
  p.visits.v1={villageId:'v1',name:'夜',status:'entered'};
  const hunt={finished:false,profile:{id:'p1',currentLife:{number:1,bornAt:1}},village:{id:'v1'},eaten:2,carried:4};
  const html=renderLineage(p,{hunt});
  assert.ok(html.includes('今回の狩り <b>捕食 2</b>'));
  assert.ok(html.includes('未確保の戦利品 <b>4</b> · 帰還で確保'));
  assert.ok(html.includes('命の余熱'));
  assert.ok(html.includes('捕食時の回復が増える'));
});

test('unknown historical power key does not fabricate an effect',()=>{
  const p=profile([]);
  p.lives=[{number:0,bornAt:1,endedAt:2,hunts:1,eaten:1,battles:1,powers:['legacy-unknown'],knownPowers:['legacy-unknown'],moves:[]}];
  const html=renderLineage(p);
  assert.ok(html.includes('lineage-power-unknown'));
  assert.ok(html.includes('legacy-unknown'));
  assert.ok(!html.includes('undefined'));
});
