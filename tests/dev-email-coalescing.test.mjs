import test from 'node:test';
import assert from 'node:assert/strict';
import {
  choosePreviousPublishedDevelopSha,
  findPublishedDevelopPrs,
  recordGithubDeliveryReceipt,
  recordGithubDeliveryReceipts,
  developmentEmailStatus,
} from '../scripts/notify-delivery.mjs';

const repo = 'charukun/soul-lineage';
const previous = '1'.repeat(40);
const current = '2'.repeat(40);
const merge874 = '3'.repeat(40);
const merge876 = '4'.repeat(40);
const merge877 = '5'.repeat(40);

function response(data, status = 200) {
  return Promise.resolve(new Response(data === null ? '' : JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  }));
}
function pr(number, mergeSha, mergedAt, login = 'charukun') {
  return {
    number,
    title: `PR ${number}`,
    body: `変更 ${number}\n詳細`,
    merged_at: mergedAt,
    merge_commit_sha: mergeSha,
    user: { login },
    base: { ref: 'develop', repo: { full_name: repo } },
  };
}

test('previous published SHA comes from the newest non-current DEV LKG artifact', () => {
  const artifacts = [
    { name: `dev-lkg-site-${previous}`, created_at: '2026-09-18T03:10:00Z', expired: false },
    { name: `dev-lkg-site-${current}`, created_at: '2026-09-18T03:20:00Z', expired: false },
    { name: `dev-lkg-site-${'9'.repeat(40)}`, created_at: '2026-09-18T03:00:00Z', expired: false },
  ];
  assert.equal(choosePreviousPublishedDevelopSha(artifacts, current), previous);
});

test('coalesced DEV publish returns every merged develop PR under current and legacy merge messages', async () => {
  const calls = [];
  const request = async (url, init = {}) => {
    calls.push({ url, method: init.method || 'GET' });
    if (url.includes('/actions/artifacts?')) return response({ artifacts: [
      { name: `dev-lkg-site-${current}`, created_at: '2026-09-18T03:20:00Z', expired: false },
      { name: `dev-lkg-site-${previous}`, created_at: '2026-09-18T03:10:00Z', expired: false },
    ] });
    if (url.includes(`/compare/${previous}...${current}`)) return response({
      status: 'ahead',
      commits: [
        { sha: 'a'.repeat(40), commit: { message: 'feat: branch commit' } },
        { sha: merge874, commit: { message: 'Merge PR #874: feat a' } },
        { sha: merge876, commit: { message: 'Merge pull request #876 from charukun/fix/b\n\nfix: b' } },
      ],
    });
    if (url.endsWith('/pulls/874')) return response(pr(874, merge874, '2026-09-18T03:12:32Z'));
    if (url.endsWith('/pulls/876')) return response(pr(876, merge876, '2026-09-18T03:12:40Z'));
    throw new Error(`Unexpected request: ${url}`);
  };
  const prs = await findPublishedDevelopPrs({ token: 'token', repository: repo, sha: current, request });
  assert.deepEqual(prs.map(row => row.number), [874, 876]);
  assert.equal(calls.filter(call => call.url.includes('/compare/')).length, 1);
});

test('unknown merge message falls back to commit association for a merge commit', async () => {
  const request = async url => {
    if (url.includes('/actions/artifacts?')) return response({ artifacts: [
      { name: `dev-lkg-site-${previous}`, created_at: '2026-09-18T03:10:00Z', expired: false },
    ] });
    if (url.includes(`/compare/${previous}...${current}`)) return response({
      status: 'ahead',
      commits: [{ sha: merge877, parents: [{ sha: 'a'.repeat(40) }, { sha: 'b'.repeat(40) }], commit: { message: 'Integrate reviewed change' } }],
    });
    if (url.endsWith(`/commits/${merge877}/pulls?per_page=100`)) return response([pr(877, merge877, '2026-09-18T03:13:00Z')]);
    if (url.endsWith('/pulls/877')) return response(pr(877, merge877, '2026-09-18T03:13:00Z'));
    throw new Error(`Unexpected request: ${url}`);
  };
  const prs = await findPublishedDevelopPrs({ token: 'token', repository: repo, sha: current, request });
  assert.deepEqual(prs.map(row => row.number), [877]);
});

test('missing LKG baseline falls back to the PR directly associated with the published SHA', async () => {
  const direct = pr(900, current, '2026-09-18T04:00:00Z');
  const request = async url => {
    if (url.includes('/actions/artifacts?')) return response({ artifacts: [] });
    if (url.endsWith(`/commits/${current}/pulls?per_page=100`)) return response([direct]);
    throw new Error(`Unexpected request: ${url}`);
  };
  const prs = await findPublishedDevelopPrs({ token: 'token', repository: repo, sha: current, request });
  assert.deepEqual(prs.map(row => row.number), [900]);
});

test('each coalesced PR gets its own merge-SHA receipt marker', async () => {
  const posts = [];
  const prs = [
    pr(874, merge874, '2026-09-18T03:12:32Z'),
    pr(876, merge876, '2026-09-18T03:12:40Z'),
  ];
  const request = async (url, init = {}) => {
    if ((init.method || 'GET') === 'GET' && url.includes('/comments?')) return response([]);
    if (init.method === 'POST' && url.includes('/comments')) {
      posts.push({ url, body: JSON.parse(init.body) });
      return response({ id: posts.length }, 201);
    }
    throw new Error(`Unexpected request: ${init.method || 'GET'} ${url}`);
  };
  const results = await recordGithubDeliveryReceipts({ token: 'token', repository: repo, sha: current, prs, request });
  assert.deepEqual(results, [
    { pr: 874, receipt: 'github-pr-comment' },
    { pr: 876, receipt: 'github-pr-comment' },
  ]);
  assert.match(posts[0].body.body, new RegExp(`dev-delivery-receipt:${merge874}`));
  assert.match(posts[1].body.body, new RegExp(`dev-delivery-receipt:${merge876}`));
  assert.match(posts[0].body.body, /DEV反映完了/);
});

test('an existing merge-SHA receipt keeps retry and recovery runs idempotent', async () => {
  const target = pr(874, merge874, '2026-09-18T03:12:32Z');
  let posts = 0;
  const request = async (url, init = {}) => {
    if ((init.method || 'GET') === 'GET' && url.includes('/comments?')) return response([
      { body: `<!-- dev-delivery-receipt:${merge874} -->\n@charukun\nDEV反映完了` },
    ]);
    if (init.method === 'POST') { posts++; return response({ id: 1 }, 201); }
    throw new Error(`Unexpected request: ${init.method || 'GET'} ${url}`);
  };
  const [result] = await recordGithubDeliveryReceipts({ token: 'token', repository: repo, sha: current, prs: [target], request });
  assert.deepEqual(result, { pr: 874, receipt: 'existing' });
  assert.equal(posts, 0);
});

test('fallback DEV email thread title identifies the deployed change before the comment is posted', async () => {
  const target = pr(925, merge874, '2026-09-18T03:12:32Z');
  target.body = 'モーション確認の代替再生を修正\n互換性のない候補を飛ばして再生を継続する。';
  const patched = [], posted = [];
  const request = async (url, init = {}) => {
    const method = init.method || 'GET';
    if (method === 'GET' && url.includes('/comments?')) return response([]);
    if (method === 'POST' && url.endsWith('/issues/925/comments')) return response({ message: 'forbidden' }, 403);
    if (method === 'PATCH' && url.endsWith('/issues/1009')) {
      patched.push(JSON.parse(init.body));
      return response({ number: 1009 }, 200);
    }
    if (method === 'POST' && url.endsWith('/issues/1009/comments')) {
      posted.push(JSON.parse(init.body));
      return response({ id: 1 }, 201);
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  };
  const message = 'DEV反映完了【百年転生 / モーション確認】\n反映内容: モーション確認の代替再生を修正';
  const receipt = await recordGithubDeliveryReceipt({ token: 'token', repository: repo, sha: current, message, pr: target, request });
  assert.equal(receipt, 'github-dev-email-thread-comment');
  assert.equal(patched.length, 1);
  assert.match(patched[0].title, /^DEV反映完了【百年転生 \/ モーション確認】 \| PR #925 モーション確認の代替再生を修正$/);
  assert.equal(posted.length, 1);
});

test('DEV email health is observable without claiming SMTP delivery', () => {
  assert.deepEqual(developmentEmailStatus('success'), { state: 'success', description: 'GitHub PR DEV receipt created or already present' });
  assert.equal(developmentEmailStatus('skipped').state, 'success');
  assert.equal(developmentEmailStatus('failure').state, 'failure');
});
