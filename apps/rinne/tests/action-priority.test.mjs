import test from 'node:test';
import assert from 'node:assert/strict';
import {storyActionPriority,choosePrimaryStoryAction} from '../src/story/action-priority.js';

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
