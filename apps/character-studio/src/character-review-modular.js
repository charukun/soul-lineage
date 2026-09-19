import './character-review-modular.css';
import {
  APPEARANCE_PARTS, BASE_APPEARANCE_PARTS, appearancePartsForCharacter,
  mergeAppearanceParts, nextAppearanceParts
} from '@soul/characters';
import { attachModularAppearanceController } from '@soul/rendering/master-character-modular';

const review = window.masterCharacterReview;
const el = id => document.getElementById(id);
const overrides = new Map(), generations = new Map(), controllers = new WeakMap(), signatures = new WeakMap();
const slotLabels = Object.freeze({ face: '顔立ち', hair: '髪型', body: '体型', outfit: '服の形', accessory: 'アクセサリ' });
const profileSignature = profile => [profile.face, profile.hair, profile.body, profile.outfit, profile.accessory].join('|');
const selectedIndex = () => Math.max(0, Number(el('selected')?.value ?? 0));
const selectedRecord = () => review?.records?.[selectedIndex()] ?? null;
const count = () => Math.max(1, Number(el('count')?.value ?? 1));

function emit(id, value, type = 'change') {
  const control = el(id); if (!control) return;
  if (control.type === 'checkbox') control.checked = Boolean(value); else control.value = String(value);
  control.dispatchEvent(new Event(type, { bubbles: true }));
}
function camera(name) { document.querySelector(`[data-camera="${name}"]`)?.click(); }
function profileFor(record) { return overrides.get(record.id) ?? BASE_APPEARANCE_PARTS; }
function setProfile(record, profile) { overrides.set(record.id, profile); generations.set(record.id, generations.get(record.id) ?? 0); }

function syncActors(force = false) {
  if (!review?.actors?.length || !review?.records?.length) return;
  const records = new Map(review.records.map(record => [record.id, record]));
  for (const actor of review.actors) {
    const record = records.get(actor.id); if (!record) continue;
    let controller = controllers.get(actor);
    if (!controller) { controller = attachModularAppearanceController(actor); controllers.set(actor, controller); }
    const profile = profileFor(record), signature = profileSignature(profile);
    if (force || signatures.get(actor) !== signature) { controller.setProfile(profile); signatures.set(actor, signature); }
  }
}

function make(tag, className = '', text = '') {
  const node = document.createElement(tag); if (className) node.className = className; if (text) node.textContent = text; return node;
}
function makeButton(text, className = '') { const button = make('button', className, text); button.type = 'button'; return button; }
function labelFor(slot, id) { return APPEARANCE_PARTS[slot].find(row => row.id === id)?.label ?? id; }

function reflect() {
  const record = selectedRecord(); if (!record) return;
  const profile = profileFor(record);
  for (const button of document.querySelectorAll('[data-modular-slot]')) {
    const slot = button.dataset.modularSlot;
    button.classList.toggle('is-selected', profile[slot] === button.dataset.modularValue);
  }
  const summary = el('parts-summary');
  if (summary) summary.textContent = [
    `個体 ${selectedIndex() + 1} / seed ${record.seed}`,
    `顔 ${labelFor('face', profile.face)}  ·  髪 ${labelFor('hair', profile.hair)}`,
    `体型 ${labelFor('body', profile.body)}  ·  服 ${labelFor('outfit', profile.outfit)}`,
    `装飾 ${labelFor('accessory', profile.accessory)}`
  ].join('\n');
  const generation = generations.get(record.id) ?? 0;
  if (el('parts-generation')) el('parts-generation').textContent = generation ? `自動バリエーション ${generation}` : '手動または標準Shino';
}

function changeSlot(slot, value) {
  const record = selectedRecord(); if (!record) return;
  setProfile(record, mergeAppearanceParts(profileFor(record), { [slot]: value }));
  syncActors(true); reflect();
}
function autoSelected(next = false) {
  const record = selectedRecord(); if (!record) return;
  const generation = next ? (generations.get(record.id) ?? 0) + 1 : 0;
  generations.set(record.id, generation);
  setProfile(record, generation ? nextAppearanceParts(record, generation) : appearancePartsForCharacter(record));
  syncActors(true); reflect();
}
function autoVisible() {
  for (const record of review.records.slice(0, count())) {
    generations.set(record.id, 0); setProfile(record, appearancePartsForCharacter(record));
  }
  syncActors(true); reflect();
}
function resetSelected() {
  const record = selectedRecord(); if (!record) return;
  overrides.delete(record.id); generations.delete(record.id); syncActors(true); reflect();
}
function resetVisible() {
  for (const record of review.records.slice(0, count())) { overrides.delete(record.id); generations.delete(record.id); }
  syncActors(true); reflect();
}

function selectPartsMode() {
  for (const button of document.querySelectorAll('[data-review-mode]')) button.setAttribute('aria-pressed', String(button.dataset.reviewMode === 'parts'));
  for (const panel of document.querySelectorAll('[data-mode-panel]')) panel.classList.toggle('is-active', panel.dataset.modePanel === 'parts');
  if (el('mode-title')) el('mode-title').textContent = '見た目パーツ';
  if (el('mode-label')) el('mode-label').textContent = '顔・髪・服を確認';
  if (el('mode-description')) el('mode-description').textContent = 'Shinoの共通骨格を維持したまま、顔立ち・髪型・体型・上着シルエット・アクセサリを独立して差し替えます。';
  emit('view', 'single'); camera('front'); reflect();
}

function injectUI() {
  const modeGrid = document.querySelector('.mode-grid'), controls = document.querySelector('.review-controls');
  if (!modeGrid || !controls || document.querySelector('[data-review-mode="parts"]')) return;

  const modeButton = makeButton(''); modeButton.dataset.reviewMode = 'parts'; modeButton.setAttribute('aria-pressed', 'false');
  modeButton.append(make('b', '', '形'), make('span', '', '見た目'));
  modeButton.addEventListener('click', selectPartsMode); modeGrid.insertBefore(modeButton, modeGrid.lastElementChild);

  const panel = make('section', 'mode-panel modular-parts-panel'); panel.dataset.modePanel = 'parts';
  const summary = make('pre', 'parts-summary', '個体を準備中'); summary.id = 'parts-summary'; panel.append(summary);

  for (const [slot, rows] of Object.entries(APPEARANCE_PARTS)) {
    const block = make('div', 'modular-slot'); block.append(make('span', 'group-label', slotLabels[slot]));
    const grid = make('div', 'modular-options');
    for (const row of rows) {
      const button = makeButton(row.label); button.dataset.modularSlot = slot; button.dataset.modularValue = row.id;
      button.addEventListener('click', () => changeSlot(slot, row.id)); grid.append(button);
    }
    block.append(grid); panel.append(block);
  }

  const commands = make('div', 'modular-command-grid');
  const auto = makeButton('選択個体を自動で別人化', 'primary-command'); auto.addEventListener('click', () => autoSelected(false));
  const next = makeButton('次の外見パターン'); next.addEventListener('click', () => autoSelected(true));
  const autoAll = makeButton('表示中の全員を別人化'); autoAll.addEventListener('click', autoVisible);
  const reset = makeButton('選択個体をShinoへ戻す'); reset.addEventListener('click', resetSelected);
  commands.append(auto, next, autoAll, reset); panel.append(commands);

  const compare = make('div', 'modular-compare-grid');
  const one = makeButton('1体で確認'); one.addEventListener('click', () => { emit('view', 'single'); camera('front'); });
  const twelve = makeButton('12体比較'); twelve.addEventListener('click', () => { emit('count', 12); emit('view', 'crowd'); camera('overview'); autoVisible(); });
  const thirty = makeButton('30体比較'); thirty.addEventListener('click', () => { emit('count', 30); emit('view', 'crowd'); camera('overview'); autoVisible(); });
  compare.append(one, twelve, thirty); panel.append(compare);

  const generation = make('p', 'modular-generation', '手動または標準Shino'); generation.id = 'parts-generation'; panel.append(generation);
  const help = make('p', 'panel-help', '元の完全被覆Shino衣装は残し、上着・髪・装飾を骨格へ追加します。ゲームの当たり判定、能力、セーブ、通信は変更しません。'); panel.append(help);
  const resetAll = makeButton('表示中をすべて標準Shinoへ戻す', 'wide-action'); resetAll.addEventListener('click', resetVisible); panel.append(resetAll);

  const performance = controls.querySelector('[data-mode-panel="performance"]'); controls.insertBefore(panel, performance ?? controls.querySelector('.review-meta'));
  reflect();
}

let lastSelected = -1, lastRecordSignature = '';
function tick() {
  syncActors();
  const record = selectedRecord(), currentSelected = selectedIndex(), signature = record ? `${record.id}:${record.revision}:${currentSelected}` : '';
  if (currentSelected !== lastSelected || signature !== lastRecordSignature) { lastSelected = currentSelected; lastRecordSignature = signature; reflect(); }
  requestAnimationFrame(tick);
}

setTimeout(() => { injectUI(); tick(); }, 0);
window.masterCharacterParts = Object.freeze({
  get selected() { const record = selectedRecord(); return record ? profileFor(record) : BASE_APPEARANCE_PARTS; },
  autoSelected, autoVisible, resetSelected, resetVisible,
  setSelected(slot, value) { changeSlot(slot, value); },
  profiles: overrides
});
