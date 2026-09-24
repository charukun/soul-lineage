import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {freshProfile} from '@soul/raid/profile';
import {PREY} from '@soul/raid/world';
import {RaidSession} from '@soul/raid';
import {DEFAULT_MONSTER_SPECIES} from '@soul/raid/single-session';
import {lineageMovePlan} from '../src/web/lineage-move-plan.js';
import {renderLineage} from '../src/web/lineage.js';

const profile = () => freshProfile('lineage-knowledge', 1000);
const native = p => Object.assign(Object.create(RaidSession.prototype), {profile:p, monsterSpecies:DEFAULT_MONSTER_SPECIES});
const adaptation = (encounters,moves) => ({encounters,moves,lastSeenAt:1000});

test('next engagement roles match real native ordering, deduplication and loadout', () => {
  for (const adaptations of [
    {traveller:adaptation(2,['dancer'])},
    {traveller:adaptation(2,['dancer','calm']),smith:adaptation(5,['stone','dancer']),hunter:adaptation(2,['ember'])},
    {traveller:adaptation(3,['dancer']),bellkeeper:adaptation(3,['calm']),arcanist:adaptation(1,['shadow'])}
  ]) {
    const p = profile(); p.adaptations = adaptations;
    const before = structuredClone(p), game = native(p), view = lineageMovePlan(p);
    assert.deepEqual(view.map(row=>row.key),game.learnedMoves());
    const skills = game.skillSet(null);
    for (const row of view) {
      if (row.slot) assert.equal(skills.loadout[row.slot].id,row.key);
      else assert.equal(row.role,'控え');
    }
    assert.equal(view[0].role,'次の交戦：破');
    if (view.length>1) assert.equal(view[1].role,'次の交戦：急');
    assert.deepEqual(p,before);
  }
});

test('canonical trait descriptions explain all retained powers, not equipped-slot guesses', () => {
  const p = profile(); p.unlocked = Object.keys(PREY); p.equipped = ['traveller','smith','hunter'];
  const before = structuredClone(p), html = renderLineage(p);
  for (const power of Object.values(PREY)) {
    assert.ok(html.includes(power.power));
    assert.ok(html.includes(power.desc));
  }
  assert.ok(html.includes('身体に残る特能'));
  assert.deepEqual(p,before);
  assert.deepEqual(p.equipped,['traveller','smith','hunter']);
});

test('inherited knowledge remains readable while past-life records are not called current loadouts', () => {
  const p = profile();p.unlocked=['traveller'];p.adaptations={traveller:adaptation(2,['dancer'])};
  p.lives=[{...p.currentLife,knownPowers:['traveller'],knownMoves:['dancer'],endedAt:2000,form:'hollow'}];
  p.currentLife={...p.currentLife,number:2,bornAt:2000,powers:[],moves:[]};
  const html=renderLineage(p),past=html.slice(html.indexOf('<section class="past-lives">'));
  assert.ok(html.includes(PREY.traveller.desc));
  assert.ok(html.includes('次の交戦：破'));
  assert.ok(past.includes('命の余熱'));
  assert.ok(past.includes('旅歩の返し'));
  assert.ok(!past.includes('次の交戦'));
});

test('view preserves entered-hunt meal projection and never settles unsecured loot', () => {
  const p=profile();p.currentLife.eaten=3;p.unlocked=['traveller'];
  p.visits.v={villageId:'v',status:'entered',name:'里'};
  const hunt={profile:p,village:{id:'v'},finished:false,eaten:2,carried:5};
  const before=structuredClone({p,hunt}),html=renderLineage(p,{hunt});
  assert.ok(html.includes('捕食 <b>5</b>'));
  assert.ok(html.includes('終了した狩り 3 ＋ 今回 2'));
  assert.ok(html.includes('未確保の戦利品 <b>5</b>'));
  assert.deepEqual({p,hunt},before);
  hunt.finished=true;
  assert.ok(!renderLineage(p,{hunt}).includes('lineage-live'));
});

test('unknown legacy move is escaped and cannot falsely shift a known native slot', () => {
  const p=profile();p.adaptations={traveller:adaptation(4,['<img src=x>','dancer','shadow'])};
  const view=lineageMovePlan(p),game=native(p);
  assert.deepEqual(view.map(row=>row.key),game.learnedMoves());
  assert.equal(view[0].role,'役割未確認');assert.equal(view[0].slot,null);
  assert.equal(view[1].slot,'kyu');assert.equal(game.skillSet(null).loadout.kyu.id,'dancer');
  const html=renderLineage(p);
  assert.ok(html.includes('&lt;img src=x&gt;'));
  assert.ok(!html.includes('<img src=x>'));
});

test('empty growth state never invents a trait or selected learned move', () => {
  const p=profile(),before=structuredClone(p),html=renderLineage(p);
  assert.deepEqual(lineageMovePlan(p),[]);
  assert.ok(html.includes('まだ刻まれていない'));
  assert.ok(!html.includes('次の交戦：'));
  assert.ok(!html.includes(PREY.traveller.desc));
  assert.deepEqual(p,before);
});

test('expanded knowledge has scoped readable copy and bounded card corners', () => {
  const css=readFileSync(new URL('../src/web/ominous-shell.css',import.meta.url),'utf8');
  const appended=css.slice(css.indexOf('/* Retained knowledge'));
  assert.ok(appended.includes('.life-card.current-life{clip-path:polygon(0 8px'));
  assert.ok(appended.includes('.lineage-knowledge-row>p'));
  assert.ok(appended.includes('font-size:12px;line-height:1.65'));
  assert.ok(appended.includes('flex-wrap:wrap'));
  assert.doesNotMatch(appended,/#objective|#battle|#game|\.controls/);
});
