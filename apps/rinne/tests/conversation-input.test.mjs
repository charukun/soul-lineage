import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {conversationAvailable,resolveSpeechRecognition} from '../src/rebuild/conversation-input.js';

const uiSource=await readFile(new URL('../src/gameplay-ui.js',import.meta.url),'utf8');
const speechCss=await readFile(new URL('../src/rebuild/conversation-input.css',import.meta.url),'utf8');

test('player speech becomes available only after self-reliance in the village',()=>{
  const base={zone:'village',ageYears:4,down:false,ended:false};
  assert.equal(conversationAvailable({...base,ageYears:3.99}),false);
  assert.equal(conversationAvailable(base),true);
  assert.equal(conversationAvailable({...base,zone:'frontier'}),false);
  assert.equal(conversationAvailable({...base,down:true}),false);
  assert.equal(conversationAvailable({...base,ended:true}),false);
});

test('speech recognition supports standard and webkit adapters without becoming required',()=>{
  function Standard(){}function Webkit(){}
  assert.equal(resolveSpeechRecognition({SpeechRecognition:Standard}),Standard);
  assert.equal(resolveSpeechRecognition({webkitSpeechRecognition:Webkit}),Webkit);
  assert.equal(resolveSpeechRecognition({}),null);
});

test('current gameplay UI owns the speech adapter without reviving a legacy talk action',()=>{
  assert.match(uiSource,/createConversationInput/);
  assert.match(uiSource,/conversation-input\.css/);
  assert.match(uiSource,/getState:\(\)=>state/);
  assert.match(uiSource,/speech\.sync\(\)/);
  assert.match(uiSource,/speech\.dispose\(\)/);
  assert.doesNotMatch(uiSource,/>話す</);
  assert.match(speechCss,/\.speech-fan/);
  assert.match(speechCss,/\.speech-mic/);
  assert.match(speechCss,/z-index:20/);
  assert.match(speechCss,/bottom:max\(88px/);
});
