import './grid.css';
import { createReviewSvgThumbnail } from '@soul/shared-ui/review-thumbnail';

function sourceLabel(source) {
  return source.dataset.reviewLabel || source.getAttribute('aria-label') || (source.textContent || '').trim() || 'モデル';
}

export function readCharacterModels(doc, ready) {
  return [...doc.querySelectorAll('#character-model-options [data-character-model]')].map((source, index) => ({
    source,
    key: source.dataset.characterModel || String(index),
    label: sourceLabel(source),
    stage: source.dataset.modelStage || '',
    thumbnailUrl: source.dataset.thumbnailUrl || '',
    thumbnailKind: source.dataset.thumbnailKind || 'image',
    selected: source.getAttribute('aria-pressed') === 'true',
    disabled: !ready || source.matches(':disabled')
  }));
}

export function gridFocusIndex(items, current, key, columns = 6) {
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

  const stageName = make('div', 'character-review-stage-name', 'モデルを選択');
  stageName.setAttribute('aria-live', 'polite');

  const cameraDock = make('div', 'character-review-camera-dock review-surface__stage-tools');
  cameraDock.setAttribute('aria-label', '表示方向');
  const directionGroup = make('div', 'character-review-camera-group');
  const focusGroup = make('div', 'character-review-camera-group character-review-camera-group--focus');
  const front = actions.querySelector('[data-camera="front"]');
  const side = actions.querySelector('[data-camera="side"]');
  const back = actions.querySelector('[data-camera="back"]');
  const face = actions.querySelector('[data-camera="face"]');
  const frameButton = doc.getElementById('frame-model');
  for (const button of [front, side, back].filter(Boolean)) {
    button.hidden = false;
    button.removeAttribute('aria-hidden');
    directionGroup.append(button);
  }
  if (face) {
    face.hidden = false;
    face.removeAttribute('aria-hidden');
    focusGroup.append(face);
  }
  if (frameButton) {
    frameButton.textContent = '全身';
    frameButton.hidden = false;
    frameButton.removeAttribute('aria-hidden');
    focusGroup.append(frameButton);
  }
  cameraDock.append(directionGroup, focusGroup);

  const utility = make('div', 'character-review-stage-utility');
  const capture = doc.getElementById('capture');
  if (capture) {
    capture.textContent = '撮影';
    capture.classList.add('character-review-capture');
    utility.append(capture);
  }
  const settingsButton = make('button', 'character-review-settings-button');
  settingsButton.type = 'button';
  settingsButton.dataset.sharedIcon = 'settings-2';
  settingsButton.setAttribute('aria-label', '年齢・身長・体格などのキャラクター調整を開く');
  settingsButton.append(make('span', 'character-review-settings-icon'), make('span', 'character-review-settings-label', '調整'));
  utility.append(settingsButton);

  canvasWrap.append(stageName, utility, cameraDock);
  actions.hidden = true;

  const stageStatus = doc.querySelector('.stage-status');
  if (stageStatus) {
    stageStatus.classList.add('review-surface__stage-status');
    if (!canvasWrap.contains(stageStatus)) canvasWrap.append(stageStatus);
  }

  const settingsDialog = make('dialog', 'character-review-settings');
  settingsDialog.id = 'character-review-settings';
  settingsDialog.setAttribute('aria-labelledby', 'character-review-settings-title');
  const settingsHead = make('header', 'character-review-settings__head');
  const settingsTitle = make('div', 'character-review-settings__title');
  const settingsEyebrow = make('small', '', 'CHARACTER');
  const settingsHeading = make('h2', '', 'キャラクター調整');
  settingsHeading.id = 'character-review-settings-title';
  settingsTitle.append(settingsEyebrow, settingsHeading);
  const settingsClose = make('button', 'character-review-settings__close', '×');
  settingsClose.type = 'button';
  settingsClose.setAttribute('aria-label', 'キャラクター調整を閉じる');
  settingsHead.append(settingsTitle, settingsClose);
  const settingsNote = make('p', 'character-review-settings__note', '実モデルの確認はこの画面のまま。年齢・身長・体格などの編集項目は、ここから直接開けます。');
  const settingsGrid = make('div', 'character-review-settings__grid');
  const settingLink = (title, detail, href) => {
    const link = make('a', 'character-review-setting-link');
    link.href = href;
    link.append(make('strong', '', title), make('span', '', detail), make('b', '', '›'));
    return link;
  };
  const boneToggle = make('button', 'character-review-setting-link character-review-setting-toggle');
  boneToggle.type = 'button';
  boneToggle.setAttribute('aria-pressed', 'false');
  boneToggle.append(make('strong', '', 'ボーン表示'), make('span', '', '骨格を重ねて確認'), make('b', '', 'OFF'));
  boneToggle.addEventListener('click', () => {
    const current = win.characterStudio?.review;
    if (current?.ready) current.setBoneOverlay(!current.bonesVisible);
  });
  settingsGrid.append(
    settingLink('年齢', '0〜90歳', './advanced.html#age'),
    settingLink('身長', '身長遺伝子', './advanced.html#gene-height'),
    settingLink('体格', '体格遺伝子', './advanced.html#gene-build'),
    settingLink('顔・髪・色', '個体の形質', './advanced.html#gene-hair'),
    boneToggle
  );
  const advanced = make('a', 'character-review-settings__advanced', 'すべての詳細調整を開く');
  advanced.href = './advanced.html';
  settingsDialog.append(settingsHead, settingsNote, settingsGrid, advanced);
  doc.body.append(settingsDialog);

  const closeSettings = () => {
    if (typeof settingsDialog.close === 'function' && settingsDialog.open) settingsDialog.close();
    else settingsDialog.removeAttribute('open');
  };
  settingsButton.addEventListener('click', () => {
    if (typeof settingsDialog.showModal === 'function') settingsDialog.showModal();
    else settingsDialog.setAttribute('open', '');
  });
  settingsClose.addEventListener('click', closeSettings);
  settingsDialog.addEventListener('click', event => {
    if (event.target === settingsDialog) closeSettings();
  });

  const root = make('section', 'character-review-picker');
  root.id = 'character-review-picker';
  root.setAttribute('aria-label', 'キャラクターモデル');
  const heading = make('h2', 'sr-only', 'キャラクターモデル');
  const grid = make('div', 'character-model-grid review-choice-grid');
  grid.setAttribute('role', 'listbox');
  grid.setAttribute('aria-label', '実キャラクターモデル');
  const empty = make('p', 'character-review-empty', 'モデルを読み込んでいます。');
  root.append(heading, grid, empty);
  controls.prepend(root);
  doc.body.classList.add('character-grid-ready');

  let signature = '', autoSelected = false, queued = false;
  const review = () => win.characterStudio?.review;
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
      button.title = model.stage ? `${model.label} · ${model.stage}` : model.label;
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', String(model.selected));
      button.setAttribute('aria-label', model.stage ? `${model.label}、${model.stage}` : model.label);
      if (model.thumbnailUrl) {
        if (model.thumbnailKind === 'svg-symbol') {
          button.append(createReviewSvgThumbnail(model.thumbnailUrl, { className: 'character-model-thumbnail', decorative: true, doc }));
        } else {
          const image = make('img', 'character-model-thumbnail');
          image.src = model.thumbnailUrl; image.alt = ''; image.loading = 'lazy'; image.decoding = 'async';
          image.width = 288; image.height = 184; button.append(image);
        }
      }
      button.append(make('strong', 'character-model-card-label', model.label));
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
    const next = JSON.stringify(models.map(model => [model.key, model.label, model.stage, model.thumbnailUrl, model.thumbnailKind, model.selected, model.disabled]));
    if (next !== signature) {
      signature = next;
      render(models);
    }
    empty.hidden = models.length > 0;
    stageName.textContent = models.find(model => model.selected)?.label || 'モデルを選択';
    boneToggle.disabled = !ready;
    boneToggle.setAttribute('aria-pressed', String(Boolean(review()?.bonesVisible)));
    boneToggle.querySelector('b').textContent = review()?.bonesVisible ? 'ON' : 'OFF';
    boneToggle.querySelector('span').textContent = review()?.boneOverlayKind === 'inferred-guide' ? '推定関節のガイド（未リグ）' : '実際のボーンを表示';
    if (ready && !autoSelected && !review()?.displayModelId) {
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
