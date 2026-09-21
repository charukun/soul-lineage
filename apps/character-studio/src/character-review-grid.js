import './character-review-grid.css';

function sourceLabel(source) {
  return source.dataset.reviewLabel || (source.textContent || '').trim() || source.getAttribute('aria-label') || 'モデル';
}

export function readCharacterModels(doc, ready) {
  return [...doc.querySelectorAll('#character-model-options [data-character-model]')].map((source, index) => ({
    source,
    key: source.dataset.characterModel || String(index),
    label: sourceLabel(source),
    stage: source.dataset.modelStage || '',
    selected: source.getAttribute('aria-pressed') === 'true',
    disabled: !ready || source.matches(':disabled')
  }));
}

export function gridFocusIndex(items, current, key, columns = 5) {
  const direction = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns }[key];
  let index = key === 'Home' ? 0 : key === 'End' ? items.length - 1 : current + (direction || 0);
  if (!direction && key !== 'Home' && key !== 'End') return current;
  const step = key === 'End' || direction < 0 ? -1 : 1;
  while (index >= 0 && index < items.length && items[index].disabled) index += step;
  return index >= 0 && index < items.length ? index : current;
}

export function installCharacterReviewGrid(doc = document, win = window) {
  if (!doc.body.classList.contains('simple-review') || doc.body.dataset.reviewMode !== 'character' || doc.getElementById('character-review-picker')) return false;
  const controls = doc.querySelector('.review-controls');
  const sourceOptions = doc.getElementById('character-model-options');
  const actions = doc.querySelector('.stage-actions');
  const canvasWrap = doc.querySelector('.canvas-wrap');
  if (!controls || !sourceOptions || !actions || !canvasWrap) return false;

  const make = (tag, className = '', text = '') => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };

  const cameraDock = make('div', 'character-review-camera-dock review-surface__stage-tools');
  cameraDock.setAttribute('aria-label', '表示方向');
  const cameraButtons = [...actions.querySelectorAll('[data-camera="front"],[data-camera="side"],[data-camera="back"],[data-camera="face"]')];
  const frameButton = doc.getElementById('frame-model');
  for (const button of cameraButtons) {
    button.hidden = false;
    button.removeAttribute('aria-hidden');
    cameraDock.append(button);
  }
  if (frameButton) {
    frameButton.textContent = '全身';
    frameButton.hidden = false;
    frameButton.removeAttribute('aria-hidden');
    cameraDock.append(frameButton);
  }
  canvasWrap.append(cameraDock);
  actions.hidden = true;

  const stageStatus = doc.querySelector('.stage-status');
  if (stageStatus) {
    stageStatus.classList.add('review-surface__stage-status');
    if (!canvasWrap.contains(stageStatus)) canvasWrap.append(stageStatus);
  }

  const root = make('section', 'character-review-picker');
  root.id = 'character-review-picker';
  root.setAttribute('aria-label', 'キャラクターモデル');
  const heading = make('div', 'character-review-heading');
  heading.append(make('strong', '', 'キャラクター'), make('small', '', '実モデルのみ'));
  const grid = make('div', 'character-model-grid review-choice-grid');
  grid.setAttribute('role', 'listbox');
  grid.setAttribute('aria-label', '実キャラクターモデル');
  const empty = make('p', 'character-review-empty', 'モデルを読み込んでいます。');
  const advanced = make('a', 'character-review-advanced', '髪・顔・年齢・個体差などを編集');
  advanced.href = './advanced.html';
  root.append(heading, grid, empty, advanced);
  controls.prepend(root);
  doc.body.classList.add('character-grid-ready');

  let signature = '', autoSelected = false, queued = false;
  const review = () => win.characterStudio?.review;
  const workspace = () => win.characterStudio?.workspace;
  const schedule = () => {
    if (queued) return;
    queued = true;
    win.requestAnimationFrame(() => { queued = false; sync(); });
  };
  const choose = model => {
    if (!review()?.ready || !model.source.isConnected || model.source.matches(':disabled')) return;
    model.source.click();
    win.requestAnimationFrame(() => review()?.aim('front'));
    schedule();
  };
  const render = models => {
    const focused = grid.contains(doc.activeElement) ? doc.activeElement?.dataset.modelKey : null;
    grid.replaceChildren(...models.map(model => {
      const button = make('button', 'character-model-card review-choice-card');
      button.type = 'button';
      button.dataset.modelKey = model.key;
      button.disabled = model.disabled;
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', String(model.selected));
      button.append(make('strong', 'character-model-card-label', model.label));
      if (model.stage) button.append(make('small', 'character-model-card-stage', model.stage));
      button.addEventListener('click', () => choose(model));
      return button;
    }));
    const buttons = [...grid.children];
    const selected = models.findIndex(model => model.selected && !model.disabled);
    const first = selected >= 0 ? selected : models.findIndex(model => !model.disabled);
    buttons.forEach((button, index) => { button.tabIndex = index === Math.max(0, first) ? 0 : -1; });
    if (focused) buttons.find(button => button.dataset.modelKey === focused && !button.disabled)?.focus({ preventScroll: true });
  };
  grid.addEventListener('keydown', event => {
    const buttons = [...grid.children], current = buttons.indexOf(event.target);
    if (current < 0 || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const next = gridFocusIndex(buttons.map(button => ({ disabled: button.disabled })), current, event.key);
    buttons.forEach((button, index) => { button.tabIndex = index === next ? 0 : -1; });
    buttons[next]?.focus();
  });

  function sync() {
    const ready = Boolean(review()?.ready);
    const models = readCharacterModels(doc, ready);
    const next = JSON.stringify(models.map(model => [model.key, model.label, model.stage, model.selected, model.disabled]));
    if (next !== signature) {
      signature = next;
      render(models);
    }
    empty.hidden = models.length > 0;
    if (ready && !autoSelected && !workspace()?.modelId) {
      const first = models.find(model => !model.disabled);
      if (first) {
        autoSelected = true;
        choose(first);
      }
    }
  }

  const observer = new win.MutationObserver(schedule);
  observer.observe(sourceOptions, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-pressed','disabled'] });
  win.addEventListener('character-workspace-change', schedule);
  win.addEventListener('character-review-change', schedule);
  win.addEventListener('pagehide', event => { if (!event.persisted) observer.disconnect(); }, { once: true });
  schedule();
  return true;
}
