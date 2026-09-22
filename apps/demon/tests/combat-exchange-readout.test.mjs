import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {combatExchangeState, latestCombatContact, CONTACT_FEEDBACK_SECONDS} from '../src/web/combat-exchange-state.js';
import {CombatExchangeReadout} from '../src/web/combat-exchange-readout.js';

// Native Before artifact10675299319, stages04/19: values are deliberately kept
// distinct (hero120, enemy38, later hero107/124, enemy8/56) to catch attribution.
const coreState = (extra = {}) => ({
  hero:{id:3,hp:120,maxhp:120}, enemy:{id:4,hp:18,maxhp:38},
  time:4.287333333333323,
  contacts:[{time:3.6333333333333253,source:3,target:4,guard:false,damage:20}],
  ...extra
});
const gameFor = state => ({player:{hp:120,maxhp:120},fight:{npc:{id:'native:first',name:'旅人'},core:{state:()=>state}},combatants:[]});
const deepFreeze = value => { if(value && typeof value === 'object'){Object.values(value).forEach(deepFreeze);Object.freeze(value);}return value; };

test('named-combat-vitals: real Before HP is projected without mutation', () => {
  const state=deepFreeze(coreState()),game=deepFreeze(gameFor(state));
  const view=combatExchangeState(game);
  assert.deepEqual(view.hero,{name:'自分',hp:120,maxhp:120,ratio:1});
  assert.deepEqual(view.enemy,{name:'旅人',hp:18,maxhp:38,ratio:18/38});
  assert.equal(state.contacts.length,1);
});
test('named-combat-vitals: player HP includes other attackers; native opponent max is authoritative', () => {
  const game=gameFor(coreState({enemy:{id:4,hp:8,maxhp:56}}));
  game.player={hp:107,maxhp:124}; game.fight.npc.hp=8; game.fight.npc.maxhp=999;
  game.combatants=[{npc:{name:'鐘番'}},{npc:{dead:true}},{npc:{eaten:true}}];
  const view=combatExchangeState(game);
  assert.equal(view.hero.hp,107);assert.equal(view.hero.maxhp,124);assert.equal(view.enemy.maxhp,56);assert.equal(view.others,1);
});
test('named-combat-vitals: overlay, capture, finish and no fight hide before reading core', () => {
  for(const patch of [{fight:null},{devour:{}},{finished:true}])assert.equal(combatExchangeState({...gameFor(coreState()),...patch}),null);
  const game=gameFor(coreState());game.fight.core.state=()=>{throw Error('hidden view must not poll combat');};
  assert.equal(combatExchangeState(game,{overlay:true}),null);
});
test('named-combat-vitals: dead, eaten and invalid native vitals never display a fabricated meter', () => {
  for(const status of ['dead','eaten']){const game=gameFor(coreState());game.fight.npc[status]=true;assert.equal(combatExchangeState(game),null);}
  for(const enemy of [{id:4,hp:NaN,maxhp:38},{id:4,hp:18,maxhp:0},{id:4,hp:18,maxhp:Infinity}])assert.equal(combatExchangeState(gameFor(coreState({enemy}))),null);
  assert.equal(combatExchangeState(gameFor(coreState({done:true}))),null);
});
test('attributed-contact-receipt: native outgoing20 is not incoming or a pose-derived hit', () => {
  assert.deepEqual(latestCombatContact(coreState()),{direction:'outgoing',guarded:false,damage:20,text:'自分 → 相手 · 命中 · 生命 −20'});
  assert.equal(latestCombatContact(coreState({contacts:[],hero:{id:3,attack:'barrage',skill:'鎌爪・斜断'}})),null);
});
test('attributed-contact-receipt: native incoming17 identifies the recipient', () => {
  const state=coreState({time:10.33600000000009,contacts:[{time:8.465333333333328,source:4,target:3,guard:false,damage:17}]});
  assert.deepEqual(latestCombatContact(state),{direction:'incoming',guarded:false,damage:17,text:'相手 → 自分 · 被弾 · 生命 −17'});
});
test('attributed-contact-receipt: native guarded chip is not described as immunity', () => {
  const state=coreState({time:4,contacts:[{time:3.733333333333325,source:3,target:4,guard:true,damage:4}]});
  const view=latestCombatContact(state);assert.equal(view.guarded,true);assert.match(view.text,/自分 → 相手 · 防御 · 生命 −4/);
  state.contacts[0].damage=0;assert.match(latestCombatContact(state).text,/防御 · 損傷なし/);
  state.contacts[0].guard=false;assert.match(latestCombatContact(state).text,/接触 · 損傷なし/);
});
test('attributed-contact-receipt: exact native clock boundary expires without a wall timer', () => {
  const state=coreState({time:10,contacts:[{time:10-CONTACT_FEEDBACK_SECONDS,source:3,target:4,damage:20}]});
  assert.equal(latestCombatContact(state),null);state.time-=.001;assert.equal(latestCombatContact(state).damage,20);
  state.time=5;assert.equal(latestCombatContact(state),null);
});
test('attributed-contact-receipt: foreign actor, invalid damage and absent IDs cannot manufacture contact', () => {
  for(const patch of [{source:99},{target:99},{damage:-1},{damage:NaN},{time:Infinity}]){
    assert.equal(latestCombatContact(coreState({contacts:[{time:4,source:3,target:4,damage:20,...patch}]})),null);
  }
  assert.equal(latestCombatContact(coreState({hero:{},enemy:{}})),null);
  assert.equal(latestCombatContact(coreState({contacts:{}})),null);
});
test('attributed-contact-receipt: retarget reads only the new core, never another core with reused IDs', () => {
  const game=gameFor(coreState());assert.equal(combatExchangeState(game).contact.damage,20);
  game.fight={npc:{id:'native:second',name:'鐘番'},core:{state:()=>coreState({enemy:{id:4,hp:52,maxhp:52},contacts:[]})}};
  const view=combatExchangeState(game);assert.equal(view.enemy.name,'鐘番');assert.equal(view.enemy.hp,52);assert.equal(view.contact,null);
});

class Node {
  constructor(doc,tag){this.ownerDocument=doc;this.tagName=tag;this.children=[];this.dataset={};this.attributes={};this.textContent='';this.hidden=false;}
  append(...children){this.children.push(...children);}
  setAttribute(key,value){this.attributes[key]=value;}
}
function parent(){const doc={createElement:tag=>new Node(doc,tag)};return new Node(doc,'div');}
test('DOM leaf: named vitals, native damage and guard ownership reach distinct visible rows', () => {
  const root=parent(),ui=new CombatExchangeReadout(root),state=coreState(),game=gameFor(state);
  assert.equal(ui.root.hidden,true);ui.update(game);assert.equal(ui.root.hidden,false);
  assert.equal(ui.rows.hero.amount.textContent,'120 / 120');assert.equal(ui.rows.enemy.amount.textContent,'18 / 38');
  assert.equal(ui.rows.enemy.name.textContent,'旅人');assert.equal(ui.rows.enemy.meter.value,18/38);
  assert.equal(ui.rows.enemy.meter.attributes['aria-label'],'旅人の生命 18 / 38');
  assert.equal(ui.contact.textContent,'自分 → 相手 · 命中 · 生命 −20');assert.equal(ui.root.dataset.contact,'outgoing');
  state.contacts.push({time:4.1,source:4,target:3,guard:true,damage:2});ui.update(game);
  assert.equal(ui.root.dataset.contact,'incoming');assert.equal(ui.contact.textContent,'相手 → 自分 · 防御 · 生命 −2');
  assert.equal(ui.contact.attributes.role,'status');
});
test('DOM leaf: overlay/capture clears live contact; next combat cannot resurrect it', () => {
  const ui=new CombatExchangeReadout(parent()),game=gameFor(coreState());ui.update(game);ui.update(game,{overlay:true});
  assert.equal(ui.root.hidden,true);assert.equal(ui.contact.textContent,'');
  game.fight=null;ui.update(game);assert.equal(ui.root.hidden,true);
  const next=gameFor(coreState({contacts:[]}));next.fight.npc.name='<img src=x onerror=alert(1)>';
  ui.update(next);assert.equal(ui.contact.textContent,'直近の接触なし');assert.equal(ui.rows.enemy.name.textContent,next.fight.npc.name);
  assert.equal(ui.rows.enemy.name.children.length,0);
});
test('integration: existing HUD cadence and overlay feed own the view, no new input/timer path', () => {
  const flow=readFileSync(new URL('../src/web/hunt-flow-ui.js',import.meta.url),'utf8');
  assert.match(flow,/import \{CombatExchangeReadout\} from '\.\/combat-exchange-readout\.js'/);
  assert.match(flow,/this\.combatReadout = new CombatExchangeReadout\(byId\('hud'\)\)/);
  assert.match(flow,/this\.combatReadout\.update\(game, \{overlay\}\)/);
  const ui=readFileSync(new URL('../src/web/combat-exchange-readout.js',import.meta.url),'utf8');
  assert.doesNotMatch(ui,/addEventListener|setInterval|setTimeout|requestAnimationFrame|innerHTML/);
  const css=readFileSync(new URL('../src/web/combat-exchange-readout.css',import.meta.url),'utf8');
  assert.match(css,/pointer-events:none/);assert.match(css,/#combat-exchange-readout\[hidden\]\{display:none!important\}/);
});
