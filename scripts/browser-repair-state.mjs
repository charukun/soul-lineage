export const MARKER_START = '<!-- browser-repair:v1';
export const MARKER_END = '-->';
export const DEFAULT_MAX_ATTEMPTS = 3;

export function currentPrRepair(pr, headSha) {
  return Boolean(pr && pr.state === 'open' && pr.base?.ref === 'develop' && pr.head?.sha === headSha);
}

export function parseRepairState(body = '') {
  const start = body.indexOf(MARKER_START);
  if (start < 0) return null;
  const end = body.indexOf(MARKER_END, start);
  if (end < 0) return null;
  const raw = body.slice(start + MARKER_START.length, end).trim();
  try { return JSON.parse(raw); } catch { return null; }
}

export function replaceRepairState(body = '', state) {
  const block = `${MARKER_START}\n${JSON.stringify(state)}\n${MARKER_END}`;
  const start = body.indexOf(MARKER_START);
  if (start < 0) return `${block}\n\n${body}`.trim();
  const end = body.indexOf(MARKER_END, start);
  if (end < 0) return `${block}\n\n${body}`.trim();
  return `${body.slice(0, start)}${block}${body.slice(end + MARKER_END.length)}`.trim();
}

export function linkedIssueNumber(body = '') {
  const match = body.match(/(?:Auto-Repair-Issue|Browser-Repair-Issue):\s*#(\d+)/i);
  return match ? Number(match[1]) : null;
}

export function workShouldStart(state) {
  return Boolean(state && state.state === 'pending' && Number(state.attempt || 0) < Number(state.maxAttempts || DEFAULT_MAX_ATTEMPTS));
}

export function claimForWork(state, worker = 'chatgpt-work') {
  if (!workShouldStart(state)) throw new Error('Repair ticket is not eligible for Work');
  return { ...state, state: 'working', attempt: Number(state.attempt || 0) + 1, claimedBy: worker, claimedAt: new Date().toISOString() };
}

export function onBrowserFailure(state, details = {}) {
  const attempt = Number(state?.attempt || 0);
  const maxAttempts = Number(state?.maxAttempts || DEFAULT_MAX_ATTEMPTS);
  return {
    ...state,
    ...details,
    attempt,
    maxAttempts,
    state: attempt >= maxAttempts ? 'human-required' : 'pending',
    lastFailureAt: new Date().toISOString(),
  };
}

export function onPrBrowserSuccess(state, details = {}) {
  if (!state) return null;
  return {
    ...state,
    ...details,
    state: state.scope === 'develop' ? 'ready-for-integration' : 'verified',
    lastPrVerificationAt: new Date().toISOString(),
  };
}

export function onDevelopBrowserSuccess(state, details = {}) {
  if (!state) return null;
  return { ...state, ...details, state: 'verified', verifiedAt: new Date().toISOString() };
}
