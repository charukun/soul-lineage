import './character-review.js';
import { VISUAL_ROLES, APPEARANCE_PARTS, CHARACTER_REFERENCE_MODELS, YEAR_MS } from '@soul/characters';
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
function buildModelOptions() {
  const panel = el('panel-parts'), heading = make('h3', 'キャラモデル'), row = make('div', '', 'choice-row'), note = make('p', '', 'hint');
  heading.id = 'character-model-title'; row.id = 'character-model-options'; row.setAttribute('role', 'group'); row.setAttribute('aria-labelledby', heading.id); note.id = 'character-model-note';
  const generated = button('量産モデル', () => { studio.workspace.configure({ view: 'single' }); studio.workspace.selectModel(null); studio.review.aim('front'); });
  generated.dataset.characterModel = ''; row.append(generated);
  for (const model of Object.values(CHARACTER_REFERENCE_MODELS)) {
    const b = button(model.label, () => { studio.workspace.configure({ view: 'single' }); studio.workspace.selectModel(model.id); studio.review.aim('front'); });
    b.dataset.characterModel = model.id; row.append(b);
  }
  panel.prepend(note); panel.prepend(row); panel.prepend(heading);
}
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
  renderQuality();
  const modelLabel = w.model?.label;
  el('subject').textContent = settings.view === 'single'
    ? `${modelLabel ? `${modelLabel} · ` : ''}1体表示 · 個体 ${settings.selected + 1} / ${settings.count} · ${record.ageMs / YEAR_MS}歳`
    : `個体 ${settings.selected + 1} / ${settings.count} · ${record.ageMs / YEAR_MS}歳`;
  el('selection-summary').textContent = `${modelLabel ? `${modelLabel} · ` : ''}個体 ${String(settings.selected + 1).padStart(2, '0')} · ${record.ageMs / YEAR_MS}歳`;
  const p = w.getProfile();
  for (const b of document.querySelectorAll('[data-character-model]')) b.setAttribute('aria-pressed', String(b.dataset.characterModel === (w.modelId ?? '')));
  if (el('character-model-note')) el('character-model-note').textContent = w.model
    ? `${w.model.note} リファレンス画像は ${w.model.referencePath}。手動で部位を変更するとカスタム編集へ戻ります。`
    : '通常の量産モデルです。seed・遺伝・役割から見た目を生成します。';
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
function renderQuality() {
  const {review, workspace:w}=studio,q=w.quality,record=w.selected,identity=w.getIdentity();
  if(document.activeElement!==el('quality-seed'))el('quality-seed').value=String(review.settings.seed);
  el('quality-context').value=q.context;el('quality-role').value=q.role;el('quality-reference').checked=q.reference;
  el('quality-age').value=review.settings.ages==='mixed'?'mixed':String(review.settings.age);
  const baseline=q.mode==='baseline';el('quality-baseline').textContent=baseline?'強化した量産方式に戻す':'旧方式と比較';el('quality-baseline').setAttribute('aria-pressed',String(baseline));
  const marked=q.marked.includes(record.id);el('quality-mark').textContent=marked?'要修正マークを解除':'この個体を要修正にする';el('quality-mark').setAttribute('aria-pressed',String(marked));
  el('quality-identity').textContent=`${record.id} / seed ${record.seed}\n${w.model?`${w.model.label} / ${w.model.masterId}`:identity?`${VISUAL_ROLES[identity.role]} · ${identity.front} / ${identity.back}`:baseline?'旧方式：色・全体サイズのみ':'Shino基準パーツ'}\n親: ${record.parents.join(' / ')||'なし'}`;
  const r=w.qualityReport();el('quality-report').textContent=`量産 ${r.count}体 + 基準 ${r.referenceCount}体\n髪型 ${r.hairstyles}種 / 輪郭・目 ${r.faceGroups}群 / 役割 ${r.roles}種\n配色を除くシルエット ${r.silhouettes}種\n${r.similar.length?'似た組合せ: '+r.similar.map(ids=>ids.join('・')).join(' / '):'同一シルエットの組合せなし'}\n要修正 ${q.marked.length}体。数値は目安で、見た目の合格証明ではありません。`;
  for(const b of document.querySelectorAll('[data-individual]')){const row=review.records[Number(b.dataset.individual)];b.dataset.qualityMarked=String(q.marked.includes(row.id));b.title=`${row.id} / seed ${row.seed}`;}
}
function init() {
  const review = window.masterCharacterReview; if (!review?.session) return;
  const workspace = createCharacterWorkspace(review); studio = { review, workspace }; window.characterStudio = studio;
  buildModelOptions();
  for(const [id,label] of Object.entries(VISUAL_ROLES))if(!['child','elder'].includes(id))el('quality-role').add(new Option(label,id));
  el('quality-context').addEventListener('change',()=>safe(()=>workspace.setQuality({context:el('quality-context').value})));
  el('quality-role').addEventListener('change',()=>safe(()=>workspace.setQuality({role:el('quality-role').value})));
  el('quality-reference').addEventListener('change',()=>safe(()=>workspace.setQuality({reference:el('quality-reference').checked})));
  el('quality-age').addEventListener('change',()=>safe(()=>workspace.setAges(el('quality-age').value==='mixed'?'mixed':Number(el('quality-age').value))));
  el('quality-generate').addEventListener('click',()=>safe(()=>workspace.generate(Number(el('quality-seed').value))));
  el('quality-family').addEventListener('click',()=>safe(()=>{workspace.configure({ages:'mixed'});workspace.generate(Number(el('quality-seed').value),'family');}));
  el('quality-baseline').addEventListener('click',()=>safe(()=>workspace.setQuality({mode:workspace.quality.mode==='baseline'?'enhanced':'baseline'})));
  el('quality-camera').addEventListener('click',()=>safe(()=>review.aim(workspace.quality.context==='studio'?'overview':workspace.quality.context)));
  el('quality-mark').addEventListener('click',()=>safe(()=>workspace.markSelected()));
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
    const tabs = ['parts','colors','motion','qa','compare']; let index = tabs.indexOf(currentTab);
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
