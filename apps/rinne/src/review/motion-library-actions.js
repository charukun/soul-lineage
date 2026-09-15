const q = selector => document.querySelector(selector);
const CANDIDATE_KEY = 'rinne.motion-library.candidates.v1';
const REJECTED_KEY = 'rinne.motion-library.rejected.v1';

function readSet(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return new Set(Array.isArray(value) ? value.filter(item => typeof item === 'string') : []);
  } catch {
    return new Set();
  }
}
function writeSet(key, values) {
  try { localStorage.setItem(key, JSON.stringify([...values])); } catch {}
}
function currentKey() {
  const model = q('.library-model.active')?.dataset.model;
  const motion = q('.motion-row.active')?.dataset.motion;
  return model && motion ? `${model}:${motion}` : '';
}
function advance() {
  const rows = [...document.querySelectorAll('.motion-row')];
  if (rows.length < 2) return;
  const index = Math.max(0, rows.findIndex(row => row.classList.contains('active')));
  rows[(index + 1) % rows.length]?.click();
}
function syncRejected() {
  const rejected = readSet(REJECTED_KEY);
  const model = q('.library-model.active')?.dataset.model;
  document.querySelectorAll('.motion-row').forEach(row => {
    const on = Boolean(model && rejected.has(`${model}:${row.dataset.motion}`));
    row.classList.toggle('rejected', on);
    if (on) row.querySelector('.motion-row-play').textContent = '×';
  });
}
function syncAdoptLabel() {
  const button = q('#library-candidate');
  if (!button) return;
  const label = button.getAttribute('aria-pressed') === 'true' ? '採用済' : '採用';
  if (button.textContent !== label) button.textContent = label;
}
function install() {
  const adopt = q('#library-candidate');
  const list = q('#library-list');
  if (!adopt || !list || typeof adopt.onclick !== 'function' || adopt.dataset.integratedActions) return false;
  adopt.dataset.integratedActions = 'true';
  const originalAdopt = adopt.onclick;
  adopt.onclick = event => {
    const key = currentKey();
    if (!key) return;
    const rejected = readSet(REJECTED_KEY);
    rejected.delete(key); writeSet(REJECTED_KEY, rejected);
    if (adopt.getAttribute('aria-pressed') !== 'true') originalAdopt.call(adopt, event);
    syncAdoptLabel(); syncRejected();
    queueMicrotask(advance);
  };
  const reject = document.createElement('button');
  reject.id = 'library-reject'; reject.type = 'button'; reject.textContent = '見送り';
  reject.addEventListener('click', event => {
    const key = currentKey();
    if (!key) return;
    if (adopt.getAttribute('aria-pressed') === 'true') originalAdopt.call(adopt, event);
    const rejected = readSet(REJECTED_KEY); rejected.add(key); writeSet(REJECTED_KEY, rejected);
    syncAdoptLabel(); syncRejected();
    queueMicrotask(advance);
  });
  adopt.after(reject);
  q('#library-restart')?.remove();
  const observer = new MutationObserver(() => { syncAdoptLabel(); syncRejected(); });
  observer.observe(list, {childList: true, subtree: true});
  observer.observe(adopt, {attributes: true, attributeFilter: ['aria-pressed'], childList: true});
  syncAdoptLabel(); syncRejected();
  return true;
}
let tries = 0;
function boot() {
  if (install() || tries++ > 120) return;
  requestAnimationFrame(boot);
}
boot();
