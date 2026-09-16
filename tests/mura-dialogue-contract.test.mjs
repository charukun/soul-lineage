import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {defs} from '../packages/world/src/mura/catalog.js';
import {muraDialogueTopic,muraResidentReactionLine,muraSharedLine,muraTopicLine} from '../packages/world/src/mura/dialogue.js';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('shared MURA topics resolve facility meaning from the canonical catalog',()=>{
  const square=muraDialogueTopic('village-square',{kind:'campfire'}),line=muraTopicLine('village-square',{kind:'campfire'});
  assert.equal(square.compatible,true);
  assert.equal(square.facility.label,defs.campfire.label);
  assert.equal(square.facility.trait,defs.campfire.trait);
  assert.ok(line.includes(defs.campfire.label));
  assert.ok(line.includes(defs.campfire.trait));
  assert.equal(muraTopicLine('village-square',{kind:'school'}),null);
});

test('shared dialogue owns the Rinne birth framing and Village resident reactions',()=>{
  assert.match(muraSharedLine('first-outing'),/お外は初めて/);
  assert.match(muraSharedLine('walk-alone'),/自分の足で歩ける/);
  assert.equal(muraResidentReactionLine('growth'),'村が少し育ったね');
  assert.equal(muraResidentReactionLine('danger'),'みんな、気をつけて');
});

test('Rinne and Village consume the shared MURA dialogue module instead of local copies',async()=>{
  const [tour,birth,village]=await Promise.all([
    read('apps/rinne/src/rebuild/birth-tour.js'),
    read('apps/rinne/src/rebuild/birth-experience.js'),
    read('apps/village/src/mura-playability-polish.js'),
  ]);
  assert.match(tour,/@soul\/world\/mura\/dialogue/);
  assert.doesNotMatch(tour,/BIRTH_TOUR_LINES/);
  assert.match(birth,/muraSharedLine\('first-outing'\)/);
  assert.match(birth,/muraSharedLine\('walk-alone'\)/);
  assert.doesNotMatch(birth,/お外は初めてだね。今日は一緒に村を見てまわろう。/);
  assert.doesNotMatch(birth,/さあ、地面へ。今日からは自分の足で歩けるよ。/);
  assert.match(village,/@soul\/world\/mura\/dialogue/);
  assert.match(village,/muraResidentReactionLine\(tone\)/);
  assert.doesNotMatch(village,/const lines=\{growth:/);
});
