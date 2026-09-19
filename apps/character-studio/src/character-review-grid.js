import './character-review-grid.css';

const GROUPS = Object.freeze([
  ['model', 'キャラ', '#character-model-options [data-character-model]', '人'],
  ['part', '部位', '#slot-tabs [data-slot]', '部'],
  ['variant', 'パーツ', '#part-options [data-modular-value]', '形'],
  ['individual', '個体', '#individuals [data-individual]', '個'],
  ['hair', '髪色', '#color-options [data-gene="hair"]', '髪'],
  ['eyes', '瞳', '#color-options [data-gene="eyes"]', '瞳'],
  ['skin', '肌', '#color-options [data-gene="skin"]', '肌'],
  ['dye', '服色', '#color-options [data-dye]', '衣'],
  ['age', '年齢', '#age-options [data-age]', '歳']
]);

function sourceLabel(source) {
  const copy = source.cloneNode(true);
  copy.querySelectorAll('.tick,[aria-hidden="true"]').forEach(node => node.remove());
  return (copy.textContent || '').trim() || source.getAttribute('aria-label') || '未選択';
}

function optionMark(group, option) {
  if (option.swatch) return '';
  if (group.id === 'age') return option.label.match(/\d+/)?.[0] || group.glyph;
  if (group.id === 'individual') return option.label.match(/\d+/)?.[0] || group.glyph;
  if (['model','part','variant'].includes(group.id)) {
    return [...option.label.replace(/\s+/g, '')][0] || group.glyph;
  }
  return group.glyph;
}

// The original controls remain the only writers of workshop state.
export function readCharacterReviewGroups(doc, ready) {
  return GROUPS.map(([id, label, selector, glyph]) => {
    const options = [...doc.querySelectorAll(selector)].map((source, index) => {
      const key = String(index);
      return { source, key, label: sourceLabel(source),
        fullLabel: source.getAttribute('aria-label') || sourceLabel(source),
        selected: source.getAttribute('aria-pressed') === 'true',
        disabled: !ready || source.matches(':disabled'),
        swatch: source.querySelector('i')?.style.backgroundColor || '' };
    });
    return { id, label, glyph, options,
      value: options.find(option => option.selected)?.label || (ready ? 'カスタム' : '読込中') };
  });
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
  if (doc.body.dataset.reviewMode !== 'character' || doc.getElementById('character-review-picker')) return false;
  const controls = doc.querySelector('.review-controls');
  const fields = doc.getElementById('editor-fields');
  if (!controls || !fields || !doc.getElementById('character-model-options')) return false;

  // Character review owns its own compact review chrome even when opened at the app root.
  const actions = doc.querySelector('.stage-actions');
  const frameButton = doc.getElementById('frame-model');
  const subjectRow = doc.querySelector('.subject-row');
  const stageHead = doc.querySelector('.stage-head');
  for (const node of [doc.getElementById('camera-cycle'), doc.getElementById('pause'), actions?.querySelector('[data-camera="overview"]')].filter(Boolean)) {
    node.hidden = true;
    node.setAttribute('aria-hidden', 'true');
  }
  if (frameButton && actions && !actions.contains(frameButton)) {
    frameButton.textContent = '全身';
    frameButton.title = 'モデル全体を表示';
    actions.append(frameButton);
  }
  if (subjectRow && stageHead && !stageHead.contains(subjectRow)) {
    subjectRow.classList.add('character-review-pager');
    stageHead.append(subjectRow);
  }
  const make = (tag, className, text = '') => {
    const node = doc.createElement(tag); node.className = className; node.textContent = text; return node;
  };
  const attr = (node, name, value) => { if (node.getAttribute(name) !== String(value)) node.setAttribute(name, String(value)); };
  const text = (node, value) => { if (node.textContent !== value) node.textContent = value; };
  const root = make('section', 'character-review-picker'); root.id = 'character-review-picker';
  root.setAttribute('aria-label', '確認項目と候補一覧');
  const slots = make('nav', 'character-review-slots'); slots.setAttribute('role', 'tablist'); slots.setAttribute('aria-label', '確認項目');
  const heading = make('div', 'character-review-current'); heading.id = 'character-review-current'; heading.setAttribute('role', 'status');
  const panel = make('section', 'character-review-candidates'); panel.id = 'character-review-candidates'; panel.setAttribute('role', 'tabpanel');
  const grid = make('div', 'character-review-grid'); grid.setAttribute('role', 'group'); grid.setAttribute('aria-labelledby', heading.id);
  const empty = make('p', 'character-review-empty', 'モデルを読み込んでいます。'); panel.append(grid, empty);
  const tools = make('div', 'character-review-tools'); tools.setAttribute('aria-label', '比較と編集履歴');
  root.append(slots, heading, panel, tools); controls.prepend(root);
  const state = { active: 'model', camera: 'front', framed: false, autoFit: true, queued: false, signature: '', groups: [] };
  const slotNodes = new Map();
  const review = () => win.characterStudio?.review;
  const cameraButtons = [...doc.querySelectorAll('.stage-actions [data-camera="front"],.stage-actions [data-camera="side"],.stage-actions [data-camera="back"],.stage-actions [data-camera="face"]')];
  const fit = () => { if (review()?.ready && state.autoFit) review().aim(state.camera === 'free' ? 'front' : state.camera); };
  const schedule = () => {
    if (state.queued) return;
    state.queued = true; win.requestAnimationFrame(() => { state.queued = false; sync(); });
  };
  function activate(id, focus = false) {
    if (state.active !== id) { state.active = id; state.signature = ''; panel.scrollTop = 0; }
    sync(); if (focus) slotNodes.get(id).button.focus();
  }
  for (const [id, label] of GROUPS) {
    const button = make('button', 'character-review-slot'); button.type = 'button'; button.id = `character-slot-${id}`;
    button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', panel.id);
    const caption = make('small', '', label), value = make('strong', '', '読込中');
    button.append(caption, value); button.addEventListener('click', () => activate(id)); slots.append(button);
    slotNodes.set(id, { button, value });
  }
  slots.addEventListener('keydown', event => {
    const entries = [...slotNodes.values()].map(row => row.button), current = entries.indexOf(event.target);
    if (current < 0 || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
    event.preventDefault(); const next = gridFocusIndex(entries, current, event.key); activate(GROUPS[next][0], true);
  });
  const actionNodes = ['original-preview', 'random-one', 'undo', 'redo'].map(id => {
    const source = doc.getElementById(id); if (!source) return null;
    const button = make('button', 'character-review-action'); button.type = 'button'; button.dataset.reviewAction = id;
    button.addEventListener('click', () => { if (!source.matches(':disabled')) source.click(); schedule(); });
    tools.append(button); return { source, button, id };
  }).filter(Boolean);
  function choose(group, option) {
    // Re-check the live source; a load/rebuild may have started since the last paint.
    if (!review()?.ready || !option.source.isConnected || option.source.matches(':disabled')) return;
    option.source.click();
    if (['model','individual','age'].includes(group.id)) { state.camera = 'front'; state.autoFit = true; }
    if (group.id === 'part' && state.camera === 'free') { state.camera = 'front'; state.autoFit = true; }
    // The legacy hair/face category handler zooms in. Keep the explicitly chosen camera instead.
    if (['model','individual','age','part'].includes(group.id)) win.requestAnimationFrame(fit);
    schedule();
  }
  function renderOptions(group) {
    const focused = grid.contains(doc.activeElement) ? doc.activeElement?.dataset.optionKey : null;
    grid.replaceChildren(...group.options.map(option => {
      const button = make('button', 'character-review-option'); button.type = 'button'; button.dataset.optionKey = option.key; button.dataset.group = group.id;
      button.disabled = option.disabled; button.title = option.fullLabel; button.setAttribute('aria-label', option.fullLabel);
      button.setAttribute('aria-pressed', String(option.selected));
      const mark = make('span', 'character-review-mark', optionMark(group, option)); mark.setAttribute('aria-hidden', 'true');
      if (option.swatch) { mark.classList.add('is-swatch'); mark.style.backgroundColor = option.swatch; }
      const name = make('span', 'character-review-option-label', option.label); button.append(mark, name);
      button.addEventListener('click', () => choose(group, option)); return button;
    }));
    const buttons = [...grid.children], selected = group.options.findIndex(option => option.selected && !option.disabled);
    const first = selected >= 0 ? selected : group.options.findIndex(option => !option.disabled);
    buttons.forEach((button, index) => { button.tabIndex = index === first ? 0 : -1; });
    if (focused !== null) buttons.find(button => button.dataset.optionKey === focused && !button.disabled)?.focus({ preventScroll: true });
  }
  grid.addEventListener('keydown', event => {
    const buttons = [...grid.children], current = buttons.indexOf(event.target);
    if (current < 0 || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
    event.preventDefault(); const next = gridFocusIndex(buttons, current, event.key);
    buttons.forEach((button, index) => { button.tabIndex = index === next ? 0 : -1; }); buttons[next]?.focus();
  });
  function sync() {
    const ready = Boolean(review()?.ready); state.groups = readCharacterReviewGroups(doc, ready);
    for (const group of state.groups) {
      const { button, value } = slotNodes.get(group.id); text(value, group.value);
      attr(button, 'aria-selected', group.id === state.active); button.tabIndex = group.id === state.active ? 0 : -1;
      attr(button, 'aria-label', `${group.label}：${group.value}。候補を表示`); button.title = `${group.label}：${group.value}`;
    }
    const group = state.groups.find(item => item.id === state.active);
    text(heading, `${group.label} / ${group.value}　候補 ${group.options.length}件`);
    attr(panel, 'aria-labelledby', `character-slot-${group.id}`); attr(panel, 'aria-busy', !ready);
    const signature = JSON.stringify([group.id, group.options.map(({ key, label, fullLabel, selected, disabled, swatch }) => [key,label,fullLabel,selected,disabled,swatch])]);
    const sourceChanged = group.options.some((option, index) => option.source !== state.sources?.[index]);
    if (signature !== state.signature || sourceChanged) { state.signature = signature; state.sources = group.options.map(option => option.source); renderOptions(group); }
    empty.hidden = group.options.length > 0; text(empty, ready ? 'この項目に候補はありません。' : 'モデルを読み込んでいます。');
    for (const { source, button, id } of actionNodes) {
      button.disabled = !ready || source.matches(':disabled');
      const comparing = source.getAttribute('aria-pressed') === 'true';
      text(button, id === 'original-preview' ? comparing ? '編集に戻す' : '元と比較'
        : id === 'random-one' ? '組み替え'
          : id === 'undo' ? '↶ 戻す'
            : id === 'redo' ? '↷ やり直す'
              : source.textContent);
      if (id === 'original-preview') attr(button, 'aria-pressed', comparing);
    }
    for (const button of cameraButtons) attr(button, 'aria-pressed', button.dataset.camera === state.camera);
    if (!ready) state.framed = false;
    if (ready && !state.framed) { state.framed = true; win.requestAnimationFrame(fit); }
  }
  const observer = new win.MutationObserver(schedule);
  for (const node of [fields, doc.querySelector('.editor-footer'), doc.querySelector('.stage-actions')].filter(Boolean)) {
    observer.observe(node, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['aria-pressed','disabled'] });
  }
  win.addEventListener('character-workspace-change', schedule); win.addEventListener('character-review-change', schedule);
  const canvas = doc.getElementById('stage');
  const freeCamera = () => { state.autoFit = false; state.camera = 'free'; schedule(); };
  canvas?.addEventListener('pointerdown', freeCamera); canvas?.addEventListener('wheel', freeCamera, { passive: true });
  for (const button of cameraButtons) button.addEventListener('click', () => { state.camera = button.dataset.camera; state.autoFit = true; schedule(); });
  doc.getElementById('frame-model')?.addEventListener('click', () => { state.camera = 'overview'; state.autoFit = true; schedule(); });
  let resizeObserver;
  if (canvas && win.ResizeObserver) { resizeObserver = new win.ResizeObserver(() => win.requestAnimationFrame(fit)); resizeObserver.observe(canvas); }
  win.addEventListener('pagehide', event => { if (!event.persisted) { observer.disconnect(); resizeObserver?.disconnect(); } });
  doc.body.classList.add('character-grid-ready');
  controls.removeAttribute('tabindex'); controls.setAttribute('aria-label', '選択スロットと5列の候補一覧');
  sync(); return true;
}
