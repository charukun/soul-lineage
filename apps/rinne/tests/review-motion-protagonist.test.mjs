import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {KAYKIT_MODELS,PROTAGONIST_VILLAGER_MODEL} from '@soul/characters';
import {
  RINNE_MOTION_REVIEW_DEFAULT_MODEL,
  RINNE_MOTION_REVIEW_MODELS,
  RINNE_PROTAGONIST_REVIEW_TARGET
} from '../src/review-motion-models.js';

const glbPath='apps/rinne/public/simulator/assets/PROTAGONIST_VILLAGER_V1.glb';
const gitBlobSha=bytes=>createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');

test('motion review default is the same repository-local DCC protagonist used by gameplay',()=>{
  const bytes=readFileSync(glbPath);
  assert.equal(RINNE_MOTION_REVIEW_DEFAULT_MODEL,RINNE_PROTAGONIST_REVIEW_TARGET);
  assert.equal(RINNE_PROTAGONIST_REVIEW_TARGET.id,PROTAGONIST_VILLAGER_MODEL.id);
  assert.equal(RINNE_PROTAGONIST_REVIEW_TARGET.runtime.url,PROTAGONIST_VILLAGER_MODEL.assetPath);
  assert.equal(RINNE_PROTAGONIST_REVIEW_TARGET.source.byteLength,bytes.length);
  assert.equal(gitBlobSha(bytes),RINNE_PROTAGONIST_REVIEW_TARGET.source.gitBlobSha);
  assert.equal(RINNE_PROTAGONIST_REVIEW_TARGET.source.gitBlobSha,'28fae04c0d0276af60e854756e8e7d10a5b965d3');
  assert.equal(RINNE_PROTAGONIST_REVIEW_TARGET.license,'CC0-1.0');
  assert.equal(RINNE_PROTAGONIST_REVIEW_TARGET.rigId,'Rig_Medium');
});

test('motion review keeps KayKit alternatives after the protagonist default',()=>{
  assert.equal(RINNE_MOTION_REVIEW_MODELS[0],RINNE_PROTAGONIST_REVIEW_TARGET);
  assert.deepEqual(RINNE_MOTION_REVIEW_MODELS.slice(1),KAYKIT_MODELS);
});
