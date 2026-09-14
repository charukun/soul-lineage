import { createHash } from 'node:crypto';

const PATTERNS = [
  ['browser-selector-strict', /strict mode violation|locator\(.+\).*resolved to|strict.*locator/i, ['Open the exact UI state before asserting', 'Narrow the selector to the intended direct child or stable role', 'Keep the original browser assertion intent']],
  ['baseline-advanced', /DEVELOP_ADVANCED|baseline advanced|develop advanced|latest develop advanced/i, ['Refresh latest develop without spending semantic repair budget', 'Re-run only evidence invalidated by the new base', 'Never force-push the repaired head']],
  ['retained-asset-transient', /retained asset|HTTP 503|HTTP 502|HTTP 504|transient.*asset/i, ['Retry only transient 429/5xx/timeout failures with a finite bound', 'Keep hash and size verification fail-closed', 'Do not reinterpret permanent 4xx as transient']],
  ['git-tree-422', /git\/trees.*422|TREE_STAGING|GIT_TREE.*422/i, ['Re-read exact blobs/tree and restage from immutable evidence', 'Do not force-update the branch', 'Preserve the validated tree and parent SHAs']],
  ['stale-head', /HEAD_CHANGED|stale head|PR_CONTRACT_CHANGED/i, ['Re-read the live PR/head and governing contract', 'Discard stale evidence instead of carrying it to the new head', 'Observation churn must not consume semantic repair attempts']],
  ['dependency-wait', /DEPENDENCY_NOT_MERGED|dependency.*not merged|DEPENDENCY_WAIT/i, ['Re-evaluate after the dependency lands', 'Use stack-native evidence only when the parent exact head is an ancestor', 'Do not merge around Depends-On']],
  ['browser-gate', /browser smoke|browser verification|playwright|pageerror|webgl/i, ['Inspect the focused browser artifact and failing assertion', 'Repair the smallest UI/runtime cause', 'Never delete or weaken the assertion to pass']],
  ['validation-gate', /VALIDATION_FAILED|CI_GATE_FAILED|validate\.mjs|test failed|build failed/i, ['Run the focused failing gate first', 'Preserve successful exact-head evidence from unrelated gates', 'Return to normal fast validation after the minimal repair']],
  ['api-throttle', /HTTP 429|secondary rate limit|rate.?limit|API_BUDGET/i, ['Back off and preserve API reserve', 'Coalesce duplicate wakeups', 'Do not convert transport pressure into a product failure']],
];

function normalized(reason = '') {
  return String(reason)
    .replace(/[0-9a-f]{40}/ig, ':sha')
    .replace(/https?:\/\/\S+/g, ':url')
    .replace(/\b\d{3,}\b/g, ':n')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

export function failureFingerprint(reason = '') {
  const text = normalized(reason);
  const match = PATTERNS.find(([, pattern]) => pattern.test(text));
  const kind = match?.[0] || 'other';
  const signature = createHash('sha256').update(`${kind}\n${text}`).digest('hex').slice(0, 16);
  return { id: `${kind}:${signature}`, kind, normalized: text, playbook: match?.[2] || ['Re-read exact-head evidence and the smallest failing gate', 'Prefer a minimal repair over bypassing safety', 'Escalate only if the current specification is genuinely undecidable'] };
}

export function failurePlaybook(reason = '') { return failureFingerprint(reason).playbook; }

export function refreshFailureKnowledge(state, now = Date.now(), { maxFingerprints = 64, maxSeen = 500 } = {}) {
  state.failureKnowledge ||= { fingerprints: {}, seen: {} };
  const knowledge = state.failureKnowledge;
  for (const record of Object.values(state.records || {})) {
    for (const failure of record.failures || []) {
      const seenId = `${record.pr}:${failure.at || ''}:${failure.reason || ''}`;
      if (knowledge.seen[seenId]) continue;
      const fingerprint = failureFingerprint(failure.reason);
      const entry = knowledge.fingerprints[fingerprint.id] ||= {
        id: fingerprint.id,
        kind: fingerprint.kind,
        normalized: fingerprint.normalized,
        playbook: fingerprint.playbook,
        count: 0,
        successfulRepairs: 0,
        firstSeenAt: failure.at || new Date(now).toISOString(),
        lastSeenAt: failure.at || new Date(now).toISOString(),
        examples: [],
      };
      entry.count++;
      entry.lastSeenAt = failure.at || new Date(now).toISOString();
      entry.examples = [...entry.examples, { pr: record.pr, reason: String(failure.reason || '').slice(0, 240), at: failure.at || null }].slice(-4);
      knowledge.seen[seenId] = failure.at || new Date(now).toISOString();
      record.lastFailureFingerprint = fingerprint.id;
    }
    if (record.returnedAt && record.lastFailureFingerprint && !record.failureKnowledgeSuccessRecordedAt) {
      const entry = knowledge.fingerprints[record.lastFailureFingerprint];
      if (entry) entry.successfulRepairs++;
      record.failureKnowledgeSuccessRecordedAt = new Date(now).toISOString();
    }
  }

  const ordered = Object.values(knowledge.fingerprints)
    .sort((a, b) => Date.parse(b.lastSeenAt || 0) - Date.parse(a.lastSeenAt || 0))
    .slice(0, maxFingerprints);
  knowledge.fingerprints = Object.fromEntries(ordered.map(entry => [entry.id, entry]));
  const seen = Object.entries(knowledge.seen)
    .sort((a, b) => Date.parse(b[1] || 0) - Date.parse(a[1] || 0))
    .slice(0, maxSeen);
  knowledge.seen = Object.fromEntries(seen);
  knowledge.updatedAt = new Date(now).toISOString();
  return knowledge;
}

export function bestKnownPlaybook(state, reason = '') {
  const current = failureFingerprint(reason);
  const candidates = Object.values(state?.failureKnowledge?.fingerprints || {})
    .filter(entry => entry.kind === current.kind)
    .sort((a, b) => (b.successfulRepairs || 0) - (a.successfulRepairs || 0) || (b.count || 0) - (a.count || 0));
  const learned = candidates[0];
  return {
    fingerprint: current,
    learned: learned ? { id: learned.id, count: learned.count, successfulRepairs: learned.successfulRepairs, playbook: learned.playbook } : null,
  };
}
