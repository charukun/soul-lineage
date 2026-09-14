import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ensureTrustedReview, trustedReviewContext, trustedReviewPrefix } from '../scripts/integration.mjs';

const sha = 'b'.repeat(40);
const pr = { number: 84, head: { sha } };

test('trusted Integration falls back to an exact-head status when GitHub bot approval returns 422', async () => {
  let storedStatus = null;
  const c = {
    root: '/repos/charukun/soul-lineage',
    async api(method, path, body) {
      if (method === 'POST' && path.endsWith('/pulls/84/reviews')) throw new Error('GitHub POST /repos/charukun/soul-lineage/pulls/84/reviews: HTTP 422');
      if (method === 'POST' && path.endsWith(`/statuses/${sha}`)) { storedStatus = body; return body; }
      throw new Error(`Unexpected ${method} ${path}`);
    },
    async pages(path) {
      if (path.endsWith('/pulls/84/reviews')) return [];
      if (path.endsWith(`/commits/${sha}/statuses`)) return storedStatus ? [storedStatus] : [];
      throw new Error(`Unexpected pages ${path}`);
    },
  };
  const reviews = await ensureTrustedReview(c, pr);
  assert.equal(storedStatus.context, trustedReviewContext);
  assert.equal(storedStatus.state, 'success');
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0].state, 'APPROVED');
  assert.equal(reviews[0].commit_id, sha);
  assert.match(reviews[0].body, new RegExp(`^${trustedReviewPrefix}${sha}`));
});

test('non-422 review failures still fail closed', async () => {
  const c = {
    root: '/repos/charukun/soul-lineage',
    async api() { throw new Error('GitHub review API: HTTP 403'); },
    async pages() { return []; },
  };
  await assert.rejects(ensureTrustedReview(c, pr), /HTTP 403/);
});
