import './character-review.js';
import { APPEARANCE_PARTS, YEAR_MS } from '@soul/characters';
import { createCharacterWorkspace, downloadWorkspace } from './character-workspace.js';

const el = id => document.getElementById(id);
const make = (tag, text, className = '') => { const n = document.createElement(tag); n.textContent = text; n.className = className; return n; };
const button = (text, action) => { const b = make('button', text); b.type = 'button'; b.addEventListener('click', () => safe(action)); return b; };
const slots = { face: '顔', hair: '髪', body: '体型', outfit: '服', accessory: '装飾' };
const titles = { face: '顔の比率', hair: '髪型', body: '体型', outfit: '上着', accessory: 'アクセサリ' };
const hints = { face: '現在は顔全体の比率調整です。目鼻を個別に作り変える機能ではありません。', hair: '髪は初期パーツです。細部はモデルを回して確認できます。', body: '体型の比率だけを変更します。ゲームの当たり判定は変えません。', outfit: '制服は残したまま、上に重ねる衣装を切り替えます。', accessory: '選択中の1体だけに適用されます。' };
const expressionLabels = { happy: '笑顔', angry: '怒り', sad: '悲しみ', relaxed: '穏やか', surprised: '驚き', neutral: '通常', blink: 'まばたき', blinkLeft: '左目', blinkRight: '右目', aa: 'あ', ih: 'い', ou: 'う', ee: 'え', oh: 'お', lookUp: '上を見る', lookDown: '下を見る', lookLeft: '左を見る', lookRight: '右を見る' };
let studio, currentTab = 'parts', slot = 'hair', wasReady = false, individualsCount = 0, toastTimer;
function toast(message) { el('toast').textContent = message; el('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el('toast').hidden = true; }, 2800); }
function safe(action) { try { action(); } catch (error) { toast(error.message); } }
function aimForSlot() { if (!studio?.review.ready) return; studio.review.aim(['face', 'hair'].includes(slot) ? 'face' : 'front'); }
function buildOptions() {
  el('slot-title').textContent = titles[slot]; el('slot-hint').textContent = hints[slot];
  el('part-options').setAttribute('aria-label', `${titles[slot]}の候補`);
  el('part-options').replaceChildren(...APPEARANCE_PARTS[slot].map(row => {
    const b = button(row.label, () => { studio.workspace.change(slot, row.id); });
    b.dataset.modularSlot = slot; b.dataset.modularValue = row.id; b.append(make('span', '選択中', 'tick')); return b;
  }));
  for (const b of document.querySelectorAll('[data-slot]')) b.setAttribute('aria-pressed', String(b.dataset.slot === slot));
  render();
}
function activate(tab, focus = false) {
  currentTab = tab;
  for (const b of document.querySelectorAll('[data-tab]')) {
    const selected = b.dataset.tab === tab; b.setAttribute('aria-selected', String(selected)); b.tabIndex = selected ? 0 : -1;
    if (focus && selected) b.focus();
  }
  for (const p of document.querySelectorAll('.studio-panel')) p.hidden = p.id !== `panel-${tab}`;
  document.querySelector('.review-controls').scrollTop = 0;
  if (studio && tab !== 'compare') { studio.workspace.configure({ view: 'single' }); if (tab === 'parts') aimForSlot(); else studio.review.aim('front'); }
  render();
}
function render() {
  if (!studio) return;
  const { review, workspace: w } = studio, settings = review.settings, record = w.selected;
  el('editor-fields').disabled = !review.ready;
  for (const id of ['hero-previous', 'hero-next', 'frame-model', 'save-workspace']) el(id).disabled = !review.ready;
  el('undo').disabled = !review.ready || !w.history.canUndo; el('redo').disabled = !review.ready || !w.history.canRedo;
  el('save-state').textContent = w.saveMessage;
  if (!record) return;
  el('selection-summary').textContent = `個体 ${String(settings.selected + 1).padStart(2, '0')} · ${record.ageMs / YEAR_MS}歳`;
  const p = w.getProfile();
  for (const b of document.querySelectorAll('[data-modular-value]')) b.setAttribute('aria-pressed', String(p[slot] === b.dataset.modularValue));
  el('original-preview').setAttribute('aria-pressed', String(w.previewing));
  el('original-preview').textContent = w.previewing ? '編集した姿に戻す' : '元のパーツと比較'; el('preview-label').hidden = !w.previewing;
  for (const b of document.querySelectorAll('[data-gene]')) {
    const pair = record.genome[b.dataset.gene], index = Math.min(3, Math.floor((pair[0] + pair[1]) / 131070 * 4));
    b.setAttribute('aria-pressed', String(index === Number(b.dataset.palette)));
  }
  for (const b of document.querySelectorAll('[data-dye]')) b.setAttribute('aria-pressed', String(record.outfitId === `shino.uniform.${b.dataset.dye}.v1`));
  for (const b of document.querySelectorAll('[data-age]')) b.setAttribute('aria-pressed', String(record.ageMs / YEAR_MS === Number(b.dataset.age)));
  for (const b of document.querySelectorAll('[data-count]')) { b.setAttribute('aria-pressed', String(Number(b.dataset.count) === (settings.view === 'single' ? 1 : settings.count))); b.disabled = Number(b.dataset.count) > review.records.length; }
  for (const b of document.querySelectorAll('[data-motion]')) b.setAttribute('aria-pressed', String(b.dataset.motion === settings.motion));
  for (const b of document.querySelectorAll('[data-expression]')) b.setAttribute('aria-pressed', String(b.dataset.expression === settings.expression));
  el('spring-toggle').setAttribute('aria-pressed', String(settings.springs !== 'off')); el('spring-toggle').textContent = settings.springs === 'off' ? '揺れ OFF' : '揺れ ON';
  el('rotate-toggle').setAttribute('aria-pressed', String(settings.rotate)); el('rotate-toggle').textContent = settings.rotate ? '自動回転 ON' : '自動回転 OFF';
  el('full-springs').setAttribute('aria-pressed', String(settings.springs === 'all'));
  if (individualsCount !== settings.count) {
    individualsCount = settings.count;
    el('individuals').replaceChildren(...Array.from({ length: settings.count }, (_, i) => {
      const b = button(String(i + 1).padStart(2, '0'), () => w.configure({ selected: i })); b.dataset.individual = String(i); b.setAttribute('aria-label', `個体${i + 1}を選ぶ`); return b;
    }));
  }
  for (const b of document.querySelectorAll('[data-individual]')) b.setAttribute('aria-pressed', String(Number(b.dataset.individual) === settings.selected));
  if (review.ready && !wasReady) { wasReady = true; if (currentTab === 'parts') aimForSlot(); }
}
function init() {
  const review = window.masterCharacterReview; if (!review?.session) return;
  const workspace = createCharacterWorkspace(review); studio = { review, workspace }; window.characterStudio = studio;
  for (const [id, label] of Object.entries(slots)) {
    const b = button(label, () => { slot = id; workspace.configure({ view: 'single' }); buildOptions(); aimForSlot(); }); b.dataset.slot = id; el('slot-tabs').append(b);
  }
  const palettes = {
    hair: ['髪色', [['黒','#322c27'],['茶','#66482f'],['金','#c5a66a'],['青黒','#43415d']]],
    eyes: ['瞳', [['茶','#956746'],['青','#668bb0'],['緑','#779c77'],['紫','#a5799e']]],
    skin: ['肌', [['明るい','#f6ded3'],['中間','#d5b7a0'],['褐色','#b68f77'],['濃い','#8e6954']]]
  };
  for (const [gene, [label, rows]] of Object.entries(palettes)) {
    el('color-options').append(make('h3', label)); const grid = make('div', '', 'swatches');
    rows.forEach(([name, color], i) => { const b = button(name, () => workspace.edit({ [gene]: (i + .5) / 4 })); b.className = 'swatch'; b.dataset.gene = gene; b.dataset.palette = String(i); const dot = make('i', ''); dot.style.backgroundColor = color; dot.setAttribute('aria-hidden','true'); b.prepend(dot); grid.append(b); });
    el('color-options').append(grid);
  }
  el('color-options').append(make('h3', '服の配色')); const dyes = make('div', '', 'choice-row');
  for (const [id, label] of [['original','元の色'],['moss','苔色'],['ember','赤茶']]) { const b = button(label, () => workspace.edit({ outfit: id })); b.dataset.dye = id; dyes.append(b); } el('color-options').append(dyes);
  for (const age of [0, 7, 15, 22, 55, 85]) { const b = button(`${age}歳`, () => { workspace.edit({ age }); review.aim('front'); }); b.dataset.age = String(age); el('age-options').append(b); }
  for (const b of document.querySelectorAll('[data-tab]')) b.addEventListener('click', () => safe(() => activate(b.dataset.tab)));
  document.querySelector('.mode-tabs').addEventListener('keydown', event => {
    const tabs = ['parts','colors','motion','compare']; let index = tabs.indexOf(currentTab);
    if (event.key === 'ArrowRight') index = (index + 1) % tabs.length; else if (event.key === 'ArrowLeft') index = (index + tabs.length - 1) % tabs.length; else if (event.key === 'Home') index = 0; else if (event.key === 'End') index = tabs.length - 1; else return;
    event.preventDefault(); safe(() => activate(tabs[index], true));
  });
  const actions = {
    'hero-previous': () => { workspace.configure({ selected: (review.settings.selected + review.settings.count - 1) % review.settings.count }); if (currentTab === 'parts') aimForSlot(); },
    'hero-next': () => { workspace.configure({ selected: (review.settings.selected + 1) % review.settings.count }); if (currentTab === 'parts') aimForSlot(); },
    'frame-model': () => review.aim('overview'), 'original-preview': () => workspace.previewOriginal(), 'random-one': () => workspace.randomize(),
    undo: () => workspace.undo(), redo: () => workspace.redo(), 'edit-one': () => activate('parts'),
    'save-workspace': () => { workspace.save(); downloadWorkspace(workspace.snapshot()); toast('顔・髪・服を含む編集データを保存しました'); },
    'spring-toggle': () => workspace.configure({ springs: review.settings.springs === 'off' ? 'auto' : 'off' }),
    'rotate-toggle': () => workspace.configure({ rotate: !review.settings.rotate }),
    'full-springs': () => workspace.configure({ springs: review.settings.springs === 'all' ? 'auto' : 'all' })
  };
  for (const [id, action] of Object.entries(actions)) el(id).addEventListener('click', () => safe(action));
  for (const b of document.querySelectorAll('[data-count]')) b.addEventListener('click', () => safe(() => {
    const count = Number(b.dataset.count); workspace.configure(count === 1 ? { view: 'single' } : { count, view: 'crowd' }); review.aim('overview');
  }));
  for (const b of document.querySelectorAll('[data-motion]')) b.addEventListener('click', () => safe(() => workspace.configure({ motion: b.dataset.motion })));
  function expressions() {
    el('expression-grid').replaceChildren(...[...el('expression').options].map(option => {
      const b = button((expressionLabels[option.value] ?? option.value) || '通常', () => { workspace.configure({ expression: option.value, expressionMode: 'selected' }); review.aim('face'); });
      b.dataset.expression = option.value; return b;
    })); render();
  }
  new MutationObserver(expressions).observe(el('expression'), { childList: true });
  new MutationObserver(() => { el('metrics-live').textContent = el('metrics').textContent; }).observe(el('metrics'), { childList: true, characterData: true, subtree: true });
  window.addEventListener('character-workspace-change', render);
  buildOptions(); expressions(); activate('parts'); render();
}
try { init(); } catch (error) { toast(error.message); }
