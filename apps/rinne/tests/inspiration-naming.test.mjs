import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAUSAL_ANSWERS,
  CAUSAL_ANSWER_BY_ID,
  inspirationTechniqueName,
  validateCausalAnswers,
} from '@soul/game-data';
import { inspirationName } from '../src/rebuild/inspiration-state.js';

test('inspiration names are canonical and do not inherit player-authored save names', () => {
  const state = {
    inspiration: {
      records: {
        'spark.spear.tide': { name: '俺の最強技' },
      },
    },
  };
  assert.equal(inspirationName(state, 'spark.spear.tide'), '潮返し');
});

test('authored inspiration names avoid chained middle-dot naming', () => {
  assert.equal(validateCausalAnswers(), true);
  for (const row of CAUSAL_ANSWERS) {
    const rendered = inspirationTechniqueName(row);
    assert.ok((rendered.match(/・/g) || []).length <= 1, rendered);
  }
  assert.equal(CAUSAL_ANSWER_BY_ID['spark.spear.wedge'].name, '楔返し');
  assert.equal(CAUSAL_ANSWER_BY_ID['spark.great.wait'].name, '待受落とし');
});

test('special techniques use authored secret or ultimate titles', () => {
  assert.equal(inspirationTechniqueName({ name: '潮返し', nameGrade: 'secret' }), '秘技・潮返し');
  assert.equal(inspirationTechniqueName({ name: '潮返し', nameGrade: 'ultimate' }), '奥義・潮返し');
});
