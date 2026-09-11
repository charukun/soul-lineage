import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewDeploymentUrl } from '../scripts/review-deployment-url.mjs';

test('public verification uses only the dedicated stable Worker URL', () => {
  assert.equal(reviewDeploymentUrl('Uploaded\n https://rinne-visual-review.example.workers.dev\nVersion ID: 123'), 'https://rinne-visual-review.example.workers.dev/');
  for (const log of ['https://other-worker.example.workers.dev', 'https://abc-rinne-visual-review.example.workers.dev', 'https://example.pages.dev', 'https://rinne-visual-review.a.workers.dev https://rinne-visual-review.b.workers.dev', 'Upload failed']) {
    assert.throws(() => reviewDeploymentUrl(log));
  }
});
