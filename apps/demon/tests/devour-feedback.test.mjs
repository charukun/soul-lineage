import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {advanceDevour, DEVOUR_SECONDS} from '../../../packages/raid/devour.js';
import {devourFeedback, CONSUME_FEEDBACK_SECONDS} from '../src/web/devour-feedback-state.js';

const prey = {traveller: {power: '命の余熱'}};
// Native capture is exercised unchanged; the event sink supplies a reward-port
// fixture. Economy correctness is not inferred from this isolated leaf fixture.
function session({distance = .75, blocked = false, reward = {memoryNew:true, maxHpGain:4, healed:4, lootGain:2, carried:2, techniqueSpeed:103}} = {}) {
  const npc = {name:'旅人', role:'traveller', x:distance, z:0, dead:true, eaten:false};
  return {
    player:{x:0,z:0,walk:0}, profile:{form:'stalker'}, devour:{npc,t:0},
    time:0, events:[], eaten:0, finished:false, fight:null,
    lineBlocked:()=>blocked,
    walkActor(p,x,z){if(blocked)return 0;p.x+=x;p.z+=z;return Math.hypot(x,z);},
    consume(n){assert.equal(n.eaten,false);n.eaten=true;this.eaten++;this.events.push({type:'consume',role:n.role,at:this.time,reward});}
  };
}
function step(s, dt, amount = 0) {s.time += dt;advanceDevour(s,dt,amount);}
function complete(s) {for(let i=0;i<260&&s.devour;i++)step(s,1/60);assert.equal(s.eaten,1);}

test('capture-progress: native approach and blocked approach never fabricate progress or reward', () => {
  for(const blocked of [false,true]) {
    const s=session({distance:3,blocked});step(s,1/60);
    const ui=devourFeedback(s,{prey});
    assert.equal(ui.state,'approach');assert.equal(ui.progress,null);assert.equal(ui.loot,'');
    assert.match(ui.title,/近づく/);assert.match(ui.action,/止まったまま.*スワイプで中断/);
    assert.equal(s.eaten,0);
    if(blocked){for(let i=0;i<300;i++)step(s,1/60);assert.equal(devourFeedback(s).progress,null);assert.equal(s.eaten,0);}
  }
});

test('capture-progress: live native channel projects exact monotonic progress until real completion', () => {
  const s=session();let previous=0;
  for(let i=0;i<120;i++) {
    step(s,1/60);const ui=devourFeedback(s,{prey});
    assert.equal(ui.state,'feeding');assert.equal(ui.progress,s.player.devourProgress);
    assert.ok(ui.progress>=previous);previous=ui.progress;
    assert.match(ui.detail,/%/);assert.equal(ui.loot,'');assert.equal(s.eaten,0);
  }
  assert.ok(Math.abs(previous-2/DEVOUR_SECONDS)<1e-9);
  complete(s);assert.equal(s.devour,null);assert.equal(s.player.devourProgress,null);
  assert.equal(devourFeedback(s,{prey}).state,'complete');
});

test('capture-progress: native swipe cancellation removes progress without a completion receipt', () => {
  const s=session();step(s,.5);assert.equal(devourFeedback(s).state,'feeding');
  step(s,1/60,.09);assert.equal(s.devour,null);assert.equal(s.eaten,0);
  assert.equal(devourFeedback(s),null);
});

test('consume-receipt: real channel completion exposes actual event gains and unsecured meaning read-only', () => {
  const s=session();complete(s);const before=structuredClone({events:s.events,player:s.player,eaten:s.eaten});
  const ui=devourFeedback(s,{prey});
  assert.equal(ui.title,'捕食完了');assert.match(ui.detail,/命の余熱を獲得/);
  assert.match(ui.detail,/最大生命 \+4/);assert.match(ui.detail,/技速 103%/);
  assert.equal(ui.loot,'未確保の戦利品 +2（計 2）');
  assert.match(ui.action,/スワイプで移動再開.*帰還で戦利品を確保/);
  assert.equal(ui.progress,null);assert.doesNotMatch(ui.loot,/確保済|目標報酬/);
  for(let i=0;i<10;i++)devourFeedback(s,{prey});
  assert.deepEqual({events:s.events,player:s.player,eaten:s.eaten},before);
});

test('consume-receipt: repeated trait is not called new; healing, growth and learned move remain distinct', () => {
  const s=session({reward:{memoryNew:false,maxHpGain:4,healed:17,lootGain:2,carried:4,moveNew:true}});complete(s);
  const ui=devourFeedback(s,{prey});assert.doesNotMatch(ui.detail,/命の余熱|特能を獲得/);
  assert.match(ui.detail,/生命 \+17/);assert.match(ui.detail,/最大生命 \+4/);
  assert.match(ui.detail,/身捌きを習得/);assert.equal(ui.loot,'未確保の戦利品 +2（計 4）');
});

test('consume-receipt: only active game time ages feedback; overlays hide without consuming its lifetime', () => {
  const s=session();complete(s);const at=s.time;
  assert.equal(devourFeedback(s,{overlay:true}),null);
  assert.equal(devourFeedback(s).state,'complete');
  s.time=at+CONSUME_FEEDBACK_SECONDS-.01;assert.equal(devourFeedback(s).state,'complete');
  s.time=at+CONSUME_FEEDBACK_SECONDS;assert.equal(devourFeedback(s),null);
  s.time=at-1;assert.equal(devourFeedback(s),null);
});

test('handoff: next combat/down/finish and new session cannot resurrect an older reward', () => {
  for(const type of ['engage','down','finish']) {
    const s=session();complete(s);s.events.push({type});assert.equal(devourFeedback(s),null);
  }
  const s=session();complete(s);s.fight={};assert.equal(devourFeedback(s),null);
  s.fight=null;s.finished=true;assert.equal(devourFeedback(s),null);
  assert.equal(devourFeedback({player:{},events:[],time:0}),null);
});

test('projection fails closed for missing time/reward and never uses malformed progress as feeding', () => {
  const s=session();s.devour.phase='feeding';s.player.devourProgress=NaN;
  assert.equal(devourFeedback(s).state,'approach');
  s.player.devourProgress=2;assert.equal(devourFeedback(s).progress,1);
  s.player.devourProgress=-1;assert.equal(devourFeedback(s).progress,0);
  s.devour=null;s.events=[{type:'consume',at:0}];assert.equal(devourFeedback(s),null);
  s.events=[{type:'consume',reward:{lootGain:2}}];assert.equal(devourFeedback(s),null);
});

test('HUD integration owns no simulation and keeps the scoped readout outside the hidden objective', () => {
  const source=readFileSync(new URL('../src/web/hunt-flow-ui.js',import.meta.url),'utf8');
  const css=readFileSync(new URL('../src/web/devour-feedback.css',import.meta.url),'utf8');
  assert.match(source,/devourFeedback\(game, \{overlay, prey: PREY\}\)/);
  assert.match(source,/byId\('hud'\)\.append\(this\.devourReadout\)/);
  assert.match(source,/this\.devourProgress\.value = feedback\.progress/);
  assert.match(source,/node\.textContent = feedback\[key\]/);
  assert.match(css,/#devour-feedback\[hidden\]/);assert.match(css,/pointer-events:none/);
  assert.match(css,/:has\(#angled-guide\[data-variant="compact"\]:not\(\[hidden\]\)\)/);
  assert.match(css,/bottom:calc\(280px \+ env\(safe-area-inset-bottom\)\)/);
  assert.doesNotMatch(source,/advanceDevour|game\.consume\(/);
});
