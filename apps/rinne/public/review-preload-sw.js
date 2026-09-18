const MAX_MEMORY_BYTES = 48 * 1024 * 1024;
const memory = new Map();
const inflight = new Map();
const preloadUrls = new Set();
const states = new Map();
let memoryBytes = 0;
let activeSessionId = null;
let activeRun = null;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

function absoluteUrl(value) {
  const url = new URL(String(value || ''), self.registration.scope);
  if (url.origin !== self.location.origin) throw new Error('cross-origin preload is not allowed');
  return url.href;
}

function safeHeaders(entries) {
  const headers = new Headers(entries || []);
  for (const name of ['content-encoding', 'content-length', 'transfer-encoding', 'connection']) headers.delete(name);
  return headers;
}

function responseFromPayload(payload) {
  return new Response(payload.body.slice(0), {
    status: payload.status,
    statusText: payload.statusText,
    headers: safeHeaders(payload.headers)
  });
}

async function fetchPayload(input) {
  const url = absoluteUrl(input);
  preloadUrls.add(url);
  if (memory.has(url)) return memory.get(url);
  if (inflight.has(url)) return inflight.get(url);

  const request = fetch(url, {cache: 'force-cache', credentials: 'same-origin'})
    .then(async response => {
      if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
      const body = await response.arrayBuffer();
      const payload = {
        body,
        status: response.status,
        statusText: response.statusText,
        headers: [...response.headers.entries()]
      };
      if (memoryBytes + body.byteLength <= MAX_MEMORY_BYTES) {
        memory.set(url, payload);
        memoryBytes += body.byteLength;
      }
      return payload;
    })
    .finally(() => inflight.delete(url));

  inflight.set(url, request);
  return request;
}

function discoverDocumentAssets(payload, routeUrl) {
  const html = new TextDecoder().decode(payload.body);
  const found = new Set();
  for (const match of html.matchAll(/<(script|link)\b([^>]*)>/gi)) {
    const tag = match[1].toLowerCase();
    const attrs = match[2] || '';
    const valueMatch = attrs.match(/(?:src|href)\s*=\s*["']([^"']+)["']/i);
    if (!valueMatch) continue;
    if (tag === 'link') {
      const relMatch = attrs.match(/rel\s*=\s*["']([^"']+)["']/i);
      const rel = (relMatch?.[1] || '').toLowerCase().split(/\s+/);
      if (!rel.some(value => ['stylesheet', 'modulepreload', 'preload'].includes(value))) continue;
    }
    try {
      const url = new URL(valueMatch[1], routeUrl);
      if (url.origin === self.location.origin) found.add(url.href);
    } catch {}
  }
  return [...found];
}

async function broadcast(target, snapshot, sessionId) {
  states.set(target, snapshot);
  const clients = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
  for (const client of clients) {
    client.postMessage({
      type: 'rinne-review-preload-progress',
      sessionId,
      target,
      snapshot
    });
  }
}

async function preloadGroup(target, spec, sessionId) {
  const routeUrl = absoluteUrl(spec.route);
  let completed = 0;
  let total = 1;
  await broadcast(target, {state: 'loading', completed, total, detail: '画面を準備中'}, sessionId);

  try {
    const documentResponse = await fetch(routeUrl, {cache: 'no-store', credentials: 'same-origin'});
    if (!documentResponse.ok) throw new Error(`${routeUrl}: HTTP ${documentResponse.status}`);
    const documentPayload = {
      body: await documentResponse.arrayBuffer(),
      status: documentResponse.status,
      statusText: documentResponse.statusText,
      headers: [...documentResponse.headers.entries()]
    };
    const discovered = discoverDocumentAssets(documentPayload, routeUrl);
    const extras = Array.isArray(spec.assets) ? spec.assets.map(absoluteUrl) : [];
    const resources = [...new Set([...discovered, ...extras])].filter(url => url !== routeUrl);
    completed = 1;
    total = resources.length + 1;
    await broadcast(target, {state: 'loading', completed, total, detail: '必要データを準備中'}, sessionId);

    for (const resource of resources) {
      await fetchPayload(resource);
      completed += 1;
      await broadcast(target, {state: 'loading', completed, total, detail: '必要データを準備中'}, sessionId);
    }

    await broadcast(target, {state: 'ready', completed: total, total, detail: '準備完了'}, sessionId);
  } catch (error) {
    await broadcast(target, {
      state: 'error',
      completed,
      total,
      detail: String(error?.message || error)
    }, sessionId);
  }
}

async function runGroups(groups, sessionId) {
  await Promise.all(Object.entries(groups || {}).map(([target, spec]) => preloadGroup(target, spec, sessionId)));
}

self.addEventListener('message', event => {
  const message = event.data;
  if (message?.type !== 'rinne-review-preload-start' || !message.sessionId) return;

  if (activeSessionId !== message.sessionId) {
    activeSessionId = message.sessionId;
    states.clear();
    memory.clear();
    preloadUrls.clear();
    memoryBytes = 0;
    activeRun = runGroups(message.groups, activeSessionId);
  }
  if (activeRun) event.waitUntil(activeRun);
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || event.request.headers.has('range')) return;
  const url = event.request.url;
  if (!preloadUrls.has(url)) return;
  const pending = memory.has(url) ? Promise.resolve(memory.get(url)) : inflight.get(url);
  if (!pending) return;
  event.respondWith(
    pending.then(responseFromPayload).catch(() => fetch(event.request))
  );
});
