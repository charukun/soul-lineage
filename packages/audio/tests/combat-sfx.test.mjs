import test from 'node:test';
import assert from 'node:assert/strict';
import {createCombatSfx} from '../src/combat-sfx.js';

test('combat SFX waits for user activation, then alternates real sample clips',async()=>{
  const clips=[];
  class FakeAudio{
    constructor(url){this.url=url;this.currentTime=0;this.volume=1;this.preload='';this.plays=0;clips.push(this);}
    play(){this.plays++;return Promise.resolve();}
    pause(){}
  }
  const listeners=new Map();
  const document={
    addEventListener(type,fn){listeners.set(type,fn);},
    removeEventListener(type,fn){if(listeners.get(type)===fn)listeners.delete(type);}
  };
  const sfx=createCombatSfx({AudioCtor:FakeAudio,document,volume:.5});
  assert.equal(sfx.slash(),false,'autoplay must not be forced before a gesture');
  listeners.get('pointerdown')();
  assert.equal(sfx.unlocked,true);
  assert.equal(sfx.slash(),true);
  assert.equal(sfx.slash(),true);
  assert.equal(clips[0].plays,1);
  assert.equal(clips[1].plays,1);
  sfx.setEnabled(false);assert.equal(sfx.slash(),false);
  sfx.dispose();
});
