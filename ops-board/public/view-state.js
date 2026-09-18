// One snapshot request for the whole board. UI updates never call GitHub directly.
const subscribers = new Set();
let snapshot = null;
let inflight = null;
const disclosureState = new Map();
const savedKey = 'rinne-ops:disclosures:v1';
try { for (const entry of JSON.parse(sessionStorage.getItem(savedKey) || '[]')) disclosureState.set(...entry); } catch { /* optional storage */ }

function rememberDetails(root = document) {
  root.querySelectorAll('details[data-disclosure]').forEach(node => disclosureState.set(node.dataset.disclosure, node.open));
  try { sessionStorage.setItem(savedKey, JSON.stringify([...disclosureState])); } catch { /* optional storage */ }
}

document.addEventListener('toggle', event => {
  const node = event.target;
  if (node.matches?.('details[data-disclosure]')) rememberDetails();
}, true);

export function disclosure(key, title, content, className = '') {
  const node = document.createElement('details');
  node.dataset.disclosure = key;
  if (className) node.className = className;
  const summary = document.createElement('summary');
  summary.textContent = title;
  summary.dataset.viewKey = `disclosure:${key}`;
  node.append(summary, content);
  node.open = disclosureState.get(key) === true;
  return node;
}

export function preserveView(render) {
  rememberDetails();
  const beforeY = scrollY;
  const active = document.activeElement;
  const focusedKey = active?.dataset?.viewKey;
  const focusedId = active?.id;
  const visible = [...document.querySelectorAll('[data-view-key], .board-section[id]')]
    .filter(node => { const r = node.getBoundingClientRect(); return r.height && r.top >= 0 && r.top < innerHeight; });
  const anchor = visible.find(node => node.dataset.viewKey) || visible[0];
  const key = anchor?.dataset?.viewKey;
  const id = anchor?.id;
  const beforeTop = anchor?.getBoundingClientRect().top;
  render();
  document.querySelectorAll('details[data-disclosure]').forEach(node => {
    if (disclosureState.has(node.dataset.disclosure)) node.open = disclosureState.get(node.dataset.disclosure);
  });
  const findKey = value => [...document.querySelectorAll('[data-view-key]')].find(node => node.dataset.viewKey === value);
  const nextAnchor = key ? findKey(key) : id ? document.getElementById(id) : null;
  if (beforeY > 4 && nextAnchor && Number.isFinite(beforeTop)) {
    const adjustment = nextAnchor.getBoundingClientRect().top - beforeTop;
    if (Math.abs(adjustment) > 0.5) scrollTo({ top: Math.max(0, scrollY + adjustment), behavior: 'instant' });
  }
  if (active && !active.isConnected) {
    const nextFocus = focusedKey ? findKey(focusedKey) : focusedId ? document.getElementById(focusedId) : null;
    nextFocus?.focus({ preventScroll: true });
  }
}

export function subscribe(listener) {
  subscribers.add(listener);
  if (snapshot) listener(snapshot, null);
  return () => subscribers.delete(listener);
}

export async function loadBoard() {
  if (inflight) return inflight;
  const button = document.querySelector('#reload');
  if (button) button.disabled = true;
  inflight = (async () => {
    try {
      const response = await fetch('/api/state', { cache: 'no-store', signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data?.repository !== 'charukun/soul-lineage' || !Array.isArray(data.environments)) throw new Error('取得データの形式が不正です');
      snapshot = data;
      preserveView(() => { for (const fn of subscribers) fn(snapshot, null); });
      document.dispatchEvent(new CustomEvent('ops:updated', { detail: { generatedAt: data.generatedAt } }));
    } catch (error) {
      preserveView(() => { for (const fn of subscribers) fn(snapshot, error); });
    } finally {
      if (button) button.disabled = false;
      inflight = null;
    }
    return snapshot;
  })();
  return inflight;
}

document.querySelector('#reload')?.addEventListener('click', loadBoard);
// Defer until all importing modules have registered their renderers.
setTimeout(loadBoard, 0);
setInterval(() => { if (!document.hidden) loadBoard(); }, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) loadBoard(); });
