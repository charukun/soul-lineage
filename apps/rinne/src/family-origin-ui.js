import {FAMILY_QUESTIONS, createFamilyJourney, createFamily, describeFamily, familyForLife} from './rebuild/family-origin.js';
import {familyHomeArt, familyCrestArt, familyMemoryArt} from './family-origin-art.js';

const node = (document, tag, className, text) => { const element = document.createElement(tag); element.className = className; if (text !== undefined) element.textContent = text; return element; };
const reducedMotion = (document, motion) => !motion || Boolean(document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

export function openFamilyOrigin({document = globalThis.document, hasSave = false, savedName = '', motion = true, makeId = () => `family-${globalThis.crypto.randomUUID()}`} = {}) {
  const journey = createFamilyJourney(), view = document.defaultView, previousFocus = document.activeElement;
  const dialog = node(document, 'dialog', 'family-origin');
  dialog.setAttribute('aria-labelledby', 'family-origin-question');
  dialog.dataset.motion = reducedMotion(document, motion) ? 'off' : 'on';
  dialog.innerHTML = '<div class="family-water" aria-hidden="true"><i class="family-water-rays"></i><i class="family-water-caustics"></i><i class="family-soul"></i><div class="family-motes"></div><div class="family-ripples"></div></div><div class="family-origin-shell"><header><button type="button" data-origin-back aria-label="ひとつ前の問いへ">戻る</button><p>生まれる、その前に</p><button type="button" data-origin-cancel aria-label="一族の問答を取り消してタイトルへ戻る">閉じる</button></header><div class="family-origin-content"></div><p class="family-origin-footnote">水底に、あなたの記憶が眠っている。</p></div>';
  const content = dialog.querySelector('.family-origin-content'), back = dialog.querySelector('[data-origin-back]');
  const motes = dialog.querySelector('.family-motes');
  for (let i = 0; i < 18; i++) { const mote = node(document, 'i', i % 3 ? 'family-mote' : 'family-petal'); mote.style.setProperty('--i', String(i)); motes.append(mote); }
  document.body.append(dialog);
  let settled = false, riseTimer = 0, frame = 0, pointer = null;
  const rippleTimers = new Set();
  return new Promise(resolve => {
    function finish(value) {
      if (settled) return; settled = true;
      view.clearTimeout(riseTimer); view.cancelAnimationFrame(frame);
      for (const timer of rippleTimers) view.clearTimeout(timer);
      rippleTimers.clear(); dialog.remove();
      if (previousFocus?.isConnected) previousFocus.focus({preventScroll:true});
      resolve(value);
    }
    function cancel() { if (journey.cancel()) finish(null); }
    function render() {
      const state = journey.snapshot();
      dialog.dataset.step = String(state.step); back.disabled = state.step === 0;
      content.replaceChildren();
      const progress = node(document, 'p', 'family-question-progress', state.step < 3 ? `${state.step + 1} / 3` : 'めぐり逢う家');
      const heading = node(document, 'h2', '', state.step < 3 ? FAMILY_QUESTIONS[state.step].text : 'この家が、あなたを待っている。');
      heading.id = 'family-origin-question'; heading.tabIndex = -1;
      content.append(progress, heading);
      if (state.step < 3) {
        const choices = node(document, 'div', 'family-memory-choices');
        for (const choice of FAMILY_QUESTIONS[state.step].choices) {
          const button = node(document, 'button', 'family-memory-choice'); button.type = 'button'; button.dataset.answer = choice.id;
          button.innerHTML = `<span class="family-memory-picture">${familyMemoryArt(choice.id)}</span>`;
          button.append(node(document, 'strong', '', choice.label));
          button.setAttribute('aria-pressed', String(state.answers[FAMILY_QUESTIONS[state.step].key] === choice.id));
          button.addEventListener('click', () => { if (journey.snapshot().step === state.step && journey.choose(choice.id)) render(); });
          choices.append(button);
        }
        content.append(choices);
      } else {
        const family = createFamily(state.answers, 'preview'), description = describeFamily(family);
        const preview = node(document, 'section', 'family-origin-preview');
        preview.innerHTML = `<div class="family-home-picture">${familyHomeArt(family.cultureId)}</div><div class="family-preview-crest">${familyCrestArt(family.cultureId)}</div>`;
        preview.append(node(document, 'h3', '', description.name), node(document, 'p', 'family-preview-tradition', `${description.ethos} · ${description.tradition}`));
        const heirloom = node(document, 'div', 'family-heirloom'); heirloom.innerHTML = familyMemoryArt(family.traditionId); heirloom.append(node(document, 'span', '', description.heirloom));
        preview.append(heirloom, node(document, 'p', 'family-teaching', description.teaching)); content.append(preview);
        let acknowledgement = null;
        if (hasSave) {
          const label = node(document, 'label', 'family-replace-ack');
          acknowledgement = node(document, 'input', ''); acknowledgement.type = 'checkbox'; acknowledgement.dataset.replaceFamily = 'true';
          label.append(acknowledgement, node(document, 'span', '', `${String(savedName || '現在の人生').slice(0, 24)}の保存を置き換え、新しい一族を始める`)); content.append(label);
        }
        const confirm = node(document, 'button', 'family-birth-confirm', 'この家に、生まれる'); confirm.type = 'button'; confirm.dataset.originConfirm = 'true'; confirm.disabled = hasSave;
        acknowledgement?.addEventListener('change', () => { confirm.disabled = !acknowledgement.checked; });
        confirm.addEventListener('click', () => {
          const family = journey.confirm(makeId(), {hasSave, replaceAcknowledged:Boolean(acknowledgement?.checked)});
          if (!family) return;
          for (const button of dialog.querySelectorAll('button, input')) button.disabled = true;
          dialog.classList.add('is-rising');
          riseTimer = view.setTimeout(() => finish(family), dialog.dataset.motion === 'off' ? 0 : 550);
        });
        content.append(confirm);
      }
      heading.focus({preventScroll:true});
    }
    back.addEventListener('click', () => { if (journey.back()) render(); });
    dialog.querySelector('[data-origin-cancel]').addEventListener('click', cancel);
    dialog.addEventListener('cancel', event => { event.preventDefault(); cancel(); });
    dialog.addEventListener('close', () => { if (journey.snapshot().status !== 'confirmed') cancel(); });
    dialog.addEventListener('keydown', event => { if (event.repeat && event.key === 'Enter') event.preventDefault(); });
    dialog.addEventListener('pointermove', event => {
      if (dialog.dataset.motion === 'off') return;
      pointer = {x:event.clientX / Math.max(1, view.innerWidth), y:event.clientY / Math.max(1, view.innerHeight)};
      if (frame) return;
      frame = view.requestAnimationFrame(() => { frame = 0; if (settled || !pointer) return; dialog.style.setProperty('--soul-x', `${(pointer.x - .5) * 100}px`); dialog.style.setProperty('--soul-y', `${(pointer.y - .5) * 45}px`); });
    }, {passive:true});
    dialog.addEventListener('pointerdown', event => {
      if (dialog.dataset.motion === 'off' || rippleTimers.size >= 5) return;
      const ripple = node(document, 'i', 'family-ripple'); ripple.style.left = `${event.clientX}px`; ripple.style.top = `${event.clientY}px`; dialog.querySelector('.family-ripples').append(ripple);
      const timer = view.setTimeout(() => { ripple.remove(); rippleTimers.delete(timer); }, 900); rippleTimers.add(timer);
    }, {passive:true});
    dialog.showModal(); render();
  });
}

export function renderFamilyTitle(title, saved) {
  const document = title.ownerDocument;
  let family = null;
  try { if (saved && typeof saved === 'object') family = familyForLife(saved); } catch { /* Invalid saves are reported by Continue, never overwritten here. */ }
  let world = title.querySelector('.family-return-world');
  if (!world) { world = node(document, 'div', 'family-return-world'); world.setAttribute('aria-hidden', 'true'); title.querySelector('.title-world')?.append(world); }
  let caption = title.querySelector('.title-family-caption');
  if (!caption) { caption = node(document, 'p', 'title-family-caption'); title.querySelector('.title-lockup')?.append(caption); }
  title.dataset.family = family?.origin || 'unborn';
  if (!family) { world.innerHTML = '<i class="family-water-rays"></i><i class="family-soul"></i>'; caption.textContent = ''; return; }
  const description = describeFamily(family);
  world.innerHTML = familyHomeArt(family.cultureId);
  caption.textContent = `${description.name} · ${description.tradition}`;
}

export function installFamilyMemory({gameScreen, getState}) {
  const document = gameScreen.ownerDocument, trigger = gameScreen.querySelector('.life-chip');
  if (!trigger) return {dispose() {}};
  const old = {role:trigger.getAttribute('role'), tabindex:trigger.getAttribute('tabindex'), label:trigger.getAttribute('aria-label')};
  trigger.setAttribute('role', 'button'); trigger.tabIndex = 0; trigger.setAttribute('aria-label', '一族の記憶をひらく'); trigger.classList.add('family-memory-trigger');
  let dialog = null;
  function close() { dialog?.remove(); dialog = null; trigger.focus({preventScroll:true}); }
  function open() {
    const state = getState(); if (!state || dialog) return;
    const family = familyForLife(state), description = describeFamily(family);
    dialog = node(document, 'dialog', 'family-memory-dialog'); dialog.setAttribute('aria-labelledby', 'family-memory-name');
    const closeButton = node(document, 'button', 'family-memory-close', '閉じる'); closeButton.type = 'button'; closeButton.addEventListener('click', close); dialog.append(closeButton);
    const home = node(document, 'div', 'family-home-picture'); home.innerHTML = familyHomeArt(family.cultureId); dialog.append(home);
    const crest = node(document, 'div', 'family-preview-crest'); crest.innerHTML = familyCrestArt(family.cultureId); dialog.append(crest);
    const name = node(document, 'h2', '', description.name); name.id = 'family-memory-name'; dialog.append(name, node(document, 'p', 'family-preview-tradition', `${description.ethos} · ${description.tradition}`));
    dialog.append(node(document, 'p', '', description.memory), node(document, 'p', 'family-teaching', description.teaching), node(document, 'h3', '', description.heirloom), node(document, 'p', '', description.traditionMemory || description.practice));
    dialog.append(node(document, 'p', 'family-practice', state.ageYears < 7 ? `家族の稽古を見つめる。${description.practice}` : description.practice));
    const records = node(document, 'ol', 'family-contributions');
    for (const record of family.contributions.slice(-6)) records.append(node(document, 'li', '', `${record.generation}代目 ${record.name} · 凱旋${record.returns}回 · 遺した技${record.skills.length}つ`));
    records.append(node(document, 'li', 'family-current-life', `${state.generation}代目 ${state.name} · 今を生きている`));
    dialog.append(node(document, 'h3', '', 'この家の歩み'), records);
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); }); dialog.addEventListener('close', close);
    document.body.append(dialog); dialog.showModal();
  }
  const key = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } };
  trigger.addEventListener('click', open); trigger.addEventListener('keydown', key);
  return {dispose() { dialog?.remove(); dialog = null; trigger.removeEventListener('click', open); trigger.removeEventListener('keydown', key); trigger.classList.remove('family-memory-trigger'); for (const [key, value] of Object.entries({'role':old.role, 'tabindex':old.tabindex, 'aria-label':old.label})) { if (value === null) trigger.removeAttribute(key); else trigger.setAttribute(key, value); } }};
}
