export const STALE_DRAFT_MS = 12 * 60 * 60 * 1000;

const TARGET_RULES = [
  { id: 'portal', label: '公開リンク集', test: path => path.startsWith('portal/') || path === 'wrangler.portal.jsonc' || path === 'docs/PUBLIC_PORTAL.md' || path === '.github/workflows/portal.yml' || /^tests\/portal/.test(path) },
  { id: 'master-character', label: 'MasterCharacter', test: path => /apps\/rinne\/public\/simulator\//.test(path) || /MASTER_CHARACTER/i.test(path) || path.startsWith('packages/characters/') || /master-character/i.test(path) },
  { id: 'character-review', label: 'キャラレビュー', test: path => /apps\/rinne\/(characters(?:-advanced)?\.html|src\/character-review)/.test(path) },
  { id: 'village-rehearsal', label: '村連携リハーサル', test: path => /apps\/rinne\/village-rehearsal\.html/.test(path) || /apps\/rinne\/src\/village-/.test(path) },
  { id: 'audio', label: '音楽 / BGM', test: path => path.startsWith('packages/audio/') || path === 'packages/shared-ui/src/music.js' || /\b(bgm|music|audio)\b/i.test(path) },
  { id: 'tidebreak', label: 'Tidebreak / Lanternfell', test: path => path.startsWith('packages/tidebreak-combat/') || path.startsWith('packages/night-assets/') || /tidebreak|lanternfell/i.test(path) },
  { id: 'rinne', label: '輪廻転焦', test: path => path.startsWith('apps/rinne/') },
  { id: 'village', label: '村づくり', test: path => path.startsWith('apps/village/') },
  { id: 'demon', label: '魔物側', test: path => path.startsWith('apps/demon/') },
  { id: 'visual-review', label: 'Visual Review Lab', test: path => /visual[-_]review/i.test(path) },
  { id: 'ops-board', label: '開発状況ボード', test: path => path.startsWith('ops-board/') || path === 'wrangler.ops.jsonc' || path === 'docs/OPS_BOARD.md' || /^tests\/ops-/.test(path) || path === '.github/workflows/ops-board.yml' },
  { id: 'shared', label: '共通基盤', test: path => /^(packages|assets|templates)\//.test(path) },
  { id: 'devops', label: '開発基盤', test: path => /^(\.github|scripts|tests|docs)\//.test(path) },
];
export function targetAppsFromFiles(files = []) {
  const found = new Map();
  for (const raw of files) { const match = TARGET_RULES.find(rule => rule.test(String(raw || ''))); if (match) found.set(match.id, { id: match.id, label: match.label }); }
  if (!found.size && files.length) found.set('repository', { id: 'repository', label: 'Repository共通' });
  return [...found.values()];
}
export function bodyLines(body = '') {
  const lines = String(body).replace(/\r/g, '').split('\n');
  return { title: (lines[0] || '').trim(), detail: (lines[1] || '').trim() };
}
const structural = line => !line || /^(?:#{1,6}\s|[-*+]\s|\d+\.\s|```|~~~|<|\|)|^(?:[-=_*]){3,}$/.test(line) || /^(summary|overview|changes|request|概要|変更内容|変更概要)[:：]?$/i.test(line);
export function pullCopy(pr) {
  const copy = bodyLines(pr?.body || '');
  if (!structural(copy.title) && !structural(copy.detail)) return copy;
  const clean = String(pr?.body || '').replace(/<!--[\s\S]*?-->/g, '').replace(/```[\s\S]*?```/g, '');
  const detail = clean.split(/\r?\n/).map(line => line.trim()).filter(line => line && !/^#{1,6}\s|^<|^\|/.test(line))
    .map(line => line.replace(/^(?:[-*+]\s+(?:\[[ xX]\]\s*)?|\d+\.\s+)/, '').replace(/\*\*|__/g, '').trim())
    .find(line => !structural(line) && line !== pr?.title);
  return { title: pr?.title || `PR #${pr?.number}`, detail: detail?.slice(0, 360) || '詳細未記載' };
}
export function githubPullState(pr) {
  if (pr?.merged_at) return 'Merged';
  if (pr?.state === 'closed') return 'Closed';
  return pr?.draft ? 'Draft' : 'Ready';
}
export function isVisualReviewPull(pr) {
  return pr?.head?.ref === 'work/visual-review-lab-v2' && (!pr.head.repo?.full_name || pr.head.repo.full_name === 'charukun/soul-lineage');
}
export function compactPull(pr, now = Date.now()) {
  const copy = pullCopy(pr);
  const state = githubPullState(pr);
  const updatedAt = pr?.updated_at || pr?.created_at || null;
  const visualReview = isVisualReviewPull(pr);
  return {
    number: pr.number, title: copy.title, detail: copy.detail, state, updatedAt, url: pr.html_url,
    head: pr?.head?.ref || null, headSha: pr?.head?.sha || null, baseSha: pr?.base?.sha || null,
    visualReview, staleDraft: !visualReview && state === 'Draft' && Boolean(updatedAt) && now - Date.parse(updatedAt) >= STALE_DRAFT_MS,
    targets: Array.isArray(pr?.targetApps) ? pr.targetApps : [], targetsComplete: pr?.targetAppsComplete === true,
    targetsStatus: pr?.targetAppsStatus || 'pending', targetsUpdatedAt: pr?.targetAppsUpdatedAt || null,
  };
}
export function sortPulls(items = []) {
  const priority = { Draft: 0, Ready: 1, Merged: 2, Closed: 3 };
  return [...items].sort((a, b) => (priority[a.state] ?? 9) - (priority[b.state] ?? 9) || (Date.parse(b.updatedAt || 0) || 0) - (Date.parse(a.updatedAt || 0) || 0) || b.number - a.number);
}
export function splitPulls(pulls = [], now = Date.now()) {
  const items = sortPulls(pulls.map(pr => compactPull(pr, now)));
  return { normal: items.filter(item => !item.visualReview), visualReview: items.filter(item => item.visualReview) };
}
