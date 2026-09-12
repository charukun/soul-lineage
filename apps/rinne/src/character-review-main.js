import './character-review.js';

const el = id => document.getElementById(id);
const modeCopy = {
  population: ['個体差', '体数と血縁パターンを切り替え、同じMasterCharacterからどこまで自然な差が出るかを確認します。'],
  age: ['年齢・体格', '年齢を揃える／混ぜるを切り替え、成長差と遺伝由来の体格差を見比べます。'],
  color: ['配色', '同じ完成衣装のまま、既存の配色バリエーションだけを比較します。'],
  expression: ['表情', '収録済み表情を顔寄りで切り替え、個体単位・全体・混在を確認します。'],
  spring: ['髪・衣装の揺れ', '揺れ物の更新範囲と確認用の動きを切り替え、破綻や個体間の干渉を見ます。'],
  performance: ['30体負荷', '30体表示時の描画・揺れ更新数・FPS・p95を同じ画面で確認します。']
};
function emit(id, value, type = 'change') {
  const control = el(id); if (!control) return;
  if (control.type === 'checkbox') control.checked = Boolean(value); else control.value = String(value);
  control.dispatchEvent(new Event(type, { bubbles: true }));
  requestAnimationFrame(syncShell);
}
function click(id) { el(id)?.click(); requestAnimationFrame(syncShell); }
function camera(name) { document.querySelector(`[data-camera="${name}"]`)?.click(); }
function pressGroup(selector, current) {
  for (const button of document.querySelectorAll(selector)) button.classList.toggle('is-selected', button.dataset[Object.keys(button.dataset)[0]] === String(current));
}
function syncPressed() {
  pressGroup('[data-count]', el('count').value);
  pressGroup('[data-ancestry]', el('ancestry').value);
  pressGroup('[data-outfit]', el('outfit').value);
  pressGroup('[data-motion]', el('motion').value);
  pressGroup('[data-springs]', el('springs').value);
  pressGroup('[data-expression-mode]', el('expression-mode').value);
  for (const button of document.querySelectorAll('[data-age]')) button.classList.toggle('is-selected', el('ages').value === 'fixed' && Number(button.dataset.age) === Number(el('age').value));
  el('mixed-ages').classList.toggle('is-selected', el('ages').value === 'mixed');
  el('rotate-toggle').setAttribute('aria-pressed', String(el('rotate').checked));
}
function syncShell() {
  syncPressed();
  const metrics = el('metrics').textContent.trim(); if (metrics) el('metrics-live').textContent = metrics;
  const capabilities = el('capabilities').textContent.trim(); if (capabilities) el('capability-live').textContent = capabilities;
}
function selectMode(mode) {
  for (const button of document.querySelectorAll('[data-review-mode]')) button.setAttribute('aria-pressed', String(button.dataset.reviewMode === mode));
  for (const panel of document.querySelectorAll('[data-mode-panel]')) panel.classList.toggle('is-active', panel.dataset.modePanel === mode);
  const [title, description] = modeCopy[mode]; el('mode-title').textContent = title; el('mode-label').textContent = `${title}を確認`; el('mode-description').textContent = description;
  if (mode === 'expression') { emit('view', 'single'); camera('face'); }
  else if (mode === 'spring') { emit('view', 'single'); camera('front'); }
  else { emit('view', 'crowd'); camera('overview'); }
}

for (const button of document.querySelectorAll('[data-review-mode]')) button.addEventListener('click', () => selectMode(button.dataset.reviewMode));
for (const button of document.querySelectorAll('[data-count]')) button.addEventListener('click', () => emit('count', Number(button.dataset.count)));
for (const button of document.querySelectorAll('[data-ancestry]')) button.addEventListener('click', () => emit('ancestry', button.dataset.ancestry));
for (const button of document.querySelectorAll('[data-age]')) button.addEventListener('click', () => emit('age', Number(button.dataset.age), 'input'));
for (const button of document.querySelectorAll('[data-outfit]')) button.addEventListener('click', () => emit('outfit', button.dataset.outfit));
for (const button of document.querySelectorAll('[data-motion]')) button.addEventListener('click', () => emit('motion', button.dataset.motion));
for (const button of document.querySelectorAll('[data-springs]')) button.addEventListener('click', () => emit('springs', button.dataset.springs));
for (const button of document.querySelectorAll('[data-expression-mode]')) button.addEventListener('click', () => emit('expression-mode', button.dataset.expressionMode));
el('hero-previous').addEventListener('click', () => click('previous'));
el('hero-next').addEventListener('click', () => click('next'));
el('next-cohort').addEventListener('click', () => click('next-seed'));
el('mixed-ages').addEventListener('click', () => emit('ages', 'mixed'));
el('body-compare').addEventListener('click', () => { emit('count', 12); emit('age', 22, 'input'); emit('view', 'crowd'); camera('overview'); });
el('rotate-toggle').addEventListener('click', () => emit('rotate', !el('rotate').checked));
el('perf-auto').addEventListener('click', () => { emit('count', 30); emit('springs', 'auto'); emit('view', 'crowd'); camera('overview'); });
el('perf-full').addEventListener('click', () => { emit('count', 30); emit('springs', 'all'); emit('view', 'crowd'); camera('overview'); });
el('reset-measure').addEventListener('click', () => click('measure'));

function rebuildExpressions() {
  const grid = el('expression-grid'), select = el('expression');
  const fragment = document.createDocumentFragment();
  for (const option of select.options) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = option.value ? option.textContent : 'ニュートラル'; button.dataset.expressionValue = option.value;
    button.classList.toggle('is-selected', option.value === select.value);
    button.addEventListener('click', () => { emit('expression', option.value); rebuildExpressions(); });
    fragment.append(button);
  }
  grid.replaceChildren(fragment);
}
new MutationObserver(rebuildExpressions).observe(el('expression'), { childList: true });
for (const watched of ['subject', 'metrics', 'capabilities']) new MutationObserver(syncShell).observe(el(watched), { childList: true, characterData: true, subtree: true });
el('expression').addEventListener('change', rebuildExpressions);

rebuildExpressions();
selectMode('population');
syncShell();
