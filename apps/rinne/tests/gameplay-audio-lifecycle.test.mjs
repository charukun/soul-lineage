import test from 'node:test';
import assert from 'node:assert/strict';

const flush=()=>new Promise(resolve=>setImmediate(resolve));

function restoreGlobal(name,value){
  if(value===undefined)delete globalThis[name];
  else globalThis[name]=value;
}

test('game audio pauses in background and recovers on the next gesture if automatic resume is blocked',async t=>{
  const originalAudio=globalThis.Audio,originalAudioContext=globalThis.AudioContext,originalDocument=globalThis.document,originalWindow=globalThis.window;
  const doc=new EventTarget(),win=new EventTarget();
  doc.hidden=false;doc.visibilityState='visible';
  let blockPlayback=false,blockContext=false;

  class FakeAudio extends EventTarget{
    static last=null;static all=[];
    constructor(src){super();this._src=src;this.paused=true;this.playCalls=0;this.pauseCalls=0;this.loadCalls=0;this.currentTime=14;this.readyState=1;FakeAudio.last=this;FakeAudio.all.push(this);}
    get src(){return this._src;}
    set src(value){this._src=value;}
    getAttribute(name){return name==='src'&&this._src?this._src:null;}
    removeAttribute(name){if(name==='src')this._src='';}
    load(){this.loadCalls++;}
    play(){this.playCalls++;if(blockPlayback)return Promise.reject(new Error('play blocked'));this.paused=false;return Promise.resolve();}
    pause(){this.pauseCalls++;this.paused=true;}
  }
  class FakeAudioContext{
    static last=null;
    constructor(){this.state='suspended';this.resumeCalls=0;this.suspendCalls=0;this.closeCalls=0;FakeAudioContext.last=this;}
    resume(){this.resumeCalls++;if(blockContext)return Promise.reject(new Error('resume blocked'));this.state='running';return Promise.resolve();}
    suspend(){this.suspendCalls++;this.state='suspended';return Promise.resolve();}
    close(){this.closeCalls++;this.state='closed';return Promise.resolve();}
  }

  globalThis.Audio=FakeAudio;globalThis.AudioContext=FakeAudioContext;globalThis.document=doc;globalThis.window=win;
  t.after(()=>{restoreGlobal('Audio',originalAudio);restoreGlobal('AudioContext',originalAudioContext);restoreGlobal('document',originalDocument);restoreGlobal('window',originalWindow);});

  const moduleUrl=new URL('../src/gameplay-audio.js',import.meta.url);moduleUrl.searchParams.set('test',String(Date.now()));
  const {createRinneAudio}=await import(moduleUrl.href);
  const audio=createRinneAudio(),music=FakeAudio.all[0];

  assert.equal(music.playCalls,0,'audio stays silent before a user gesture');
  await audio.unlock();
  const context=FakeAudioContext.last;
  assert.equal(music.paused,false);
  assert.equal(context.state,'running');

  doc.hidden=true;doc.visibilityState='hidden';doc.dispatchEvent(new Event('visibilitychange'));
  await flush();
  assert.equal(music.paused,true,'HTML audio pauses immediately in background');
  assert.equal(music.src,'','HTML audio relinquishes its source while backgrounded');
  assert.ok(music.loadCalls>=1,'detaching the source resets the browser media pipeline');
  assert.equal(context.state,'suspended','Web Audio context suspends in background');

  const resumesWhileHidden=context.resumeCalls;
  audio.select();
  await flush();
  assert.equal(context.resumeCalls,resumesWhileHidden,'effects cannot wake Web Audio while hidden');

  blockPlayback=true;blockContext=true;
  doc.hidden=false;doc.visibilityState='visible';doc.dispatchEvent(new Event('visibilitychange'));
  await flush();
  assert.equal(music.paused,true,'blocked foreground autoplay remains paused');
  assert.notEqual(music.src,'','foreground restore reattaches the BGM source before retrying playback');
  assert.equal(context.state,'suspended','blocked foreground AudioContext remains suspended');

  blockPlayback=false;blockContext=false;context.state='interrupted';
  doc.dispatchEvent(new Event('pointerdown'));
  await flush();
  assert.equal(music.paused,false,'next user gesture restarts music');
  assert.equal(context.state,'running','next user gesture resumes an interrupted context');

  win.dispatchEvent(new Event('pagehide'));await flush();
  assert.equal(music.src,'','pagehide also relinquishes the media source');
  win.dispatchEvent(new Event('pageshow'));await flush();
  assert.notEqual(music.src,'','pageshow restores the source only after prior unlock');

  audio.dispose();
  assert.equal(context.state,'closed');
});

test('the first-cast cue has a sustained audible envelope after the normal gameplay unlock',async t=>{
  const original={Audio:globalThis.Audio,AudioContext:globalThis.AudioContext,document:globalThis.document,window:globalThis.window};
  class FakeAudio extends EventTarget{
    constructor(){super();this.paused=true;this.volume=0;this.currentTime=0;this.readyState=1;}
    load(){} play(){this.paused=false;return Promise.resolve();} pause(){this.paused=true;}
    removeAttribute(){} getAttribute(){return null;}
  }
  const starts=[];
  class FakeContext{
    constructor(){this.state='running';this.currentTime=0;this.destination={};}
    createOscillator(){const voice={frequency:{value:0},connect:()=>({connect:()=>{}}),start(at){starts.push({voice,at});},stop(){}};return voice;}
    createGain(){return{gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect:()=>this.destination};}
    close(){this.state='closed';return Promise.resolve();}
  }
  const doc=new EventTarget(),win=new EventTarget();doc.hidden=false;doc.visibilityState='visible';
  Object.assign(globalThis,{Audio:FakeAudio,AudioContext:FakeContext,document:doc,window:win});
  t.after(()=>{for(const [key,value] of Object.entries(original))restoreGlobal(key,value);});
  const moduleUrl=new URL('../src/gameplay-audio.js',import.meta.url);moduleUrl.searchParams.set('cue-test',String(Date.now()));
  const {createRinneAudio}=await import(moduleUrl.href),audio=createRinneAudio();
  t.after(()=>audio.dispose());
  await audio.unlock();
  audio.inspiration();
  assert.equal(starts.length,5,'the impact and delayed ringing notes are all scheduled');
  assert.ok(starts.at(-1).at>=.5,'the cue continues beyond the initial flash');
  assert.ok(starts[0].voice.frequency.value<100,'the low impact has a distinct body');
});
