import test from 'node:test';
import assert from 'node:assert/strict';
import {createNocturneSound} from '../src/audio.js';

test('a single Start click can explicitly unlock audio before battle begins',async()=>{
  const oldWindow=globalThis.window,oldFetch=globalThis.fetch;
  class Context{
    constructor(){this.state='suspended';this.destination={};}
    createGain(){return {gain:{value:0},connect(){}};}
    async resume(){this.state='running';}
    async close(){this.state='closed';}
  }
  globalThis.window={AudioContext:Context,location:{href:'https://example.test/'}};
  globalThis.fetch=async()=>({ok:false,status:404});
  try{
    const doc=new EventTarget();doc.hidden=false;doc.baseURI='https://example.test/';
    const sound=createNocturneSound(doc);
    assert.equal(await sound.unlock({isTrusted:true}),true);
    assert.equal(sound.metrics().state,'running');
    assert.equal(sound.metrics().unlocked,true);
    sound.destroy();
  }finally{globalThis.window=oldWindow;globalThis.fetch=oldFetch;}
});
