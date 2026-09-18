import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {clearBrowserMediaSession,relinquishMediaElement,restoreMediaElement} from '../packages/shared-ui/src/media-lifecycle.js';

class FakeMedia extends EventTarget{
  constructor(){super();this._src='blob:track';this.paused=false;this.currentTime=37;this.readyState=1;this.loadCalls=0;this.loop=false;}
  get src(){return this._src;}
  set src(value){this._src=value;}
  getAttribute(name){return name==='src'&&this._src?this._src:null;}
  removeAttribute(name){if(name==='src')this._src='';}
  pause(){this.paused=true;}
  load(){this.loadCalls++;}
}

test('relinquishing media detaches its source and clears Media Session state',()=>{
  const player=new FakeMedia();
  const mediaSession={playbackState:'playing',metadata:{title:'track'}};
  const snapshot=relinquishMediaElement(player,{mediaSession});
  assert.deepEqual(snapshot,{position:37,hadSource:true,wasPlaying:true});
  assert.equal(player.paused,true);
  assert.equal(player.src,'');
  assert.equal(player.loadCalls,1);
  assert.equal(mediaSession.playbackState,'none');
  assert.equal(mediaSession.metadata,null);
});

test('restoring media reattaches its source and position',()=>{
  const player=new FakeMedia();
  relinquishMediaElement(player,{mediaSession:null});
  assert.equal(restoreMediaElement(player,{src:'blob:track',position:37,loop:true}),true);
  assert.equal(player.src,'blob:track');
  assert.equal(player.currentTime,37);
  assert.equal(player.loop,true);
  assert.equal(player.loadCalls,2);
});

test('Media Session cleanup tolerates unavailable integration',()=>{
  assert.doesNotThrow(()=>clearBrowserMediaSession(null));
});

test('shared music and Rinne gameplay use the background-safe media lifecycle',()=>{
  const here=dirname(fileURLToPath(import.meta.url));
  const shared=readFileSync(join(here,'../packages/shared-ui/src/music.js'),'utf8');
  const rinne=readFileSync(join(here,'../apps/rinne/src/gameplay-audio.js'),'utf8');
  assert.match(shared,/relinquishMediaElement/);
  assert.match(shared,/restoreMediaElement/);
  assert.match(shared,/pagehide/);
  assert.match(rinne,/relinquishMediaElement/);
  assert.match(rinne,/restoreMediaElement/);
  assert.match(rinne,/pagehide/);
});
