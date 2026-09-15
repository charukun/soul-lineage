import { readStored, writeStored } from './github-client.mjs';

const SNAPSHOT_KEY = 'ops-pulls-v1';
export const FULL_PULL_RECONCILE_MS = 2 * 60 * 60 * 1000;
const MAX_PAGES = 6;
const PAGE_SIZE = 100;
const updatedAt = pr => Date.parse(pr?.updated_at || pr?.created_at || 0) || 0;

function compact(pr) {
  return {
    number: pr.number,
    title: pr.title || '',
    body: pr.body || '',
    state: pr.state,
    draft: Boolean(pr.draft),
    merged_at: pr.merged_at || null,
    closed_at: pr.closed_at || null,
    created_at: pr.created_at || null,
    updated_at: pr.updated_at || pr.created_at || null,
    merge_commit_sha: pr.merge_commit_sha || null,
    html_url: pr.html_url,
    head: { ref: pr.head?.ref || null, sha: pr.head?.sha || null, repo: pr.head?.repo?.full_name ? { full_name: pr.head.repo.full_name } : null },
    base: { ref: pr.base?.ref || null, sha: pr.base?.sha || null },
  };
}
function watermark(pulls = []) {
  const newest = pulls.reduce((max, pr) => Math.max(max, updatedAt(pr)), 0);
  return newest ? new Date(newest).toISOString() : null;
}
function mergePulls(existing = [], updates = []) {
  const merged = new Map(existing.map(pr => [pr.number, pr]));
  for (const pr of updates) merged.set(pr.number, compact(pr));
  return [...merged.values()].sort((a, b) => updatedAt(b) - updatedAt(a) || b.number - a.number);
}
async function page(client, number) {
  return client.get(`/pulls?state=all&base=develop&sort=updated&direction=desc&per_page=${PAGE_SIZE}&page=${number}`, { maxAgeMs: 15_000 });
}

export async function syncPullSnapshot(client, storage, { now = Date.now(), forceFull = false } = {}) {
  const previous = await readStored(storage, SNAPSHOT_KEY);
  const previousWatermark = Date.parse(previous?.watermark || 0) || 0;
  const fullAge = now - (Date.parse(previous?.fullAt || 0) || 0);
  const full = forceFull || !previous?.complete || !Array.isArray(previous?.pulls) || fullAge >= FULL_PULL_RECONCILE_MS;
  const fetched = [];
  let pages = 0;
  let complete = full ? false : previous.complete === true;
  let reachedWatermark = full || !previousWatermark;

  for (let number = 1; number <= MAX_PAGES; number++) {
    const { data, response } = await page(client, number);
    if (!Array.isArray(data)) throw new Error('GitHub PR一覧の形式が不正です');
    pages++;
    fetched.push(...data);
    const hasNext = /rel="next"/.test(response.headers.get('link') || '');
    if (!full && previousWatermark && data.some(pr => updatedAt(pr) <= previousWatermark)) reachedWatermark = true;
    if (!hasNext) { complete = true; reachedWatermark = true; break; }
    if (!full && reachedWatermark) break;
  }

  if (!full && !reachedWatermark) complete = false;
  const pulls = full ? fetched.map(compact) : mergePulls(previous.pulls, fetched);
  const snapshot = {
    schema: 1,
    pulls,
    complete,
    watermark: watermark(pulls),
    fullAt: full && complete ? new Date(now).toISOString() : previous?.fullAt || null,
    syncedAt: new Date(now).toISOString(),
  };
  await writeStored(storage, SNAPSHOT_KEY, snapshot);
  return { pulls, complete, mode: full ? 'full' : 'incremental', pages, watermark: snapshot.watermark, fullAt: snapshot.fullAt };
}
