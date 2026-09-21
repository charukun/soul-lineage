import './character-review-grid.css';

const GROUPS = Object.freeze([
  ['model', 'モデル', '#character-model-options [data-character-model]', '人'],
  ['individual', '個体差', '#individuals [data-individual]', '個'],
  ['part', '部位', '#slot-tabs [data-slot]', '部'],
  ['variant', '形状', '#part-options [data-modular-value]', '形'],
  ['age', '年齢差', '#age-options [data-age]', '歳'],
  ['hair', '髪', '#color-options [data-gene="hair"]', '髪'],
  ['eyes', '瞳', '#color-options [data-gene="eyes"]', '瞳'],
  ['skin', '肌', '#color-options [data-gene="skin"]', '肌'],
  ['dye', '服色', '#color-options [data-dye]', '衣']
]);

const DETAIL_GROUPS = GROUPS.filter(([id]) => id !== 'model');

export const REVIEW_SECTIONS = Object.freeze([
  Object.freeze({ id: 'overall', label: '全体', groups: Object.freeze(['individual','age']) }),
  Object.freeze({ id: 'face', label: '顔', groups: Object.freeze(['hair','eyes','skin']) }),
  Object.freeze({ id: 'outfit', label: '服・パーツ', groups: Object.freeze(['part','variant','dye']) })
]);

const sectionForGroup = id => REVIEW_SECTIONS.find(section => section.groups.includes(id)) || REVIEW_SECTIONS[0];

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
  const canvasWrap = doc.querySelector('.canvas-wrap');
  const cameraDock = doc.createElement('div');
  cameraDock.className = 'character-review-camera-dock review-surface__stage-tools';
  cameraDock.setAttribute('aria-label', 'モデルの向き');
  for (const node of [doc.getElementById('camera-cycle'), doc.getElementById('pause'), actions?.querySelector('[data-camera="overview"]')].filter(Boolean)) {
    node.hidden = true;
    node.setAttribute('aria-hidden', 'true');
  }
  if (frameButton) {
    frameButton.textContent = '全身';
    frameButton.title = 'モデル全体を表示';
  }
  const cameraButtons = [...doc.querySelectorAll('.stage-actions [data-camera="front"],.stage-actions [data-camera="side"],.stage-actions [data-camera="back"],.stage-actions [data-camera="face"]')];
  for (const button of cameraButtons) {
    button.hidden = false;
    button.removeAttribute('aria-hidden');
    button.classList.remove('simple-review-technical');
    cameraDock.append(button);
  }
  if (frameButton) {
    frameButton.hidden = false;
    frameButton.removeAttribute('aria-hidden');
    frameButton.classList.remove('simple-review-technical');
    cameraDock.append(frameButton);
  }
  if (canvasWrap && cameraDock.children.length) canvasWrap.append(cameraDock);
  const stageStatus = doc.querySelector('.stage-status');
  if (stageStatus) stageStatus.classList.add('review-surface__stage-status');
  if (canvasWrap && stageStatus && !canvasWrap.contains(stageStatus)) canvasWrap.append(stageStatus);
  if (actions) actions.hidden = true;
  if (subjectRow) subjectRow.classList.add('character-review-pager','character-review-target-pager');
  const make = (tag, className, text = '') => {
    const node = doc.createElement(tag); node.className = className; node.textContent = text; return node;
  };
  const attr = (node, name, value) => { if (node.getAttribute(name) !== String(value)) node.setAttribute(name, String(value)); };
  const text = (node, value) => { if (node.textContent !== value) node.textContent = value; };
  const root = make('section', 'character-review-picker'); root.id = 'character-review-picker';
  root.setAttribute('aria-label', 'キャラクターモデル一覧とレビュー');
  const modelPicker = make('section', 'character-model-picker character-model-browser'); modelPicker.setAttribute('aria-label', '使えるキャラクターモデル');
  const modelHeading = make('div', 'character-model-picker-heading');
  modelHeading.append(make('strong', '', 'キャラモデル'), make('span', 'character-model-picker-current', '読込中'));
  const modelGrid = make('div', 'character-model-grid review-choice-grid'); modelGrid.setAttribute('role', 'listbox'); modelGrid.setAttribute('aria-label', 'キャラクターモデル一覧');
  modelPicker.append(modelHeading, modelGrid);
  const tools = make('div', 'character-review-tools character-model-review-actions'); tools.setAttribute('aria-label', 'モデルレビュー操作');
  const prevModelButton = make('button', 'character-model-nav', '‹ 前'); prevModelButton.type = 'button';
  const okButton = make('button', 'character-review-decision character-review-decision--ok', 'OK'); okButton.type = 'button'; okButton.dataset.reviewDecision = 'ok';
  const fixButton = make('button', 'character-review-decision character-review-decision--fix', '要修正'); fixButton.type = 'button'; fixButton.dataset.reviewDecision = 'fix';
  const nextModelButton = make('button', 'character-model-nav character-model-nav--next', '次 ›'); nextModelButton.type = 'button';
  tools.append(prevModelButton, okButton, fixButton, nextModelButton);
  const details = make('details', 'character-review-details');
  const detailsSummary = make('summary', 'character-review-details-summary', '詳細確認');
  const detailsBody = make('div', 'character-review-details-body');
  if (subjectRow) detailsBody.append(subjectRow);
  const sectionTabs = make('nav', 'character-review-section-tabs'); sectionTabs.setAttribute('role', 'tablist'); sectionTabs.setAttribute('aria-label', '確認する範囲');
  const slots = make('nav', 'character-review-slots review-slot-tabs'); slots.setAttribute('role', 'tablist'); slots.setAttribute('aria-label', '確認する項目');
  const heading = make('div', 'character-review-current review-selection-current'); heading.id = 'character-review-current'; heading.setAttribute('role', 'status');
  const panel = make('section', 'character-review-candidates'); panel.id = 'character-review-candidates'; panel.setAttribute('role', 'tabpanel');
  const grid = make('div', 'character-review-grid review-choice-grid'); grid.setAttribute('role', 'group'); grid.setAttribute('aria-labelledby', heading.id);
  const empty = make('p', 'character-review-empty', 'モデルを読み込んでいます。'); panel.append(grid, empty);
  detailsBody.append(sectionTabs, slots, heading, panel); details.append(detailsSummary, detailsBody);
  root.append(modelPicker, tools, details); controls.prepend(root);
  const state = { section: 'overall', active: 'individual', camera: 'front', framed: false, autoFit: true, queued: false, signature: '', modelSignature: '', groups: [], modelVerdicts: new Map() };
  const sectionNodes = new Map(), slotNodes = new Map();
  const review = () => win.characterStudio?.review;
  const fit = () => { if (review()?.ready && state.autoFit) review().aim(state.camera === 'free' ? 'front' : state.camera); };
  const fitAfterLayout = () => { win.requestAnimationFrame(() => win.requestAnimationFrame(fit)); };
  const schedule = () => {
    if (state.queued) return;
    state.queued = true; win.requestAnimationFrame(() => { state.queued = false; sync(); });
  };
  function activate(id, focus = false) {
    if (state.active !== id) { state.active = id; state.signature = ''; panel.scrollTop = 0; }
    state.section = sectionForGroup(id).id;
    sync(); if (focus) slotNodes.get(id)?.button.focus();
  }
  function activateSection(id, focus = false) {
    const section = REVIEW_SECTIONS.find(row => row.id === id) || REVIEW_SECTIONS[0];
    state.section = section.id;
    if (!section.groups.includes(state.active)) state.active = section.groups[0];
    state.signature = ''; panel.scrollTop = 0; sync();
    if (focus) sectionNodes.get(section.id)?.focus();
  }
  for (const section of REVIEW_SECTIONS) {
    const button = make('button', 'character-review-section'); button.type = 'button'; button.id = `character-section-${section.id}`;
    button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', slots.id || 'character-review-slots');
    button.textContent = section.label; button.addEventListener('click', () => activateSection(section.id)); sectionTabs.append(button);
    sectionNodes.set(section.id, button);
  }
  sectionTabs.addEventListener('keydown', event => {
    const entries = [...sectionNodes.values()], current = entries.indexOf(event.target);
    if (current < 0 || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault(); const next = gridFocusIndex(entries.map(() => ({disabled:false})), current, event.key, REVIEW_SECTIONS.length);
    activateSection(REVIEW_SECTIONS[next].id, true);
  });
  slots.id = 'character-review-slots';
  for (const [id, label] of DETAIL_GROUPS) {
    const button = make('button', 'character-review-slot'); button.type = 'button'; button.id = `character-slot-${id}`;
    button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', panel.id);
    const caption = make('small', '', label), value = make('strong', '', '読込中');
    button.append(caption, value); button.addEventListener('click', () => activate(id)); slots.append(button);
    slotNodes.set(id, { button, value });
  }
  slots.addEventListener('keydown', event => {
    const ids = sectionForGroup(state.active).groups;
    const entries = ids.map(id => slotNodes.get(id)?.button).filter(Boolean), current = entries.indexOf(event.target);
    if (current < 0 || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault(); const next = gridFocusIndex(entries.map(button => ({ disabled: button.disabled })), current, event.key, entries.length);
    activate(ids[next], true);
  });
  const currentModelGroup = () => state.groups.find(item => item.id === 'model');
  const currentModelOption = () => currentModelGroup()?.options.find(option => option.selected) || currentModelGroup()?.options[0];
  const stepModel = delta => {
    const group = currentModelGroup(); if (!group?.options.length) return;
    const current = Math.max(0, group.options.findIndex(option => option.selected));
    let next = current;
    for (let i = 0; i < group.options.length; i++) {
      next = (next + delta + group.options.length) % group.options.length;
      if (!group.options[next].disabled) { choose(group, group.options[next]); return; }
    }
  };
  const applyDecision = verdict => {
    const option = currentModelOption(); if (!option || option.disabled) return;
    state.modelVerdicts.set(option.key, verdict); schedule();
    stepModel(1);
  };
  prevModelButton.addEventListener('click', () => stepModel(-1));
  nextModelButton.addEventListener('click', () => stepModel(1));
  okButton.addEventListener('click', () => applyDecision('ok'));
  fixButton.addEventListener('click', () => applyDecision('fix'));
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
  function renderModelOptions(group) {
    const focused = modelGrid.contains(doc.activeElement) ? doc.activeElement?.dataset.modelKey : null;
    modelGrid.replaceChildren(...group.options.map((option, index) => {
      const button = make('button', 'character-model-card'); button.type = 'button'; button.dataset.modelKey = option.key; button.dataset.modelIndex = String(index);
      button.disabled = option.disabled; button.title = option.fullLabel; button.setAttribute('role', 'option'); button.setAttribute('aria-label', option.fullLabel);
      button.setAttribute('aria-selected', String(option.selected));
      const icon = make('span', 'character-model-card-icon', ''); icon.setAttribute('aria-hidden', 'true');
      const label = make('span', 'character-model-card-label', option.label);
      const verdict = make('span', 'character-model-card-verdict', '');
      const stateVerdict = state.modelVerdicts.get(option.key);
      if (stateVerdict) { button.dataset.verdict = stateVerdict; verdict.textContent = stateVerdict === 'ok' ? 'OK' : '要修正'; }
      button.append(icon, label, verdict);
      button.addEventListener('click', () => choose(group, option)); return button;
    }));
    const buttons = [...modelGrid.children], selected = group.options.findIndex(option => option.selected && !option.disabled);
    buttons.forEach((button, index) => { button.tabIndex = index === (selected >= 0 ? selected : 0) ? 0 : -1; });
    if (focused !== null) buttons.find(button => button.dataset.modelKey === focused && !button.disabled)?.focus({ preventScroll: true });
  }
  modelGrid.addEventListener('keydown', event => {
    const buttons = [...modelGrid.children], current = buttons.indexOf(event.target);
    if (current < 0 || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
    event.preventDefault(); const next = gridFocusIndex(buttons.map(button => ({ disabled: button.disabled })), current, event.key);
    buttons.forEach((button, index) => { button.tabIndex = index === next ? 0 : -1; }); buttons[next]?.focus();
  });

  function renderOptions(group) {
    const focused = grid.contains(doc.activeElement) ? doc.activeElement?.dataset.optionKey : null;
    grid.replaceChildren(...group.options.map(option => {
      const button = make('button', 'character-review-option review-choice-card'); button.type = 'button'; button.dataset.optionKey = option.key; button.dataset.group = group.id;
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
    const modelGroup = state.groups.find(item => item.id === 'model');
    const modelSignature = JSON.stringify(modelGroup.options.map(({ key, label, fullLabel, selected, disabled }) => [key,label,fullLabel,selected,disabled]));
    if (modelSignature !== state.modelSignature) { state.modelSignature = modelSignature; renderModelOptions(modelGroup); }
    text(modelHeading.querySelector('.character-model-picker-current'), `${modelGroup.value} · ${modelGroup.options.length}体`);
    const activeSection = REVIEW_SECTIONS.find(section => section.id === state.section) || sectionForGroup(state.active);
    for (const section of REVIEW_SECTIONS) {
      const button = sectionNodes.get(section.id); attr(button, 'aria-selected', section.id === activeSection.id); button.tabIndex = section.id === activeSection.id ? 0 : -1;
    }
    for (const group of state.groups.filter(item => item.id !== 'model')) {
      const { button, value } = slotNodes.get(group.id); text(value, group.value);
      const visible = activeSection.groups.includes(group.id); button.hidden = !visible;
      attr(button, 'aria-selected', group.id === state.active); button.tabIndex = visible && group.id === state.active ? 0 : -1;
      attr(button, 'aria-label', `${group.label}：${group.value}。候補を表示`); button.title = `${group.label}：${group.value}`;
    }
    const group = state.groups.find(item => item.id === state.active);
    text(heading, `${group.label} / ${group.value}　候補 ${group.options.length}件`);
    attr(panel, 'aria-labelledby', `character-slot-${group.id}`); attr(panel, 'aria-busy', !ready);
    const signature = JSON.stringify([group.id, group.options.map(({ key, label, fullLabel, selected, disabled, swatch }) => [key,label,fullLabel,selected,disabled,swatch])]);
    const sourceChanged = group.options.some((option, index) => option.source !== state.sources?.[index]);
    if (signature !== state.signature || sourceChanged) { state.signature = signature; state.sources = group.options.map(option => option.source); renderOptions(group); }
    empty.hidden = group.options.length > 0; text(empty, ready ? 'この項目に候補はありません。' : 'モデルを読み込んでいます。');
    const currentModel = currentModelOption(), verdict = currentModel ? state.modelVerdicts.get(currentModel.key) : null;
    const decisionDisabled = !ready || !currentModel || currentModel.disabled;
    okButton.disabled = decisionDisabled; fixButton.disabled = decisionDisabled; prevModelButton.disabled = decisionDisabled; nextModelButton.disabled = decisionDisabled;
    attr(okButton, 'aria-pressed', verdict === 'ok'); attr(fixButton, 'aria-pressed', verdict === 'fix');
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
  controls.removeAttribute('tabindex'); controls.setAttribute('aria-label', 'キャラクターモデル一覧とレビュー');
  sync(); fitAfterLayout(); return true;
}
