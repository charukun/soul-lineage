import test from 'node:test';
import assert from 'node:assert/strict';
import {storyActionPriority,choosePrimaryStoryAction,storyTransientObjective,uniqueStoryDestinations} from '../src/story/action-priority.js';

const button=(action,{disabled=false}={})=>({dataset:{action},disabled});

test('active life action keeps its cancel control primary over nearby travel or equipment',()=>{
  const state={activity:{kind:'care'},pendingDiscoveries:[]};
  const primary=choosePrimaryStoryAction([
    button('activity:observe:field',{disabled:true}),
    button('equip:sword'),
    button('travel'),
    button('cancel'),
  ],state);
  assert.equal(primary.dataset.action,'cancel');
});

test('a newly discovered technique becomes the primary reward after activity completion',()=>{
  const state={activity:null,pendingDiscoveries:['attention']};
  const primary=choosePrimaryStoryAction([
    button('activity:care:home'),button('activity:observe:field'),button('discover')
  ],state);
  assert.equal(primary.dataset.action,'discover');
});

test('frontier rescue stays ahead of progression and return',()=>{
  const state={activity:null,pendingDiscoveries:[]};
  const primary=choosePrimaryStoryAction([
    button('rescue'),button('next'),button('travel')
  ],state);
  assert.equal(primary.dataset.action,'rescue');
});

test('disabled high-priority action does not hide an enabled action',()=>{
  const state={activity:null,pendingDiscoveries:['attention']};
  const primary=choosePrimaryStoryAction([
    button('discover',{disabled:true}),button('activity:study:library')
  ],state);
  assert.equal(primary.dataset.action,'activity:study:library');
  assert.ok(storyActionPriority('activity:observe:field',state)>storyActionPriority('activity:study:library',state));
});

test('village objective temporarily reflects the action or reward that needs attention',()=>{
  assert.equal(storyTransientObjective({phase:'living',zone:'village',activity:{kind:'care'},pendingDiscoveries:[]}),'生活行動を続けています。歩き出すと中断します。');
  assert.equal(storyTransientObjective({phase:'living',zone:'village',activity:null,pendingDiscoveries:['attention']}),'暮らしの閃きを受け取り、技目録へ加えよう。');
  assert.equal(storyTransientObjective({phase:'living',zone:'frontier',activity:null,pendingDiscoveries:['attention']}),null);
});

test('map groups several activities on the same physical landmark and preserves its canonical target',()=>{
  const places=[
    {id:'home',name:'村長のテント',x:-5,z:5,verb:'母に話す'},
    // Fallback school/library/shrine can precede the authored campfire place.
    {id:'school',name:'焚き火',x:6,z:8,verb:'文字を学ぶ'},
    {id:'library',name:'焚き火',x:6,z:8,verb:'本を読む'},
    {id:'shrine',name:'焚き火',x:6,z:8,verb:'祈りを捧げる'},
    {id:'garden',name:'焚き火',x:6,z:8,verb:'体を動かす'},
  ];
  const destinations=uniqueStoryDestinations(places);
  assert.equal(destinations.length,2);
  const fire=destinations.find(place=>place.name==='焚き火');
  assert.equal(fire.id,'garden');
  assert.deepEqual(fire.aliases,['school','library','shrine','garden']);
  assert.deepEqual(fire.activities,['文字を学ぶ','本を読む','祈りを捧げる','体を動かす']);
  assert.equal(fire.verb,'文字を学ぶ・本を読む・祈りを捧げる・体を動かす');
});

test('journal practice stays visible without displacing an urgent action',()=>{
  const practice=button('activity:observe:field');practice.dataset.recommended='true';
  assert.equal(choosePrimaryStoryAction([button('activity:care:home'),practice],{}),practice);
  for(const [action,state] of [['cancel',{activity:{kind:'care'}}],['discover',{pendingDiscoveries:['attention']}],['travel',{}],['rescue',{}]]){
    const urgent=button(action);assert.equal(choosePrimaryStoryAction([practice,urgent],state),urgent);
  }
  practice.disabled=true;
  assert.equal(choosePrimaryStoryAction([practice,button('activity:care:home')],{}).dataset.action,'activity:care:home');
});
