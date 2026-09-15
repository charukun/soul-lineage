import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MURA_DIALOGUE_TOPICS,muraDialogueTopic,muraFacilityMeaning,muraSpeechPhrases} from '../packages/world/src/mura/dialogue.js';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('shared MURA dialogue topics point to canonical facility meanings',()=>{
  for(const topic of Object.values(MURA_DIALOGUE_TOPICS)){
    assert.ok(topic.id&&topic.label&&topic.fact&&topic.kinds.length);
    for(const kind of topic.kinds){const facility=muraFacilityMeaning(kind);assert.ok(facility,`missing shared facility ${kind}`);assert.ok(facility.trait);assert.equal(muraDialogueTopic(topic.id,{kind}).compatible,true);}
  }
});

test('preset speech intents are stable unique choices usable without microphone support',()=>{
  const phrases=muraSpeechPhrases();assert.equal(phrases.length,6);
  assert.equal(new Set(phrases.map(item=>item.id)).size,phrases.length);
  assert.equal(new Set(phrases.map(item=>item.text)).size,phrases.length);
  for(const phrase of phrases){assert.ok(phrase.label);assert.ok(phrase.text);}
});

test('Village and Rinne consume the common package instead of importing each other',async()=>{
  const [village,birth]=await Promise.all([read('apps/village/src/game/catalog.js'),read('apps/rinne/src/rebuild/birth-tour.js')]);
  assert.match(village,/@soul\/world\/mura\/dialogue/);assert.doesNotMatch(village,/apps\/rinne/);
  assert.match(birth,/@soul\/world\/mura\/dialogue/);assert.match(birth,/muraDialogueTopic/);assert.doesNotMatch(birth,/BIRTH_TOUR_LINES/);assert.doesNotMatch(birth,/apps\/village/);
});
