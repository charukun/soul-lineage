import test from 'node:test';
import assert from 'node:assert/strict';

const flush=()=>new Promise(resolve=>setImmediate(resolve));

function restoreGlobal(name,value){
  if(value===undefined)delete globalThis[name];
  else globalThis[name]=value;
}

test('game audio pauses while the app is backgrounded and resumes only after prior unlock',async t=>{
  const originalAudio=globalThis.Audio,originalAudioContext=globalThis.AudioContext,originalDocument=globalThis.document;
  const doc=new EventTarget();
  doc.hidden=false;doc.visibilityState='visible';

  class FakeAudio{
    static last=null;
    constructor(src){this.src=src;this.paused=true;this.playCalls=0;this.pauseCalls=0;FakeAudio.last=this;}
    play(){this.playCalls++;this.paused=false;return Promise.resolve();}
    pause(){this.pauseCalls++;this.paused=true;}
  }
  class FakeAudioContext{
    static last=null;
    constructor(){this.state='suspended';this.resumeCalls=0;this.suspendCalls=0;this.closeCalls=0;FakeAudioContext.last=this;}
    resume(){this.resumeCalls++;this.state='running';return Promise.resolve();}
    suspend(){this.suspendCalls++;this.state='suspended';return Promise.resolve();}
    close(){this.closeCalls++;this.state='closed';return Promise.resolve();}
  }

  globalThis.Audio=FakeAudio;globalThis.AudioContext=FakeAudioContext;globalThis.document=doc;
  t.after(()=>{restoreGlobal('Audio',originalAudio);restoreGlobal('AudioContext',originalAudioContext);restoreGlobal('document',originalDocument);});

  const moduleUrl=new URL('../src/gameplay-audio.js',import.meta.url);moduleUrl.searchParams.set('test',String(Date.now()));
  const {createRinneAudio}=await import(moduleUrl.href);
  const audio=createRinneAudio(),music=FakeAudio.last;

  assert.equal(music.playCalls,0,'audio stays silent before a user gesture');
  await audio.unlock();
  const context=FakeAudioContext.last;
  assert.equal(music.paused,false);
  assert.equal(context.state,'running');

  doc.hidden=true;doc.visibilityState='hidden';doc.dispatchEvent(new Event('visibilitychange'));
  await flush();
  assert.equal(music.paused,true,'HTML audio pauses immediately in background');
  assert.equal(context.state,'suspended','Web Audio context suspends in background');

  const resumesWhileHidden=context.resumeCalls;
  audio.select();
  await flush();
  assert.equal(context.resumeCalls,resumesWhileHidden,'effects cannot wake Web Audio while hidden');

  doc.hidden=false;doc.visibilityState='visible';doc.dispatchEvent(new Event('visibilitychange'));
  await flush();
  assert.equal(music.paused,false,'previously unlocked music resumes on foreground');
  assert.equal(context.state,'running');

  audio.dispose();
  assert.equal(context.state,'closed');
});
