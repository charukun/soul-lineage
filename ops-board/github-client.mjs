const API = 'https://api.github.com/repos/charukun/soul-lineage';
const CHUNK_SIZE = 16000;
const REQUEST_CAP = { authenticated: 32, public: 18 };
const LOW_REMAINING = { authenticated: 250, public: 15 };

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
  let requests = 0;
  let cacheHits = 0;
  let remaining = null;
  let nextAllowedAt = null;
  const touched = new Set();
  const scope = token ? 'authenticated' : 'public';
  const requestCap = Number.isFinite(maxRequests) ? maxRequests : REQUEST_CAP[scope];
  const cachedResult = (cached, headers = cached?.headers || {}) => ({ data: cached.data, response: { headers: new Headers(headers) }, cached: true });
  async function get(path, { immutable = false, maxAgeMs = 0 } = {}) {
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('://')) throw new Error('Invalid GitHub repository path');
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(path));
    const key = 'ops-http:' + [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
    touched.add(key);
    const cached = await readStored(storage, key);
    const age = cached?.savedAt ? now() - cached.savedAt : Number.POSITIVE_INFINITY;
    if (cached && (immutable || (maxAgeMs > 0 && age >= 0 && age < maxAgeMs))) {
      cacheHits++;
      return cachedResult(cached);
    }
    const backoff = await storage?.get(`ops-backoff:${scope}`);
    if (backoff && backoff > now()) { nextAllowedAt = backoff; throw Object.assign(new Error('GitHubの利用制限による再取得待ち'), { retryAt: backoff, rateLimited: true }); }
    if (requests >= requestCap) throw Object.assign(new Error('今回の取得上限に達しました。次回同期で継続します。'), { budgetLimited: true });
    requests++;
    const headers = { accept: 'application/vnd.github+json', 'user-agent': 'rinne-ops-board/2.1', 'x-github-api-version': '2022-11-28' };
    if (token) headers.authorization = `Bearer ${token}`;
    if (cached?.etag) headers['if-none-match'] = cached.etag;
    const response = await fetchImpl(`${API}${path}`, { headers, signal: AbortSignal.timeout(15000) });
    if (response.headers.has('x-ratelimit-remaining')) remaining = Number(response.headers.get('x-ratelimit-remaining'));
    if ([403, 429].includes(response.status)) {
      const retryHeader = response.headers.get('retry-after');
      const seconds = retryHeader === null ? NaN : Number(retryHeader);
      const reset = Number(response.headers.get('x-ratelimit-reset')) * 1000;
      nextAllowedAt = Math.max(now() + 60000, Number.isFinite(seconds) ? now() + seconds * 1000 : 0,
        retryHeader && !Number.isFinite(seconds) ? Date.parse(retryHeader) || 0 : 0, remaining === 0 ? reset || 0 : 0);
      await storage?.put(`ops-backoff:${scope}`, nextAllowedAt);
      throw Object.assign(new Error(`GitHub取得制限または権限不足（HTTP ${response.status}）`), { retryAt: nextAllowedAt, rateLimited: true });
    }
    if (response.status === 304 && cached) {
      const mergedHeaders = { ...cached.headers, ...Object.fromEntries(response.headers) };
      await writeStored(storage, key, { ...cached, savedAt: now(), headers: mergedHeaders });
      cacheHits++;
      return cachedResult(cached, mergedHeaders);
    }
    if (!response.ok) throw new Error(`GitHub ${path.split('?')[0]}: HTTP ${response.status}`);
    const data = await response.json();
    const savedHeaders = Object.fromEntries(['link', 'x-ratelimit-remaining', 'x-ratelimit-reset'].filter(name => response.headers.has(name)).map(name => [name, response.headers.get(name)]));
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
    get deepAllowed() { return remaining === null || remaining > LOW_REMAINING[scope]; },
  };
}
