import test from 'node:test';
import assert from 'node:assert/strict';
import {SWIPE_RULES,SwipeInput} from '../swipe.js';

test('quick flick enters dash and keeps its release direction',()=>{
 const input=new SwipeInput();
 assert.equal(input.down(1,100,100,0),true);
 input.move(1,122,100,45);
 assert.equal(input.up(1,146,100,90),true);
 const v=input.vector();
 assert.equal(input.dash,true);
 assert.ok(v.screenX>.99);
 assert.ok(Math.abs(v.screenY)<.01);
 assert.equal(v.amount,1);
});

test('terminal flick can enter dash after a long walking drag',()=>{
 const input=new SwipeInput();
 input.down(1,100,100,0);
 input.move(1,100,145,380);
 input.move(1,100,157,600);
 input.move(1,100,174,650);
 assert.equal(input.up(1,100,198,705),true);
 assert.equal(input.dash,true);
 assert.ok(input.vector().screenY>.99);
});

test('terminal flick direction wins over the earlier drag direction',()=>{
 const input=new SwipeInput();
 input.down(1,100,100,0);
 input.move(1,155,100,420);
 input.move(1,155,114,590);
 input.move(1,155,134,640);
 assert.equal(input.up(1,155,158,690),true);
 const v=input.vector();
 assert.equal(input.dash,true);
 assert.ok(Math.abs(v.screenX)<.05,`screenX=${v.screenX}`);
 assert.ok(v.screenY>.99,`screenY=${v.screenY}`);
});

test('fast drag followed by a hold still stops on release',()=>{
 const input=new SwipeInput();
 input.down(1,100,100,0);
 input.move(1,220,100,80);
 assert.equal(input.up(1,220,100,320),false);
 assert.equal(input.dash,false);
});

test('slow release remains ordinary movement and next input cancels an active dash',()=>{
 const input=new SwipeInput();
 input.down(1,100,100,0);
 input.move(1,118,100,300);
 assert.equal(input.up(1,128,100,700),false);
 assert.equal(input.dash,false);

 input.down(2,100,100,800);
 input.move(2,130,100,850);
 assert.equal(input.up(2,156,100,900),true);
 assert.equal(input.dash,true);
 assert.equal(input.down(3,100,100,950),true);
 assert.equal(input.dash,false);
});

test('SWIPE_RULES is gesture-only and owns no gameplay speed or notice distance',()=>{
  for(const key of ['walkSpeed','combatSpeed','dashSpeed','notice'])assert.equal(Object.hasOwn(SWIPE_RULES,key),false,key);
});
