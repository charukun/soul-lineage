export const STALE_DRAFT_MS = 12 * 60 * 60 * 1000;

export function bodyLines(body = '') {
  const lines = String(body).replace(/\r/g, '').split('\n');
  return {
    title: (lines[0] || '').trim(),
    detail: (lines[1] || '').trim(),
  };
}

export function githubPullState(pr) {
  if (pr?.merged_at) return 'Merged';
  if (pr?.state === 'closed') return 'Closed';
  if (pr?.draft) return 'Draft';
  return 'Ready';
}

export function isVisualReviewPull(pr) {
  const text = [pr?.title, pr?.body, pr?.head?.ref].filter(Boolean).join('\n').toLowerCase();
  return text.includes('visual review') || text.includes('visual-review');
}

export function compactPull(pr, now = Date.now()) {
  const copy = bodyLines(pr?.body || '');
  const state = githubPullState(pr);
  const updatedAt = pr?.updated_at || pr?.created_at || null;
  const staleDraft = state === 'Draft' && updatedAt
    ? now - Date.parse(updatedAt) >= STALE_DRAFT_MS
    : false;
  return {
    number: pr.number,
    title: copy.title || pr.title || `PR #${pr.number}`,
    detail: copy.detail || '詳細未記載',
    state,
    updatedAt,
    url: pr.html_url,
    head: pr?.head?.ref || null,
    visualReview: isVisualReviewPull(pr),
    staleDraft,
  };
}

export function sortPulls(items = []) {
  const priority = { Draft: 0, Ready: 1, Merged: 2, Closed: 3 };
  return [...items].sort((a, b) => {
    const stage = (priority[a.state] ?? 9) - (priority[b.state] ?? 9);
    if (stage) return stage;
    return (Date.parse(b.updatedAt || 0) || 0) - (Date.parse(a.updatedAt || 0) || 0) || b.number - a.number;
  });
}

export function splitPulls(pulls = [], now = Date.now()) {
  const items = sortPulls(pulls.map(pr => compactPull(pr, now)));
  return {
    normal: items.filter(item => !item.visualReview),
    visualReview: items.filter(item => item.visualReview),
  };
}
