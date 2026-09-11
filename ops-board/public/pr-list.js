export const STALE_DRAFT_HOURS = 12;

export function firstTwoBodyLines(body = '') {
  const lines = String(body).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  return {
    title: lines[0] || '内容未記載',
    detail: lines[1] || '詳細未記載',
  };
}

export function githubState(pr) {
  if (pr.merged_at) return 'Merged';
  if (pr.state === 'closed') return 'Closed';
  if (pr.draft) return 'Draft';
  return 'Ready';
}

export function isVisualReview(pr) {
  const text = `${pr.title || ''}\n${pr.body || ''}\n${pr.head?.ref || ''}`.toLowerCase();
  return text.includes('visual review') || text.includes('visual-review');
}

export function isStaleDraft(pr, now = Date.now()) {
  if (!pr.draft || !pr.updated_at) return false;
  return now - Date.parse(pr.updated_at) >= STALE_DRAFT_HOURS * 60 * 60 * 1000;
}

export function compactPr(pr, now = Date.now()) {
  const copy = firstTwoBodyLines(pr.body);
  return {
    number: pr.number,
    title: copy.title,
    detail: copy.detail,
    state: githubState(pr),
    updatedAt: pr.updated_at,
    url: pr.html_url,
    visualReview: isVisualReview(pr),
    staleDraft: isStaleDraft(pr, now),
  };
}
