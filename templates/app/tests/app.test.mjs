import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
test('portable app boots with injected platform locale without a browser', () => {
 const app = createApp({ locale: { language: 'en-US' } });
 assert.equal(app.world.id, 'village.foundation.v1'); assert.equal(app.language, 'en-US');
});
