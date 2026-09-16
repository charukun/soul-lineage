import test from 'node:test';
import assert from 'node:assert/strict';
import {muraSpeechIntent,muraSpeechPhrases} from '../packages/world/src/mura/dialogue.js';

test('shared MURA preset speech intents are stable unique portable choices',()=>{
  const phrases=muraSpeechPhrases();
  assert.equal(phrases.length,6);
  assert.equal(new Set(phrases.map(item=>item.id)).size,phrases.length);
  assert.equal(new Set(phrases.map(item=>item.text)).size,phrases.length);
  for(const phrase of phrases){assert.ok(phrase.label);assert.ok(phrase.text);assert.deepEqual(muraSpeechIntent(phrase.id),phrase);}
  phrases[0].text='changed';
  assert.equal(muraSpeechIntent('greet').text,'こんにちは');
});
