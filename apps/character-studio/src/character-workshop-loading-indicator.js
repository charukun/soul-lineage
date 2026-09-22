const byId = id => document.getElementById(id);
const qs = selector => document.querySelector(selector);

let installed = false;

function loadPhase(value, failed) {
  if (failed) return ['読み込みに失敗', '再試行できます'];
  if (value >= 1) return ['表示できました', ''];
  if (value < .3) return ['モデル本体', '最優先で3Dモデルを取得・確認中'];
  if (value < .65) return ['骨格・動き', '表示に必要な骨格と共通モーションを準備中'];
  if (value < .9) return ['表示データ', '選択中の表示に必要なデータを準備中'];
  return ['GPU準備', '描画準備が終われば操作できます'];
}

export function installWorkshopLoadingIndicator() {
  if (installed) return true;
  const wrap = qs('.canvas-wrap');
  const progress = byId('progress');
  const status = byId('status');
  if (!wrap || !progress || !status) return false;

  const root = document.createElement('div');
  root.id = 'load-indicator';
  root.className = 'load-indicator';
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');
  root.setAttribute('aria-atomic', 'true');

  const head = document.createElement('div');
  head.className = 'load-indicator-head';
  const label = document.createElement('strong');
  label.id = 'load-label';
  const percent = document.createElement('output');
  percent.id = 'load-percent';
  head.append(label, percent);

  const track = document.createElement('div');
  track.className = 'load-indicator-track';
  track.setAttribute('aria-hidden', 'true');
  const fill = document.createElement('i');
  fill.id = 'load-fill';
  track.append(fill);

  const detail = document.createElement('span');
  detail.id = 'load-detail';
  root.append(head, track, detail);
  wrap.append(root);

  let startedAt = performance.now();
  let ticker = null;
  let hideTimer = null;

  const sync = () => {
    const value = Math.max(0, Math.min(1, Number(progress.value) || 0));
    const failed = status.dataset.error === 'true';
    const [phase, fallback] = loadPhase(value, failed);
    const elapsed = Math.max(0, performance.now() - startedAt) / 1000;
    root.dataset.state = failed ? 'error' : value >= 1 ? 'ready' : 'loading';
    root.hidden = false;
    label.textContent = phase;
    percent.value = failed ? '!' : `${Math.round(value * 100)}%`;
    fill.style.width = `${Math.max(4, Math.round(value * 100))}%`;
    detail.textContent = failed ? status.textContent : `${status.textContent || fallback}${value < 1 ? ` · ${elapsed.toFixed(1)}秒` : ''}`;

    clearTimeout(hideTimer);
    if (value >= 1 && !failed) hideTimer = setTimeout(() => { root.hidden = true; }, 850);
    if (value < 1 && !failed && ticker === null) ticker = window.setInterval(sync, 250);
    if ((value >= 1 || failed) && ticker !== null) { clearInterval(ticker); ticker = null; }
  };

  const observer = new MutationObserver(sync);
  observer.observe(progress, { attributes: true, attributeFilter: ['value'] });
  observer.observe(status, { attributes: true, attributeFilter: ['data-error'], childList: true, characterData: true, subtree: true });
  byId('retry')?.addEventListener('click', () => {
    startedAt = performance.now();
    clearTimeout(hideTimer);
    sync();
  });
  sync();
  installed = true;
  return true;
}
