const API = 'https://api.github.com/repos/charukun/soul-lineage';
const CHUNK_SIZE = 16000;
const REQUEST_CAP = 32;
const LOW_REMAINING = 250;
const RATE_HEADER_NAMES = [
  'link', 'x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-used',
  'x-ratelimit-resource', 'x-ratelimit-reset', 'retry-after',
];

const finiteNumber = value => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
const iso = value => Number.isFinite(value) && value > 0 ? new Date(value).toISOString() : null;
const header = (headers, name) => headers?.get?.(name) ?? null;
const rateMetadata = (headers, scope, status = null) => {
  const resetSeconds = finiteNumber(header(headers, 'x-ratelimit-reset'));
  return {
    status,
    scope,
    limit: finiteNumber(header(headers, 'x-ratelimit-limit')),
    remaining: finiteNumber(header(headers, 'x-ratelimit-remaining')),
    used: finiteNumber(header(headers, 'x-ratelimit-used')),
    resource: header(headers, 'x-ratelimit-resource') || null,
    resetAt: resetSeconds === null ? null : iso(resetSeconds * 1000),
    retryAfter: header(headers, 'retry-after')?.slice(0, 64) || null,
  };
};
function retryAfterAt(value, now) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return now + seconds * 1000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? date : null;
}

export function classifyGithubFailure({ status, headers = new Headers(), message = '', scope = 'authenticated', now = Date.now() } = {}) {
  const rate = rateMetadata(headers, scope, status);
  const text = String(message || '').slice(0, 500);
  const retryAtFromHeader = retryAfterAt(rate.retryAfter, now);
  const resetAt = Date.parse(rate.resetAt || '');
  const secondary = status === 429 || Boolean(rate.retryAfter) || /secondary rate limit|abuse detection|abuse-rate|temporarily blocked.*abuse/i.test(text);
  const primary = !secondary && status === 403 && (rate.remaining === 0 || /api rate limit exceeded|rate limit exceeded for/i.test(text));
  const kind = secondary ? 'secondary' : primary ? 'primary' : status === 403 ? 'permission' : 'http';
  let retryAt = null;
  if (kind === 'primary') retryAt = Math.max(now + 60_000, Number.isFinite(resetAt) ? resetAt : 0);
  if (kind === 'secondary') retryAt = Math.max(now + 60_000, retryAtFromHeader || 0);
  return { kind, ...rate, retryAt: iso(retryAt), message: text || null, retryAtMs: retryAt };
}

function failureMessage(diagnostic) {
  if (diagnostic.kind === 'primary') return 'GitHub primary rate limitに到達しました。resetまで再取得を待ちます。';
  if (diagnostic.kind === 'secondary') return 'GitHub secondary rate limitにより再取得を待ちます。';
  if (diagnostic.kind === 'permission') return 'GitHub APIへのアクセスが拒否されました（HTTP 403）。利用制限としては扱いません。';
  return `GitHub API取得失敗（HTTP ${diagnostic.status}）`;
}

// Durable Object values have a per-value size limit. Store snapshots atomically in small chunks.
export async function readStored(storage, key) {
  if (!storage) return null;
  const read = async tx => {
    const meta = await tx.get(`${key}:meta`);
    if (!meta) return null;
    const parts = [];
    for (let i = 0; i < meta.parts; i++) { const value = await tx.get(`${key}:${i}`); if (typeof value !== 'string') return null; parts.push(value); }
    return JSON.parse(parts.join(''));
  };
  return storage.transaction ? storage.transaction(read) : read(storage);
}
export async function writeStored(storage, key, value) {
  if (!storage) return;
  const text = JSON.stringify(value);
  const parts = Math.ceil(text.length / CHUNK_SIZE);
  const write = async tx => {
    const previous = await tx.get(`${key}:meta`);
    const values = { [`${key}:meta`]: { parts } };
    for (let i = 0; i < parts; i++) values[`${key}:${i}`] = text.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    await tx.put(values);
    for (let i = parts; i < (previous?.parts || 0); i++) await tx.delete(`${key}:${i}`);
  };
  await (storage.transaction ? storage.transaction(write) : write(storage));
}

export function createGithubClient({ storage, token = '', fetchImpl = fetch, now = Date.now, maxRequests = null } = {}) {
  const credential = typeof token === 'string' ? token.trim() : '';
  let requests = 0;
  let cacheHits = 0;
  let remaining = null;
  let nextAllowedAt = null;
  let lastRate = null;
  let lastFailure = null;
  const touched = new Set();
  const scope = credential ? 'authenticated' : 'auth-required';
  const requestCap = credential ? (Number.isFinite(maxRequests) ? maxRequests : REQUEST_CAP) : 0;
  const cachedResult = (cached, headers = cached?.headers || {}) => ({ data: cached.data, response: { headers: new Headers(headers) }, cached: true });
  async function get(path, { immutable = false, maxAgeMs = 0 } = {}) {
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('://')) throw new Error('Invalid GitHub repository path');
    if (!credential) {
      lastFailure = { kind: 'auth-required', status: null, scope: 'none', requests, maxRequests: 0, remaining: null };
      throw Object.assign(new Error('GitHub認証tokenが必要です。未認証APIへは接続しません。'), {
        authRequired: true, githubDiagnostic: lastFailure,
      });
    }
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(path));
    const key = 'ops-http:' + [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
    touched.add(key);
    const cached = await readStored(storage, key);
    const age = cached?.savedAt ? now() - cached.savedAt : Number.POSITIVE_INFINITY;
    if (cached && (immutable || (maxAgeMs > 0 && age >= 0 && age < maxAgeMs))) {
      cacheHits++;
      return cachedResult(cached);
    }
    const backoffKey = 'ops-backoff:authenticated';
    const rawBackoff = await storage?.get(backoffKey);
    if (typeof rawBackoff === 'number') {
      // Legacy backoff did not record why a 403 happened and could contain a permission error.
      // Drop it once after this classifier is deployed; a real limit will immediately recreate typed backoff.
      await storage?.delete?.(backoffKey);
    } else {
      const backoffAt = finiteNumber(rawBackoff?.retryAt);
      if (backoffAt !== null && backoffAt > now()) {
        nextAllowedAt = backoffAt;
        lastFailure = rawBackoff.diagnostic || { kind: 'primary', scope, retryAt: iso(backoffAt) };
        throw Object.assign(new Error('GitHubの利用制限による再取得待ち'), {
          retryAt: backoffAt, rateLimited: true, githubDiagnostic: lastFailure,
        });
      }
      if (rawBackoff) await storage?.delete?.(backoffKey);
    }
    if (requests >= requestCap) {
      lastFailure = { kind: 'internal-budget', status: null, scope, requests, maxRequests: requestCap, remaining };
      throw Object.assign(new Error('PULSE内部のGitHub取得予算に達しました。次回同期で継続します。'), {
        budgetLimited: true, githubDiagnostic: lastFailure,
      });
    }
    requests++;
    const headers = {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${credential}`,
      'user-agent': 'rinne-ops-board/2.3',
      'x-github-api-version': '2022-11-28',
    };
    if (cached?.etag) headers['if-none-match'] = cached.etag;
    const response = await fetchImpl(`${API}${path}`, { headers, signal: AbortSignal.timeout(15000) });
    lastRate = rateMetadata(response.headers, scope, response.status);
    remaining = lastRate.remaining;
    if ([403, 429].includes(response.status)) {
      let message = '';
      try {
        const text = (await response.text()).slice(0, 4096);
        try { message = JSON.parse(text)?.message || text; } catch { message = text; }
      } catch { /* headers are sufficient for classification */ }
      const diagnostic = classifyGithubFailure({ status: response.status, headers: response.headers, message, scope, now: now() });
      const retryAt = diagnostic.retryAtMs;
      delete diagnostic.retryAtMs;
      lastFailure = diagnostic;
      if (['primary', 'secondary'].includes(diagnostic.kind) && Number.isFinite(retryAt)) {
        nextAllowedAt = retryAt;
        await storage?.put(backoffKey, { retryAt, diagnostic });
      }
      throw Object.assign(new Error(failureMessage(diagnostic)), {
        ...(Number.isFinite(retryAt) ? { retryAt } : {}),
        rateLimited: ['primary', 'secondary'].includes(diagnostic.kind),
        githubDiagnostic: diagnostic,
      });
    }
    if (response.status === 304 && cached) {
      const mergedHeaders = { ...cached.headers, ...Object.fromEntries(response.headers) };
      await writeStored(storage, key, { ...cached, savedAt: now(), headers: mergedHeaders });
      cacheHits++;
      return cachedResult(cached, mergedHeaders);
    }
    if (!response.ok) {
      lastFailure = { kind: 'http', ...lastRate };
      throw Object.assign(new Error(`GitHub ${path.split('?')[0]}: HTTP ${response.status}`), { githubDiagnostic: lastFailure });
    }
    const data = await response.json();
    const savedHeaders = Object.fromEntries(RATE_HEADER_NAMES.filter(name => response.headers.has(name)).map(name => [name, response.headers.get(name)]));
    const serialized = JSON.stringify(data);
    if (serialized.length < 1600000) await writeStored(storage, key, { data, etag: response.headers.get('etag'), headers: savedHeaders, savedAt: now() });
    return { data, response, cached: false };
  }
  async function prune() {
    if (!storage) return;
    const old = await storage.get('ops-http-index') || [];
    const index = [...touched, ...old.filter(key => !touched.has(key))];
    for (const key of index.slice(96)) {
      const meta = await storage.get(`${key}:meta`);
      for (let i = 0; i < (meta?.parts || 0); i++) await storage.delete(`${key}:${i}`);
      await storage.delete(`${key}:meta`);
    }
    await storage.put('ops-http-index', index.slice(0, 96));
  }
  return {
    get, prune,
    get remaining() { return remaining; },
    get requests() { return requests; },
    get cacheHits() { return cacheHits; },
    get available() { return requestCap - requests; },
    get maxRequests() { return requestCap; },
    get retryAt() { return nextAllowedAt; },
    get scope() { return scope; },
    get rate() { return lastRate; },
    get failure() { return lastFailure; },
    get deepAllowed() { return Boolean(credential) && (remaining === null || remaining > LOW_REMAINING); },
  };
}
