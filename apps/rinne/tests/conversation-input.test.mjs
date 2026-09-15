import test from 'node:test';
import assert from 'node:assert/strict';
import {conversationAvailable,resolveSpeechRecognition} from '../src/rebuild/conversation-input.js';

test('player speech becomes available only after self-reliance in the village',()=>{
  const base={zone:'village',ageYears:4,down:false,ended:false};
  assert.equal(conversationAvailable({...base,ageYears:3.99}),false);
  assert.equal(conversationAvailable(base),true);
  assert.equal(conversationAvailable({...base,zone:'frontier'}),false);
  assert.equal(conversationAvailable({...base,down:true}),false);
  assert.equal(conversationAvailable({...base,ended:true}),false);
});

test('speech recognition supports standard and webkit browser adapters without becoming required',()=>{
  function Standard(){}function Webkit(){}
  assert.equal(resolveSpeechRecognition({SpeechRecognition:Standard}),Standard);
  assert.equal(resolveSpeechRecognition({webkitSpeechRecognition:Webkit}),Webkit);
  assert.equal(resolveSpeechRecognition({}),null);
});
