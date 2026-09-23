import test from 'node:test';
import assert from 'node:assert/strict';
import {battle2ScreenVector,createBattle2MovementInput} from '../src/battle2-movement.js';

test('screen drag follows camera right/up and tap advances briefly',()=>{
  const view={camera:{position:{x:0,z:10},lookTarget:{x:0,z:0}}};
  assert.deepEqual(battle2ScreenVector({x:1,y:0,amount:1},view),{x:1,z:0,dash:false});
  assert.deepEqual(battle2ScreenVector({x:0,y:-1,amount:1},view),{x:0,z:-1,dash:false});
  class Target extends EventTarget{
    setPointerCapture(){}
    hasPointerCapture(){return false;}
  }
  const canvas=new Target(),win=new Target();let now=0;
  const input=createBattle2MovementInput({canvas,camera:()=>view,win,clock:()=>now});
  const event=(type,x,y)=>{const e=new Event(type,{cancelable:true});Object.assign(e,{pointerId:1,pointerType:'touch',clientX:x,clientY:y});canvas.dispatchEvent(e);};
  event('pointerdown',20,20);now=70;event('pointerup',20,20);
  assert.deepEqual(input.vector(),{x:0,z:-1,dash:false});
  now=220;assert.equal(input.vector(),null);
  input.dispose();
});
