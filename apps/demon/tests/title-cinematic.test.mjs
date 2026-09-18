import test from 'node:test';
import assert from 'node:assert/strict';
import {titleCinematicPolicy} from '../src/web/title-cinematic.js';

test('first eligible title visit plays the cinematic and living still',()=>{
  assert.deepEqual(titleCinematicPolicy({allowIntro:true,reducedMotion:false,effectsEnabled:true,introSeen:false}),{playIntro:true,playLiving:true});
});

test('returning to title never replays the long intro',()=>{
  assert.deepEqual(titleCinematicPolicy({allowIntro:true,reducedMotion:false,effectsEnabled:true,introSeen:true}),{playIntro:false,playLiving:true});
  assert.deepEqual(titleCinematicPolicy({allowIntro:false,reducedMotion:false,effectsEnabled:true,introSeen:false}),{playIntro:false,playLiving:true});
});

test('reduced motion and background-effects off both stay operable on the poster',()=>{
  assert.deepEqual(titleCinematicPolicy({allowIntro:true,reducedMotion:true,effectsEnabled:true,introSeen:false}),{playIntro:false,playLiving:false});
  assert.deepEqual(titleCinematicPolicy({allowIntro:true,reducedMotion:false,effectsEnabled:false,introSeen:false}),{playIntro:false,playLiving:false});
});
