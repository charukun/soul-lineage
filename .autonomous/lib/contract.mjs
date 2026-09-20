import { readFileSync, existsSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';

export const REPOSITORY = 'charukun/soul-lineage';
export const GAMES = Object.freeze({ village: 'apps/village', kuumetsu: 'apps/demon' });
export const RECENT_LIMIT = 12;
export const MODES = Object.freeze(['hardening', 'evolution', 'polish']);
export const CONTEXTS = Object.freeze(['astra/fast-dev-contract', 'astra/focused-validation']);
const SHA = /^[0-9a-f]{40}$/;
const ID = /^[a-z0-9][a-z0-9-]{2,95}$/;
const fail = message => { throw new Error(`AUTONOMOUS: ${message}`); };
const need = (condition, message) => { if (!condition) fail(message); };
const text = value => typeof value === 'string' && value.trim().length > 0;
export const json = path => JSON.parse(readFileSync(path, 'utf8'));
export const git = (root, args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim();
export function gameId(game) { need(Object.hasOwn(GAMES, game), `unknown game: ${game}`); return game; }
export function safePath(path) {
  need(text(path) && !path.startsWith('/') && !path.includes('\\') && !path.split('/').some(p => p === '..' || p === '.' || p === ''), 'unsafe repository path');
  return path;
}
function noSelfScore(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    need(!/^(selfScore|funScore|immersionScore|qualityScore|subjectiveScore)$/i.test(key), 'self-rating is not evidence');
    noSelfScore(child);
  }
}
export function recordThemeKey(record) {
  return record?.schemaVersion === 2 ? (record.themeKey || record.problemKey) : record?.problemKey;
}
export function recordProblemKeys(record) {
  if (record?.schemaVersion === 2 && Array.isArray(record.rootCauses)) return record.rootCauses.map(row => row.key);
  return text(record?.problemKey) ? [record.problemKey] : [];
}
export function validateRecord(record) {
  need([1,2].includes(record?.schemaVersion) && ID.test(record.id || ''), 'record version/id');
  gameId(record.game);
  need(['infrastructure', 'gameplay', 'user-feedback'].includes(record.kind), 'record kind');
  need(text(record.observation?.summary), 'observation summary is required');
  if (record.schemaVersion === 1) need(text(record.problemKey), 'v1 named root cause is required');
  need(Array.isArray(record.observation.evidence) && record.observation.evidence.length > 0, 'observation needs evidence');
  for (const item of record.observation.evidence) {
    need(['source', 'test', 'simulation', 'user-feedback', 'git-tree'].includes(item.kind), 'unknown evidence kind');
    need(text(item.statement), 'evidence statement is required');
    if (item.kind === 'user-feedback') {
      need(text(item.verbatim) && text(item.reference) && Number.isFinite(Date.parse(item.receivedAt)), 'feedback must retain original words, source and date');
    } else {
      need(SHA.test(item.revision || ''), 'code evidence requires an exact revision');
      safePath(item.path);
      need(text(item.symbol), 'code evidence requires a symbol or scoped tree observation');
    }
  }
  need(text(record.hypothesis?.cause) && text(record.hypothesis.prediction) && text(record.hypothesis.falsifier), 'hypothesis must be falsifiable');
  need(Array.isArray(record.candidates) && record.candidates.length >= 2, 'compare at least two approaches');
  need(record.candidates.filter(candidate => candidate.selected === true).length === 1, 'select exactly one approach/root cause');
  for (const candidate of record.candidates) need(text(candidate.id) && text(candidate.reason), 'candidate needs id/reason');
  need(Array.isArray(record.implementation?.paths) && record.implementation.paths.length > 0 && text(record.implementation.summary), 'implementation scope required');
  record.implementation.paths.forEach(safePath);
  if (record.schemaVersion === 2) {
    need(MODES.includes(record.mode), 'v2 iteration mode required');
    const legacySingleProblem = text(record.problemKey) && !record.themeKey && !record.rootCauses;
    if (!legacySingleProblem) {
      need(text(record.themeKey), 'v2 themeKey required');
      need(Array.isArray(record.rootCauses) && record.rootCauses.length > 0, 'v2 rootCauses required');
      const keys=new Set();
      for (const cause of record.rootCauses) {
        need(text(cause?.key) && !keys.has(cause.key), 'root cause key must be unique');
        keys.add(cause.key);
        need(text(cause.summary) && text(cause.prediction) && text(cause.falsifier), 'root cause summary/prediction/falsifier required');
        need(Array.isArray(cause.paths) && cause.paths.length > 0, 'root cause paths required');
        cause.paths.forEach(safePath);
      }
    }
    if (record.kind === 'gameplay') {
      const staging = record.observation.staging;
      need(staging?.kind === 'immutable-staging' && SHA.test(staging.sourceSha || ''), 'gameplay v2 requires exact staging source SHA');
      need(text(staging.reference) && Number.isFinite(Date.parse(staging.observedAt)), 'gameplay v2 requires immutable staging reference/time');
      need(staging.conditions && typeof staging.conditions === 'object' && !Array.isArray(staging.conditions), 'gameplay v2 requires staging conditions');
      need(Array.isArray(staging.notVerified), 'gameplay v2 requires staging notVerified');
    }
    need(record.evidencePlan?.objective === 'reproducible-causality', 'v2 evidence objective must be reproducible-causality');
    need(Array.isArray(record.evidencePlan.focusedTests) && record.evidencePlan.focusedTests.length > 0, 'v2 focused validation plan required');
    record.evidencePlan.focusedTests.forEach(safePath);
    need(['required','optional','none'].includes(record.evidencePlan.stagingAfter), 'v2 stagingAfter policy required');
    if (['evolution','polish'].includes(record.mode) && record.kind === 'gameplay') need(record.evidencePlan.stagingAfter === 'required', 'evolution/polish require staging After');
    need(Array.isArray(record.evidencePlan.limitations) && record.evidencePlan.limitations.length > 0, 'v2 evidence limitations required');
    need(record.receipt?.repository === REPOSITORY, 'receipt repository mismatch');
    need(record.receipt.pullRequest === null || (Number.isSafeInteger(record.receipt.pullRequest) && record.receipt.pullRequest > 0), 'invalid receipt PR');
    need(record.receipt.marker === `autonomous-receipt:${record.game}:${record.id}`, 'receipt marker mismatch');
    noSelfScore(record); return true;
  }
  need(['pending', 'supported', 'refuted', 'inconclusive'].includes(record.comparison?.verdict), 'invalid verdict');
  need(record.comparison.objective === 'reproducible-causality', 'subjective quality is not an objective');
  need(Array.isArray(record.comparison.limitations) && record.comparison.limitations.length > 0, 'record evidence limits');
  if (record.comparison.verdict !== 'pending') {
    for (const side of ['before', 'after']) {
      const evidence = record.comparison[side];
      need(evidence && SHA.test(evidence.revision || '') && text(evidence.reference) && text(evidence.summary), 'a verdict requires revision-bound before/after evidence');
    }
    need(text(record.comparison.explanation), 'a verdict needs an explanation, not just passing tests');
  }
  need(Array.isArray(record.validation?.focusedTests) && record.validation.focusedTests.length > 0, 'focused validation plan required');
  record.validation.focusedTests.forEach(safePath);
  need(record.validation.receipt?.repository === REPOSITORY, 'receipt repository mismatch');
  need(record.validation.receipt.pullRequest === null || (Number.isSafeInteger(record.validation.receipt.pullRequest) && record.validation.receipt.pullRequest > 0), 'invalid receipt PR');
  need(record.validation.receipt.marker === `autonomous-receipt:${record.game}:${record.id}`, 'receipt marker mismatch');
  need(record.validation.state === 'awaiting-exact-head-receipt', 'final validation lives outside the commit it validates');
  need(text(record.learning?.summary), 'retain learning including negative results');
  for (const key of ['failedApproaches', 'doNotRetry', 'unresolved', 'next']) need(Array.isArray(record.learning[key]), `learning.${key} is required`);
  for (const rule of record.learning.doNotRetry) need(text(rule.approach) && text(rule.reason) && text(rule.reconsiderWhen), 'doNotRetry needs approach/reason/reconsiderWhen');
  noSelfScore(record); return true;
}
export function validateReceipt(receipt) {
  need(receipt?.schemaVersion === 2 && ID.test(receipt.experimentId || ''), 'receipt version/experiment');
  gameId(receipt.game);
  need(receipt.repository === REPOSITORY && Number.isSafeInteger(receipt.pullRequest) && receipt.pullRequest > 0, 'receipt repository/PR');
  need(receipt.marker === `autonomous-receipt:${receipt.game}:${receipt.experimentId}`, 'receipt marker mismatch');
  need(SHA.test(receipt.validatedHead || '') && SHA.test(receipt.validationBase || ''), 'receipt exact validation SHA required');
  need(Number.isSafeInteger(receipt.run?.id) && receipt.run.id > 0 && text(receipt.run.url) && receipt.run.conclusion === 'success', 'receipt hosted run required');
  need(['supported','refuted','inconclusive'].includes(receipt.verdict), 'receipt verdict required');
  need(text(receipt.learning?.summary), 'receipt learning required');
  for (const key of ['failedApproaches','doNotRetry','unresolved','next']) need(Array.isArray(receipt.learning[key]), `receipt learning.${key} required`);
  need(receipt.merge?.state === 'merged' && SHA.test(receipt.merge.sha || ''), 'receipt merged SHA required');
  need(Array.isArray(receipt.notVerified), 'receipt notVerified required');
  if (receipt.staging) for (const side of ['before','after']) {
    const observation=receipt.staging[side]; if (observation == null) continue;
    need(observation.kind === 'immutable-staging' && SHA.test(observation.sourceSha || '') && text(observation.reference), 'invalid receipt staging observation');
    need(Number.isFinite(Date.parse(observation.observedAt)) && observation.conditions && typeof observation.conditions === 'object', 'receipt staging conditions/time required');
  }
  noSelfScore(receipt); return true;
}
export function loadContext(root, game) {
  gameId(game);
  const base = resolve(root, '.autonomous', game), index = json(resolve(base, 'experiment-history.json'));
  need(index.schemaVersion === 1 && index.game === game && Array.isArray(index.recent) && index.recent.length <= RECENT_LIMIT, 'invalid bounded history index');
  need(index.archive?.path === 'archive/index.json' && Number.isSafeInteger(index.archive.count) && index.archive.count >= 0, 'invalid archive pointer');
  const ids = new Set();
  for (const entry of index.recent) {
    need(ID.test(entry.id || '') && entry.path === `experiments/${entry.id}.json` && !ids.has(entry.id), 'invalid or duplicate history entry');
    ids.add(entry.id);
    const record = json(resolve(base, entry.path)); validateRecord(record);
    need(record.game === game && record.id === entry.id, 'index/record mismatch');
    if (record.schemaVersion === 1 || entry.problemKey) need(record.problemKey === entry.problemKey, 'legacy problem index mismatch');
    else need(recordThemeKey(record) === entry.themeKey, 'theme index mismatch');
  }
  for (const file of ['charter.md', 'protected-rules.md', 'observations.md', 'hypotheses.md']) need(existsSync(resolve(base, file)), `missing ${game}/${file}`);
  return { game, app: GAMES[game], readFirst: ['AGENTS.md', '.autonomous/README.md', '.autonomous/protected-rules.md', ...['charter.md', 'protected-rules.md', 'observations.md', 'hypotheses.md', 'experiment-history.json'].map(p => `.autonomous/${game}/${p}`)], ...index,
    receiptRule: 'Resolve pending records through their PR receipt marker and live GitHub status; never infer merged from this index.' };
}
export function receiptPath(game,id) { gameId(game); need(ID.test(id || ''), 'receipt id'); return `.autonomous/${game}/receipts/${id}.json`; }
export function persistedReceipt(root, game, id) {
  const path=resolve(root, receiptPath(game,id));
  if (!existsSync(path)) return null;
  const receipt=json(path); validateReceipt(receipt);
  need(receipt.game === game && receipt.experimentId === id, 'receipt identity mismatch');
  return receipt;
}
function learningFor(root, game, entry, record) {
  const receipt=persistedReceipt(root, game, entry.id);
  if (receipt) return receipt.learning;
  return record.schemaVersion === 1 ? record.learning : {summary:'Awaiting external receipt',failedApproaches:[],doNotRetry:[],unresolved:[],next:[]};
}
function atomicJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(value, null, 2) + '\n'); renameSync(temp, path);
}
export function appendRecord(root, record) {
  validateRecord(record);
  checkPriorLearning(root, record);
  const game = record.game, context = loadContext(root, game), base = resolve(root, '.autonomous', game);
  const archive = json(resolve(base, context.archive.path));
  need(Array.isArray(archive.entries), 'invalid archive index');
  need(![...context.recent, ...archive.entries].some(row => row.id === record.id), 'experiment IDs are immutable; use a new ID');
  const path = `experiments/${record.id}.json`, full = resolve(base, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
  const index = json(resolve(base, 'experiment-history.json'));
  index.recent.push(record.schemaVersion === 1
    ? { id: record.id, problemKey: record.problemKey, path, verdict: record.comparison.verdict }
    : record.themeKey
      ? { id: record.id, themeKey: record.themeKey, problemKeys: recordProblemKeys(record), path, schemaVersion: 2 }
      : { id: record.id, problemKey: record.problemKey, path, schemaVersion: 2 });
  while (index.recent.length > RECENT_LIMIT) archive.entries.push(index.recent.shift());
  index.archive.count = archive.entries.length;
  atomicJson(resolve(base, index.archive.path), archive);
  atomicJson(resolve(base, 'experiment-history.json'), index);
  return { id: record.id, path, recent: index.recent.length, archived: archive.entries.length };
}
// Scan compact metadata first; load only experiments matching the selected root cause.
export function historyForProblem(root, game, problemKey) {
  const context = loadContext(root, game), base = resolve(root, '.autonomous', game);
  const archived = json(resolve(base, context.archive.path)).entries;
  need(Array.isArray(archived) && archived.length === context.archive.count, 'archive metadata mismatch');
  return [...context.recent, ...archived].filter(row => row.problemKey === problemKey || row.themeKey === problemKey || row.problemKeys?.includes(problemKey)).map(row => {
    need(row.path === `experiments/${row.id}.json` && ID.test(row.id), 'unsafe history reference');
    const record=json(resolve(base, row.path)); return { ...row, record, learning: learningFor(root, game, row, record), receipt: persistedReceipt(root, game, row.id) };
  });
}
export function appendReceipt(root, receipt) {
  validateReceipt(receipt);
  const context=loadContext(root, receipt.game), archived=json(resolve(root,'.autonomous',receipt.game,context.archive.path)).entries;
  const entry=[...context.recent, ...archived].find(row=>row.id===receipt.experimentId);
  need(entry, 'receipt experiment missing from history');
  const record=json(resolve(root,'.autonomous',receipt.game,entry.path)); validateRecord(record);
  need(record.schemaVersion === 2, 'persisted receipt files are for v2 experiments');
  const full=resolve(root, receiptPath(receipt.game,receipt.experimentId));
  mkdirSync(dirname(full),{recursive:true}); writeFileSync(full,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
  return {experimentId:receipt.experimentId,path:receiptPath(receipt.game,receipt.experimentId)};
}
export function checkPriorLearning(root, record) {
  const selected = record.candidates.find(c => c.selected)?.id;
  const keys=[...new Set([recordThemeKey(record), ...recordProblemKeys(record)].filter(Boolean))];
  const previousRows=new Map();
  for (const key of keys) for (const previous of historyForProblem(root, record.game, key)) previousRows.set(previous.id,previous);
  for (const previous of previousRows.values()) {
    if (previous.id === record.id) continue;
    for (const rule of previous.learning.doNotRetry) {
      if (rule.approach !== selected) continue;
      const retry = record.retryJustification;
      need(retry?.previousId === previous.id && text(retry.changedEvidence) &&
        record.observation.evidence.some(e => e.statement === retry.changedEvidence),
        `rejected approach ${selected}: ${previous.id}; new explicit evidence is required`);
    }
  }
  return true;
}
// Read-only guard. Never edits a ref, suppresses a test or authorizes a gate change.
export function checkHistoryChanges(root, baseRef, headRef = 'HEAD') {
  const base = git(root, ['rev-parse', '--verify', `${baseRef}^{commit}`]);
  const head = git(root, ['rev-parse', '--verify', `${headRef}^{commit}`]);
  const rows = git(root, ['diff', '--name-status', '--no-renames', base, head]).split('\n').filter(Boolean);
  for (const row of rows) {
    const [status, path] = row.split('\t');
    if (/^\.autonomous\/(village|kuumetsu)\/experiments\/.+\.json$/.test(path)) need(status === 'A', 'past experiments cannot be edited/deleted; append a correction');
    if (/^\.autonomous\/(village|kuumetsu)\/receipts\/.+\.json$/.test(path)) need(status === 'A', 'past receipts cannot be edited/deleted');
    if (status === 'D' && /(?:\.test\.mjs|\/tests\/)/.test(path)) fail(`test deletion is protected: ${path}`);
  }
  for (const game of Object.keys(GAMES)) {
    const prefix = `.autonomous/${game}/`;
    const readAt = (sha, path, fallback) => {
      if (!git(root, ['ls-tree', '--name-only', sha, '--', path])) return fallback;
      return JSON.parse(git(root, ['show', `${sha}:${path}`]));
    };
    const entriesAt = sha => {
      const index = readAt(sha, prefix + 'experiment-history.json', { recent: [], archive: { count: 0 } });
      const archived = readAt(sha, prefix + 'archive/index.json', { entries: [] }).entries;
      need(archived.length === index.archive.count, 'archive count mismatch');
      const all = [...index.recent, ...archived];
      need(new Set(all.map(r => r.id)).size === all.length, 'duplicate history identity');
      return all;
    };
    const before = entriesAt(base), after = entriesAt(head);
    for (const entry of before) need(after.some(row => JSON.stringify(row) === JSON.stringify(entry)), 'history index entry changed/disappeared');
    for (const entry of after) {
      need(ID.test(entry.id || '') && entry.path === `experiments/${entry.id}.json`, 'unsafe historical pointer');
      const record = readAt(head, prefix + entry.path, null);
      validateRecord(record);
      need(record.id === entry.id && record.game === game, 'historical pointer mismatch');
      if (record.schemaVersion === 1) {
        need(record.problemKey === entry.problemKey && record.comparison.verdict === entry.verdict, 'v1 historical pointer mismatch');
      } else {
        need(entry.schemaVersion === 2 && !Object.hasOwn(entry,'verdict'), 'v2 history must derive outcome from receipt');
        if (entry.themeKey) {
          need(recordThemeKey(record) === entry.themeKey, 'v2 theme pointer mismatch');
          need(JSON.stringify(recordProblemKeys(record)) === JSON.stringify(entry.problemKeys), 'v2 root cause pointer mismatch');
        } else need(record.problemKey === entry.problemKey, 'legacy v2 problem pointer mismatch');
      }
    }
  }
  return true;
}
export function evaluateMergeGate(snapshot, { now = Date.now() } = {}) {
  const errors = [], reject = (ok, code) => { if (!ok) errors.push(code); };
  const { expected = {}, pr = {}, develop = {}, comparison = {}, run = {}, statusResponse = {}, reviews, blockingDependencies } = snapshot || {};
  const statuses = statusResponse.statuses || [];
  const head = expected.headSha, base = expected.developSha;
  reject(SHA.test(head || '') && SHA.test(base || ''), 'EXACT_SHA_REQUIRED');
  const age = now - Date.parse(snapshot?.fetchedAt);
  reject(Number.isFinite(age) && age >= 0 && age <= 120000, 'LIVE_FRESHNESS_SNAPSHOT_REQUIRED');
  reject(statusResponse.sha === head, 'STATUS_HEAD_MISMATCH');
  reject(Array.isArray(blockingDependencies) && blockingDependencies.length === 0, 'BLOCKING_DEPENDENCY');
  reject(Array.isArray(reviews), 'REVIEW_READ_REQUIRED');
  const latestReviews = new Map();
  for (const review of (reviews || [])) if (review.state !== 'COMMENTED') latestReviews.set(review.user?.login, review.state);
  reject(![...latestReviews.values()].includes('CHANGES_REQUESTED'), 'BLOCKING_REVIEW');
  reject(pr.state === 'open' && pr.base?.ref === 'develop' && pr.head?.repo?.full_name === REPOSITORY, 'PR_SCOPE_CHANGED');
  reject(pr.head?.sha === head, 'HEAD_MOVED');
  reject(develop.commit?.sha === base, 'DEVELOP_MOVED');
  reject(comparison.merge_base_commit?.sha === base && comparison.behind_by === 0, 'RECONCILE_REQUIRED');
  reject(pr.mergeable === true, 'MERGEABILITY_NOT_CONFIRMED');
  reject(!(pr.labels || []).some(l => /(^|[\s:/_-])(hold|blocked|manual-merge|do-not-merge)($|[\s:/_-])/i.test(l.name || '')), 'EXPLICIT_HOLD');
  reject(!/^\s*(?:hold|do not merge|manual merge only|blocked by)\b/im.test(pr.body || ''), 'BODY_HOLD');
  reject(run.head_sha === head && run.status === 'completed' && run.conclusion === 'success' && run.event === 'push' &&
    run.path === '.github/workflows/astra-work-validation.yml' && Number.isSafeInteger(run.id) && run.id > 0 &&
    run.head_commit?.message?.includes('[astra-validate]'), 'HOSTED_EXACT_HEAD_RUN_REQUIRED');
  for (const context of CONTEXTS) {
    const candidates = statuses.filter(s => s.context === context).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    const current = candidates[0];
    reject(Number.isFinite(Date.parse(current?.created_at)) && current?.state === 'success' && current.target_url === `https://github.com/${REPOSITORY}/actions/runs/${run.id}`, `STATUS_REQUIRED:${context}`);
  }
  return { eligible: errors.length === 0, errors, headSha: head, developSha: base, next: errors.length ? 'REPAIR_SAME_BRANCH' : 'READY_THEN_EXPECTED_HEAD_MERGE', terminal: 'MERGED_TO_DEVELOP' };
}
