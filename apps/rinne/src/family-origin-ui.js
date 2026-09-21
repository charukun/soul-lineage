import {FAMILY_QUESTIONS, createFamilyJourney, createFamily, describeFamily, familyForLife} from './rebuild/family-origin.js';
import {familyHomeArt, familyCrestArt, familyMemoryArt} from './family-origin-art.js';
import {playRinneLineageAudio} from './gameplay-audio.js';

const node = (document, tag, className, text) => { const element = document.createElement(tag); element.className = className; if (text !== undefined) element.textContent = text; return element; };
const reducedMotion = (document, motion) => !motion || Boolean(document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
const STORY_PROMPTS = Object.freeze(['どこへ帰る？','何が、残っている？','その手に、何がある？']);

export function openFamilyOrigin({document = globalThis.document, hasSave = false, savedName = '', motion = true, makeId = () => `family-${globalThis.crypto.randomUUID()}`} = {}) {
  const journey = createFamilyJourney(), view = document.defaultView, previousFocus = document.activeElement;
  const dialog = node(document, 'dialog', 'family-origin');
  dialog.setAttribute('aria-labelledby', 'family-origin-question');
  dialog.dataset.motion = reducedMotion(document, motion) ? 'off' : 'on';
  dialog.dataset.scene = 'deepwater';
  dialog.dataset.phase = 'question';
  dialog.innerHTML = `
    <div class="family-deepwater" aria-hidden="true">
      <i class="family-deep"></i>
      <i class="family-water-light"></i>
      <i class="family-current"></i>
      <i class="family-soul"></i>
      <div class="family-motes"></div>
      <div class="family-ripples"></div>
    </div>
    <div class="family-story-shell">
      <button type="button" class="family-story-back" data-origin-back aria-label="ひとつ前へ">‹</button>
      <button type="button" class="family-story-close" data-origin-cancel aria-label="やめる">×</button>
      <main class="family-origin-content"></main>
    </div>`;
  const content = dialog.querySelector('.family-origin-content'), back = dialog.querySelector('[data-origin-back]'), motes = dialog.querySelector('.family-motes');
  for (let i = 0; i < 18; i++) {
    const mote = node(document, 'i', i % 5 === 0 ? 'family-bubble' : 'family-mote');
    mote.style.setProperty('--i', String(i)); mote.style.setProperty('--seed', String((i * 41) % 97)); motes.append(mote);
  }
  document.body.append(dialog);
  let settled = false, transitionTimer = 0, birthTimer = 0, loadingTimer = 0, frame = 0, pointer = null;
  const rippleTimers = new Set();

  return new Promise(resolve => {
    function clearTimers() {
      view.clearTimeout(transitionTimer); view.clearTimeout(birthTimer); view.clearTimeout(loadingTimer); view.cancelAnimationFrame(frame);
      for (const timer of rippleTimers) view.clearTimeout(timer);
      rippleTimers.clear();
    }
    function finish(value) {
      if (settled) return; settled = true; clearTimers(); dialog.remove();
      if (previousFocus?.isConnected) previousFocus.focus({preventScroll:true});
      resolve(value);
    }
    function cancel() {
      if (dialog.dataset.phase !== 'question' && dialog.dataset.phase !== 'confirm') return;
      playRinneLineageAudio('cancel'); if (journey.cancel()) finish(null);
    }
    function renderQuestion() {
      const state = journey.snapshot(), question = FAMILY_QUESTIONS[state.step];
      dialog.dataset.step = String(state.step); dialog.dataset.phase = state.step < 3 ? 'question' : 'confirm';
      dialog.dataset.answering = 'false'; back.hidden = state.step === 0; back.disabled = false; content.replaceChildren();

      if (state.step < 3) {
        const scene = node(document, 'section', 'family-story-question');
        const heading = node(document, 'h2', 'family-story-prompt', STORY_PROMPTS[state.step]); heading.id = 'family-origin-question'; heading.tabIndex = -1;
        const choices = node(document, 'div', 'family-story-choices');
        question.choices.forEach((choice,index) => {
          const button = node(document, 'button', 'family-memory-orb'); button.type = 'button'; button.dataset.answer = choice.id; button.style.setProperty('--slot', String(index));
          button.setAttribute('aria-pressed', String(state.answers[question.key] === choice.id));
          button.innerHTML = `
            <span class="family-memory-apparition" aria-hidden="true">${familyMemoryArt(choice.id)}</span>
            <span class="family-memory-label">${choice.label}</span>`;
          const focusSound = () => playRinneLineageAudio('focus', index);
          button.addEventListener('pointerenter', focusSound, {passive:true}); button.addEventListener('focus', focusSound);
          button.addEventListener('click', () => {
            if (dialog.dataset.answering === 'true' || journey.snapshot().step !== state.step || !journey.choose(choice.id)) return;
            playRinneLineageAudio('choose', index); dialog.dataset.answering = 'true'; button.dataset.chosen = 'true'; back.disabled = true;
            for (const item of choices.querySelectorAll('button')) item.disabled = true;
            transitionTimer = view.setTimeout(renderQuestion, dialog.dataset.motion === 'off' ? 0 : 620);
          });
          choices.append(button);
        });
        scene.append(heading, choices); content.append(scene); heading.focus({preventScroll:true}); return;
      }

      const family = createFamily(state.answers, 'preview'), description = describeFamily(family);
      const scene = node(document, 'section', 'family-story-final');
      const crest = node(document, 'div', 'family-story-crest'); crest.innerHTML = familyCrestArt(family.cultureId);
      const heading = node(document, 'h2', 'family-story-family', description.name); heading.id = 'family-origin-question'; heading.tabIndex = -1;
      const tradition = node(document, 'p', 'family-story-tradition', description.tradition);
      scene.append(crest, heading, tradition);

      let acknowledgement = null;
      if (hasSave) {
        const replace = node(document, 'label', 'family-story-replace');
        acknowledgement = node(document, 'input', ''); acknowledgement.type = 'checkbox'; acknowledgement.dataset.replaceFamily = 'true';
        replace.append(acknowledgement, node(document, 'span', '', `${String(savedName || '今の人生').slice(0,24)}を閉じる`));
        scene.append(replace);
      }
      const confirm = node(document, 'button', 'family-birth-confirm', '生まれる'); confirm.type = 'button'; confirm.dataset.originConfirm = 'true'; confirm.disabled = hasSave;
      acknowledgement?.addEventListener('change', () => { confirm.disabled = !acknowledgement.checked; playRinneLineageAudio('focus', acknowledgement.checked ? 2 : 0); });
      confirm.addEventListener('click', () => {
        const confirmed = journey.confirm(makeId(), {hasSave, replaceAcknowledged:Boolean(acknowledgement?.checked)});
        if (!confirmed) return;
        playRinneLineageAudio('confirm'); dialog.dataset.phase = 'birth'; back.hidden = true; dialog.querySelector('[data-origin-cancel]').hidden = true;
        for (const control of dialog.querySelectorAll('button,input')) control.disabled = true;
        dialog.classList.add('is-birthing');
        birthTimer = view.setTimeout(() => {
          dialog.classList.remove('is-birthing'); dialog.dataset.phase = 'loading'; content.replaceChildren();
          const loading = node(document, 'div', 'family-birth-loading');
          loading.innerHTML = '<i class="family-birth-thread" aria-hidden="true"></i><i class="family-birth-seed" aria-hidden="true"></i><span aria-hidden="true">···</span>';
          content.append(loading);
          playRinneLineageAudio('loading');
          loadingTimer = view.setTimeout(() => finish(confirmed), dialog.dataset.motion === 'off' ? 120 : 1050);
        }, dialog.dataset.motion === 'off' ? 120 : 1550);
      });
      scene.append(confirm); content.append(scene); heading.focus({preventScroll:true});
    }

    back.addEventListener('click', () => {
      if (dialog.dataset.answering === 'true') return;
      if (journey.back()) { playRinneLineageAudio('back'); renderQuestion(); }
    });
    dialog.querySelector('[data-origin-cancel]').addEventListener('click', cancel);
    dialog.addEventListener('cancel', event => { event.preventDefault(); cancel(); });
    dialog.addEventListener('close', () => { if (journey.snapshot().status !== 'confirmed') cancel(); });
    dialog.addEventListener('pointermove', event => {
      if (dialog.dataset.motion === 'off') return;
      pointer = {x:event.clientX / Math.max(1, view.innerWidth), y:event.clientY / Math.max(1, view.innerHeight)};
      if (frame) return;
      frame = view.requestAnimationFrame(() => {
        frame = 0; if (settled || !pointer) return;
        dialog.style.setProperty('--soul-x', `${(pointer.x - .5) * 36}px`); dialog.style.setProperty('--soul-y', `${(pointer.y - .5) * 20}px`);
      });
    }, {passive:true});
    dialog.addEventListener('pointerdown', event => {
      if (dialog.dataset.motion === 'off' || rippleTimers.size >= 4) return;
      const ripple = node(document, 'i', 'family-ripple'); ripple.style.left = `${event.clientX}px`; ripple.style.top = `${event.clientY}px`; dialog.querySelector('.family-ripples').append(ripple);
      const timer = view.setTimeout(() => { ripple.remove(); rippleTimers.delete(timer); }, 1000); rippleTimers.add(timer);
    }, {passive:true});

    dialog.showModal(); renderQuestion();
  });
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
