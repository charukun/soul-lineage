import { STAGES, STAGE_LABELS, stagePrefix, isPostureMotion, reviewTemplate } from './review-contract.js';
import './notebook.css';

const q = selector => document.querySelector(selector);
const master = q('#clip');
const filters = {
  skill: /Attack|Sword|Slash|Melee|Punch|Kick|Strike|Skill|技|攻撃|Idle|Ready|Stance|構え|待機/i,
  reaction: /Hit|Damage|Hurt|Reaction|Startle|被弾|驚/i,
  stance: /Idle|Ready|Stance|Guard|Pose|構え|待機/i,
  parry: /Parry|Guard|Block|Deflect|Counter|受け|防御|パリィ/i,
  shin: /Idle|Talk|Speak|Reaction|Emote|Pose|心/i,
  gi: /Attack|Sword|Slash|Melee|Parry|Skill|技/i,
  tai: /Walk|Run|Sprint|Dash|Hit|Body|体/i,
  move: /Walk|Jog|Move|歩行|移動/i,
  dash: /Run|Sprint|Dash|Jog|走行|ダッシュ/i
};
const defaults = {'stage-jo': /Idle|Ready|Stance|構え/i, 'stage-ha': /Attack|Slash|技 \/ /i, 'stage-kyu': /Attack|Slash|技 \/ /i};
const allOptions = () => [...master.options].filter(o => o.value && !o.disabled);
const status = (text, error = false) => { q('#review-status').textContent = text; q('#review-status').dataset.kind = error ? 'error' : ''; };
const selections = () => Object.fromEntries(STAGES.map(id => [id, q(`#${id}`).value]));
const playValue = value => {
  if (!value || !allOptions().some(o => o.value === value)) { status('対応するモーションは読み込み中、または未収録です。', true); return; }
  if (/^姿勢 \/ (抜刀|納刀)/.test(value)) {
    // Native posture clips are sampled from the game's one-handed sword transition.
    q('#weapon-select').value = 'sword'; q('#weapon-toggle').checked = true;
    q('#weapon-toggle').dispatchEvent(new Event('input', {bubbles: true}));
    document.querySelectorAll('.weapon-chip').forEach(button => button.classList.toggle('active', button.dataset.weapon === 'sword'));
    q('#loop-toggle').checked = false; q('#loop-toggle').dispatchEvent(new Event('change', {bubbles: true}));
  }
  master.value = value;
  master.dispatchEvent(new Event('change', {bubbles: true}));
};

function syncTrigger(select) {
  const trigger = q(`[data-picker-for="${select.id}"]`);
  if (trigger) { trigger.textContent = select.selectedOptions[0]?.textContent || '選択'; trigger.disabled = select.disabled; }
}
function refreshSelectors() {
  const all = allOptions();
  document.querySelectorAll('.review-select').forEach(select => {
    const current = select.value, kind = select.dataset.filter;
    const candidates = all.filter(o => kind === 'draw' || kind === 'sheathe'
      ? isPostureMotion(kind, `${o.value} ${o.textContent}`)
      : filters[kind]?.test(`${o.value} ${o.textContent}`));
    // Do not substitute an unrelated motion when a category is empty.
    select.replaceChildren(...candidates.map(o => new Option(o.textContent, o.value)));
    select.disabled = !candidates.length;
    if (!candidates.length) select.add(new Option('読み込み中／対応モーション未収録', ''));
    else if (candidates.some(o => o.value === current)) select.value = current;
    else if (defaults[select.id]) {
      const preferred = candidates.find(o => defaults[select.id].test(o.value));
      if (preferred) select.value = preferred.value;
    }
    syncTrigger(select);
  });
  document.querySelectorAll('[data-play-select]').forEach(button => {
    const id = button.dataset.playSelect;
    button.disabled = STAGES.includes(id)
      ? STAGES.slice(0, STAGES.indexOf(id) + 1).some(key => !q(`#${key}`).value)
      : !q(`#${id}`)?.value;
  });
  document.querySelectorAll('[data-combat-mode]').forEach(button => { button.disabled = !modeMotion(button.dataset.combatMode); });
}
function modeMotion(mode) {
  return allOptions().find(o=>o.value===(mode==='combat'?'Tidebreak / Idle':'通常 / 自然体'))?.value;
}

// Keep the existing motion picker; never insert asset-provided labels as HTML.
const backdrop = q('#picker-backdrop'), list = q('#picker-list');
let pickerOrigin = null;
function closePicker() { backdrop.hidden = true; pickerOrigin?.focus(); }
function openPicker(select) {
  if (select.disabled) return;
  pickerOrigin = q(`[data-picker-for="${select.id}"]`);
  q('#picker-title').textContent = `${select.getAttribute('aria-label') || select.closest('.stage-row,.single-review,.motion-pair>div')?.querySelector('.stage-mark,label')?.textContent || 'モーション'}を選択`;
  list.replaceChildren(...[...select.options].filter(o => !o.disabled && o.value).map(option => {
    const button = document.createElement('button'); button.type = 'button';
    button.className = `picker-item${option.value === select.value ? ' active' : ''}`;
    const label = document.createElement('span'), code = document.createElement('small');
    label.textContent = option.textContent; code.textContent = option.value; button.append(label, code);
    button.onclick = () => { select.value = option.value; select.dispatchEvent(new Event('change', {bubbles: true})); syncTrigger(select); closePicker(); };
    return button;
  }));
  backdrop.hidden = false; q('#picker-close').focus();
}
q('#picker-close').onclick = closePicker;
backdrop.addEventListener('click', event => { if (event.target === backdrop) closePicker(); });
backdrop.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); closePicker(); } });

document.querySelectorAll('.review-select').forEach(select => {
  select.hidden = true;
  const trigger = document.createElement('button'); trigger.type = 'button'; trigger.className = 'picker-trigger';
  trigger.dataset.pickerFor = select.id; trigger.textContent = '選択'; trigger.onclick = () => openPicker(select); select.after(trigger);
  select.addEventListener('change', () => {
    syncTrigger(select); refreshSelectors();
    // Stance/reaction/axis instant playback is owned by review-ux.js.
    if (['draw', 'sheathe'].includes(select.dataset.filter)) playValue(select.value);
  });
});

document.querySelectorAll('[data-review-tab]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-review-tab]').forEach(tab => {
    tab.classList.toggle('active', tab === button); tab.setAttribute('aria-selected', String(tab === button));
  });
  document.querySelectorAll('[data-review-page]').forEach(page => page.classList.toggle('active', page.dataset.reviewPage === button.dataset.reviewTab));
}));
document.querySelectorAll('[data-combat-mode]').forEach(button=>button.addEventListener('click',()=>{
  document.dispatchEvent(new CustomEvent('review-combat-mode',{detail:{mode:button.dataset.combatMode}}));
}));

const dialog = q('#review-feedback-dialog'), editor = q('#review-feedback-text'), feedbackStatus = q('#review-feedback-status');
const drafts = new Map();
let context = null, draftKey = '', feedbackOrigin = null;
const text = id => q(id)?.textContent || '';
function reviewContext(id) {
  const select = id ? document.getElementById(id) : null;
  const page = select?.closest('[data-review-page]') || q('[data-review-page].active');
  const pageName = page?.dataset.reviewPage;
  const labels = {posture: '姿勢', skill: '技構成', reaction: '被弾', stance: '構え', parry: 'パリィ', axis: '心技体', move: '移動', advanced: '詳細'};
  const names = selections(), index = STAGES.indexOf(id), snapshot = window.__reviewLab?.snapshot?.();
  return {
    tab: labels[pageName] || pageName,
    target: index >= 0 ? STAGE_LABELS[index] : select?.getAttribute('aria-label') || select?.closest('.motion-pair>div')?.querySelector('label')?.textContent || labels[pageName],
    motion: select?.value || master.value || '静止比較', model: q('#preset').selectedOptions[0]?.textContent,
    source: text('#source-label'), build: text('#build-label'),
    weapon: q('#weapon-toggle').checked ? q('#weapon-select').selectedOptions[0]?.textContent : 'なし',
    composition: STAGES.map((key, i) => `${STAGE_LABELS[i]}=${names[key] || '未選択'}`).join(' → '),
    sequence: snapshot?.sequence?.length ? snapshot.sequence.join(' → ') : master.value || '静止比較',
    active: snapshot?.clip || master.value, time: text('#current-time'), duration: text('#duration'),
    speed: q('#speed').value, loop: q('#loop-toggle').checked, url: window.__reviewLab?.stateURL?.() || location.href
  };
}
function openFeedback(id, origin) {
  context = reviewContext(id); feedbackOrigin = origin;
  draftKey = JSON.stringify([context.build, context.model, context.tab, id || 'current', context.motion, context.composition, context.weapon]);
  editor.value = drafts.get(draftKey) ?? reviewTemplate(context, {note: q('#review-note').value});
  q('#review-feedback-title').textContent = `指摘する — ${context.target || 'モーション'}`;
  feedbackStatus.textContent = ''; q('#review-feedback-manual').hidden = true;
  dialog.showModal(); q('#review-feedback-close').focus();
}
editor.addEventListener('input', () => drafts.set(draftKey, editor.value));
q('#review-feedback-close').onclick = () => dialog.close();
dialog.addEventListener('close', () => { drafts.set(draftKey, editor.value); feedbackOrigin?.focus(); });
async function copyFeedback(value) {
  feedbackStatus.textContent = '';
  try {
    // Keep the clipboard call inside the user's button gesture (mobile Safari too).
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
    await navigator.clipboard.writeText(value);
  } catch {
    const manual = q('#review-feedback-manual');
    manual.hidden = false; manual.value = value; manual.focus(); manual.select(); manual.setSelectionRange(0, value.length);
    let copied = false;
    try { copied = document.execCommand('copy'); } catch { /* Leave selectable text visible. */ }
    if (!copied) { feedbackStatus.textContent = '自動コピーが許可されませんでした。下の選択済みテキストを長押ししてコピーしてください。'; return; }
    manual.hidden = true; editor.focus();
  }
  feedbackStatus.textContent = 'コピーしました'; status('レビュー情報をコピーしました');
}
q('#review-feedback-copy').onclick = () => copyFeedback(editor.value);
q('#review-feedback-ok').onclick = () => copyFeedback(reviewTemplate(context, {approved: true}));

document.querySelectorAll('[data-play-select]').forEach(button => {
  const id = button.dataset.playSelect;
  button.addEventListener('click', () => {
    if (!STAGES.includes(id)) return playValue(q(`#${id}`).value);
    try {
      const names = stagePrefix(id, selections());
      document.dispatchEvent(new CustomEvent('review-play-sequence', {detail: {names}}));
    } catch (error) { status(error.message, true); }
  });
  const report = document.createElement('button'); report.type = 'button'; report.className = 'copy-slot';
  report.dataset.reportSelect = id; report.textContent = '指摘する'; report.onclick = () => openFeedback(id, report); button.after(report);
});
for (const id of ['#copy-motion', '#copy-review']) {
  const button = q(id); button.textContent = '指摘する'; button.addEventListener('click', () => openFeedback(null, button));
}
const presetIds = {SHINO: 'model.SHINO', A: 'model.A', B: 'model.B', C: 'model.C', TSUKU: 'model.TSUKU'};
document.querySelectorAll('.model-chip').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.model-chip').forEach(other => other.classList.toggle('active', other === button));
  q('#preset').value = presetIds[button.dataset.model]; q('#preset').dispatchEvent(new Event('change', {bubbles: true}));
}));
function syncMotion() {
  q('#motion-name').textContent = master.value || '静止比較';
  q('#motion-meta').textContent = master.value ? '選択中のモーション' : '元モデル静止比較';
}
master.addEventListener('change', syncMotion);
new MutationObserver(() => { refreshSelectors(); syncMotion(); }).observe(master, {childList: true, subtree: true});
document.addEventListener('review-sequence-frame', event => {
  const {index, names} = event.detail;
  q('#motion-name').textContent = names[index] || '静止比較';
  q('#motion-meta').textContent = names.length > 1 ? `${STAGE_LABELS[index]} / ${STAGE_LABELS.slice(0, names.length).join(' → ')}` : '単体再生';
});
refreshSelectors(); syncMotion();
