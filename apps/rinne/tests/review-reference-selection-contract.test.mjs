import test from 'node:test';
import assert from 'node:assert/strict';
import { REVIEW_REFERENCE_MODELS } from '../src/review/reference-character-models.js';
test('every reference row resolves through the shared Shino motion source',()=>{for(const row of REVIEW_REFERENCE_MODELS){assert.equal(row.sourcePresetId,'model.SHINO');assert.equal(row.kind,'character');assert.ok(row.parts.hair);assert.ok(row.front);assert.ok(row.back);}});
