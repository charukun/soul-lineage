import {FAMILY_QUESTIONS, createFamilyJourney, createFamily, describeFamily, familyForLife} from './rebuild/family-origin.js';
import {familyHomeArt, familyCrestArt, familyMemoryArt} from './family-origin-art.js';
import {playRinneLineageAudio} from './gameplay-audio.js';

const node = (document, tag, className, text) => { const element = document.createElement(tag); element.className = className; if (text !== undefined) element.textContent = text; return element; };
const reducedMotion = (document, motion) => !motion || Boolean(document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
const STEP_NAMES = Object.freeze(['土地の記憶','家の言葉','受け継ぐもの']);

export function openFamilyOrigin({document = globalThis.document, hasSave = false, savedName = '', motion = true, makeId = () => `family-${globalThis.crypto.randomUUID()}`} = {}) {
  const journey = createFamilyJourney(), view = document.defaultView, previousFocus = document.activeElement;
  const dialog = node(document, 'dialog', 'family-origin');
  dialog.setAttribute('aria-labelledby', 'family-origin-question');
  dialog.dataset.motion = reducedMotion(document, motion) ? 'off' : 'on';
  dialog.dataset.scene = 'ritual';
  dialog.innerHTML = `
    <div class="family-ritual-world" aria-hidden="true">
      <i class="family-abyss"></i>
      <i class="family-caustic-field"></i>
      <i class="family-moon"></i>
      <i class="family-ancestral-gate"></i>
      <i class="family-spirit-column"></i>
      <i class="family-water-horizon"></i>
      <i class="family-depth-fog family-depth-fog-a"></i>
      <i class="family-depth-fog family-depth-fog-b"></i>
      <i class="family-soul"></i>
      <div class="family-motes"></div>
      <div class="family-ripples"></div>
    </div>
    <div class="family-ritual-shell">
      <header class="family-ritual-hud">
        <button type="button" class="family-rune-button" data-origin-back aria-label="ひとつ前の記憶へ"><span aria-hidden="true">‹</span></button>
        <div class="family-ritual-emblem" aria-hidden="true"><i></i><b>血</b><i></i></div>
        <button type="button" class="family-rune-button" data-origin-cancel aria-label="一族の問答を取り消してタイトルへ戻る"><span aria-hidden="true">×</span></button>
      </header>
      <main class="family-origin-content"></main>
      <footer class="family-ritual-footer">
        <div class="family-ritual-progress" aria-label="一族の問答の進み具合"><i></i><i></i><i></i></div>
        <p>記憶に触れ、血の流れを選ぶ</p>
      </footer>
    </div>`;
  const content = dialog.querySelector('.family-origin-content'), back = dialog.querySelector('[data-origin-back]');
  const progressDots = [...dialog.querySelectorAll('.family-ritual-progress i')], motes = dialog.querySelector('.family-motes');
  for (let i = 0; i < 34; i++) {
    const mote = node(document, 'i', i % 7 === 0 ? 'family-petal' : i % 4 === 0 ? 'family-bubble' : 'family-mote');
    mote.style.setProperty('--i', String(i)); mote.style.setProperty('--seed', String((i * 37) % 101)); motes.append(mote);
  }
  document.body.append(dialog);
  let settled = false, transitionTimer = 0, riseTimer = 0, frame = 0, pointer = null;
  const rippleTimers = new Set();

  return new Promise(resolve => {
    function finish(value) {
      if (settled) return; settled = true;
      view.clearTimeout(transitionTimer); view.clearTimeout(riseTimer); view.cancelAnimationFrame(frame);
      for (const timer of rippleTimers) view.clearTimeout(timer);
      rippleTimers.clear(); dialog.remove();
      if (previousFocus?.isConnected) previousFocus.focus({preventScroll:true});
      resolve(value);
    }
    function cancel() { playRinneLineageAudio('cancel'); if (journey.cancel()) finish(null); }
    function updateProgress(step) {
      progressDots.forEach((dot,index) => { dot.dataset.state = index < step ? 'done' : index === step ? 'current' : 'waiting'; });
    }
    function render() {
      view.clearTimeout(transitionTimer); transitionTimer = 0; dialog.dataset.transitioning = 'false';
      const state = journey.snapshot(), question = FAMILY_QUESTIONS[state.step];
      dialog.dataset.step = String(state.step); back.disabled = state.step === 0; updateProgress(Math.min(state.step,2));
      content.replaceChildren();

      if (state.step < 3) {
        const headingBlock = node(document, 'section', 'family-question-block');
        const kicker = node(document, 'p', 'family-question-kicker', STEP_NAMES[state.step]);
        const heading = node(document, 'h2', 'family-question-title', question.text); heading.id = 'family-origin-question'; heading.tabIndex = -1;
        const whisper = node(document, 'p', 'family-question-whisper', state.step === 0 ? '遠い水底から、ひとつだけ懐かしい景色が浮かぶ。' : state.step === 1 ? '声は姿を持たない。それでも、家の言葉だけは残っている。' : '最後まで手放さなかったものが、次の生へ流れ着く。');
        headingBlock.append(kicker, heading, whisper);

        const altar = node(document, 'div', 'family-memory-altar');
        question.choices.forEach((choice,index) => {
          const button = node(document, 'button', 'family-memory-orb'); button.type = 'button'; button.dataset.answer = choice.id; button.style.setProperty('--slot', String(index));
          button.setAttribute('aria-pressed', String(state.answers[question.key] === choice.id));
          button.innerHTML = `
            <span class="family-orb-aura" aria-hidden="true"></span>
            <span class="family-orb-rings" aria-hidden="true"><i></i><i></i><i></i></span>
            <span class="family-orb-core"><span class="family-orb-picture">${familyMemoryArt(choice.id)}</span><i class="family-orb-glint" aria-hidden="true"></i></span>
            <span class="family-orb-label">${choice.label}</span>
            <span class="family-orb-mark" aria-hidden="true">${['壱','弐','参'][index]}</span>`;
          const focusSound = () => playRinneLineageAudio('focus', index);
          button.addEventListener('pointerenter', focusSound, {passive:true}); button.addEventListener('focus', focusSound);
          button.addEventListener('click', () => {
            if (dialog.dataset.transitioning === 'true' || journey.snapshot().step !== state.step || !journey.choose(choice.id)) return;
            playRinneLineageAudio('choose', index); dialog.dataset.transitioning = 'true'; button.dataset.chosen = 'true'; back.disabled = true;
            for (const item of altar.querySelectorAll('button')) item.disabled = true;
            transitionTimer = view.setTimeout(render, dialog.dataset.motion === 'off' ? 0 : 420);
          });
          altar.append(button);
        });
        content.append(headingBlock, altar); heading.focus({preventScroll:true});
        return;
      }

      const family = createFamily(state.answers, 'preview'), description = describeFamily(family);
      const heading = node(document, 'h2', 'family-question-title family-question-title-final', 'この血を、次の百年へ。'); heading.id = 'family-origin-question'; heading.tabIndex = -1;
      const preview = node(document, 'section', 'family-origin-preview');
      preview.innerHTML = `
        <div class="family-oath-gate" aria-hidden="true">
          <i class="family-oath-pillar family-oath-pillar-left"></i><i class="family-oath-pillar family-oath-pillar-right"></i>
          <div class="family-home-picture">${familyHomeArt(family.cultureId)}</div>
          <div class="family-preview-crest">${familyCrestArt(family.cultureId)}</div>
          <i class="family-oath-thread family-oath-thread-a"></i><i class="family-oath-thread family-oath-thread-b"></i>
        </div>`;
      preview.append(node(document, 'p', 'family-preview-kicker', '受け継ぐ一族'), node(document, 'h3', 'family-preview-name', description.name), node(document, 'p', 'family-preview-tradition', `${description.ethos} · ${description.tradition}`));
      const heirloom = node(document, 'div', 'family-heirloom'); heirloom.innerHTML = `<span class="family-heirloom-art">${familyMemoryArt(family.traditionId)}</span>`; heirloom.append(node(document, 'span', '', description.heirloom));
      preview.append(heirloom, node(document, 'p', 'family-teaching', description.teaching));

      let acknowledgement = null;
      if (hasSave) {
        const label = node(document, 'label', 'family-replace-oath');
        acknowledgement = node(document, 'input', ''); acknowledgement.type = 'checkbox'; acknowledgement.dataset.replaceFamily = 'true';
        const seal = node(document, 'span', 'family-replace-seal'); seal.setAttribute('aria-hidden','true'); seal.textContent = '継';
        label.append(acknowledgement, seal, node(document, 'span', 'family-replace-copy', `${String(savedName || '現在の人生').slice(0,24)}の記録を閉じ、新しい一族として生まれる`));
        preview.append(label);
      }
      const confirm = node(document, 'button', 'family-birth-confirm'); confirm.type = 'button'; confirm.dataset.originConfirm = 'true'; confirm.disabled = hasSave;
      confirm.innerHTML = '<i aria-hidden="true"></i><span>この家に、生まれる</span><b aria-hidden="true">◆</b>';
      acknowledgement?.addEventListener('change', () => { confirm.disabled = !acknowledgement.checked; playRinneLineageAudio('focus', acknowledgement.checked ? 2 : 0); });
      confirm.addEventListener('click', () => {
        const confirmed = journey.confirm(makeId(), {hasSave, replaceAcknowledged:Boolean(acknowledgement?.checked)});
        if (!confirmed) return;
        playRinneLineageAudio('confirm'); for (const button of dialog.querySelectorAll('button, input')) button.disabled = true;
        dialog.classList.add('is-rising'); riseTimer = view.setTimeout(() => finish(confirmed), dialog.dataset.motion === 'off' ? 0 : 850);
      });
      preview.append(confirm); content.append(heading, preview); heading.focus({preventScroll:true});
    }

    back.addEventListener('click', () => { if (dialog.dataset.transitioning === 'true') return; if (journey.back()) { playRinneLineageAudio('back'); render(); } });
    dialog.querySelector('[data-origin-cancel]').addEventListener('click', cancel);
    dialog.addEventListener('cancel', event => { event.preventDefault(); cancel(); });
    dialog.addEventListener('close', () => { if (journey.snapshot().status !== 'confirmed') cancel(); });
    dialog.addEventListener('keydown', event => { if (event.repeat && event.key === 'Enter') event.preventDefault(); });
    dialog.addEventListener('pointermove', event => {
      if (dialog.dataset.motion === 'off') return;
      pointer = {x:event.clientX / Math.max(1, view.innerWidth), y:event.clientY / Math.max(1, view.innerHeight)};
      if (frame) return;
      frame = view.requestAnimationFrame(() => {
        frame = 0; if (settled || !pointer) return;
        dialog.style.setProperty('--look-x', String((pointer.x - .5).toFixed(3))); dialog.style.setProperty('--look-y', String((pointer.y - .5).toFixed(3)));
        dialog.style.setProperty('--soul-x', `${(pointer.x - .5) * 90}px`); dialog.style.setProperty('--soul-y', `${(pointer.y - .5) * 36}px`);
      });
    }, {passive:true});
    dialog.addEventListener('pointerdown', event => {
      if (dialog.dataset.motion === 'off' || rippleTimers.size >= 6) return;
      const ripple = node(document, 'i', 'family-ripple'); ripple.style.left = `${event.clientX}px`; ripple.style.top = `${event.clientY}px`; dialog.querySelector('.family-ripples').append(ripple);
      const timer = view.setTimeout(() => { ripple.remove(); rippleTimers.delete(timer); }, 1100); rippleTimers.add(timer);
    }, {passive:true});
    dialog.showModal(); render();
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
