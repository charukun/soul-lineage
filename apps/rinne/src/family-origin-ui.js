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
  dialog.dataset.scene = 'deepwater-single';
  dialog.dataset.phase = 'question';
  dialog.innerHTML = `
    <div class="family-deepwater" aria-hidden="true">
      <i class="family-deep"></i>
      <i class="family-water-light"></i>
      <i class="family-current"></i>
      <i class="family-birth-flash"></i>
      <i class="family-soul"></i>
      <div class="family-motes"></div>
      <div class="family-ripples"></div>
    </div>
    <div class="family-story-shell">
      <button type="button" class="family-story-back" data-origin-back aria-label="ひとつ前へ">‹</button>
      <button type="button" class="family-story-close" data-origin-cancel aria-label="やめる">×</button>
      <main class="family-origin-content"></main>
      <p class="family-story-live" aria-live="polite"></p>
    </div>`;
  const content = dialog.querySelector('.family-origin-content'), back = dialog.querySelector('[data-origin-back]'), motes = dialog.querySelector('.family-motes'), live = dialog.querySelector('.family-story-live');
  for (let i = 0; i < 18; i++) {
    const mote = node(document, 'i', i % 5 === 0 ? 'family-bubble' : 'family-mote');
    mote.style.setProperty('--i', String(i)); mote.style.setProperty('--seed', String((i * 41) % 97)); motes.append(mote);
  }
  document.body.append(dialog);

  let settled = false, transitionTimer = 0, birthTimer = 0, loadingTimer = 0, memoryTimer = 0, shiftTimer = 0, swipeResetTimer = 0, frame = 0, pointer = null, swipeStart = null, suppressClick = false;
  let activeQuestion = null, memoryStage = null, memoryIndex = 0;
  const memoryIndices = [0,0,0], rippleTimers = new Set();

  return new Promise(resolve => {
    function clearMemoryTimers() { view.clearTimeout(memoryTimer); view.clearTimeout(shiftTimer); memoryTimer = 0; shiftTimer = 0; }
    function clearTimers() {
      clearMemoryTimers(); view.clearTimeout(transitionTimer); view.clearTimeout(birthTimer); view.clearTimeout(loadingTimer); view.clearTimeout(swipeResetTimer); view.cancelAnimationFrame(frame);
      for (const timer of rippleTimers) view.clearTimeout(timer);
      rippleTimers.clear();
    }
    function finish(value) {
      if (settled) return; settled = true; clearTimers(); dialog.remove();
      if (previousFocus?.isConnected) previousFocus.focus({preventScroll:true});
      resolve(value);
    }
    function cancel() {
      if (!['question','confirm'].includes(dialog.dataset.phase)) return;
      playRinneLineageAudio('cancel'); if (journey.cancel()) finish(null);
    }
    function scheduleDrift() {
      view.clearTimeout(memoryTimer);
      if (dialog.dataset.motion === 'off' || dialog.dataset.phase !== 'question' || dialog.dataset.answering === 'true') return;
      memoryTimer = view.setTimeout(() => cycleMemory(1,'auto'), 3400);
    }
    function renderMemory() {
      if (!activeQuestion || !memoryStage) return;
      const choice = activeQuestion.choices[memoryIndex];
      memoryStage.replaceChildren();
      dialog.dataset.memoryId = choice.id;
      dialog.dataset.memoryIndex = String(memoryIndex);
      dialog.dataset.shifting = 'false';
      live.textContent = choice.label;
      const presence = node(document, 'button', 'family-memory-presence'); presence.type = 'button'; presence.dataset.answer = choice.id; presence.dataset.memoryCurrent = 'true';
      presence.setAttribute('aria-label', `${choice.label}。触れて選ぶ。左右キーまたはスワイプで別の記憶。`);
      presence.setAttribute('aria-pressed', String(journey.snapshot().answers[activeQuestion.key] === choice.id));
      presence.innerHTML = `<span class="family-memory-apparition" aria-hidden="true">${familyMemoryArt(choice.id)}</span><span class="family-memory-label">${choice.label}</span>`;
      const focusSound = () => playRinneLineageAudio('focus', memoryIndex);
      presence.addEventListener('pointerenter', focusSound, {passive:true}); presence.addEventListener('focus', focusSound);
      presence.addEventListener('click', () => {
        if (suppressClick) { suppressClick = false; return; }
        const state = journey.snapshot();
        if (dialog.dataset.answering === 'true' || state.step >= FAMILY_QUESTIONS.length || !journey.choose(choice.id)) return;
        clearMemoryTimers(); playRinneLineageAudio('choose', memoryIndex); dialog.dataset.answering = 'true'; presence.dataset.chosen = 'true'; back.disabled = true;
        transitionTimer = view.setTimeout(() => { activeQuestion = null; memoryStage = null; renderQuestion(); }, dialog.dataset.motion === 'off' ? 0 : 820);
      });
      memoryStage.append(presence); presence.focus({preventScroll:true}); scheduleDrift();
    }
    function cycleMemory(delta, source='input') {
      if (!activeQuestion || !memoryStage || dialog.dataset.phase !== 'question' || dialog.dataset.answering === 'true' || dialog.dataset.shifting === 'true') return false;
      clearMemoryTimers(); const next = (memoryIndex + delta + activeQuestion.choices.length) % activeQuestion.choices.length;
      if (next === memoryIndex) return false;
      dialog.dataset.shifting = 'true'; dialog.dataset.shiftDirection = delta > 0 ? 'next' : 'previous';
      const presence = memoryStage.querySelector('[data-memory-current]'); if (presence) presence.dataset.departing = 'true';
      if (source !== 'auto') playRinneLineageAudio('drift', next);
      shiftTimer = view.setTimeout(() => {
        memoryIndex = next; memoryIndices[journey.snapshot().step] = next; renderMemory();
      }, dialog.dataset.motion === 'off' ? 0 : 320);
      return true;
    }
    function renderQuestion() {
      clearMemoryTimers();
      const state = journey.snapshot(), question = FAMILY_QUESTIONS[state.step];
      dialog.dataset.step = String(state.step); dialog.dataset.phase = state.step < 3 ? 'question' : 'confirm'; dialog.dataset.answering = 'false'; dialog.dataset.shifting = 'false';
      back.hidden = state.step === 0; back.disabled = false; content.replaceChildren();

      if (state.step < 3) {
        activeQuestion = question;
        const selected = question.choices.findIndex(choice => choice.id === state.answers[question.key]);
        memoryIndex = selected >= 0 ? selected : memoryIndices[state.step] || 0; memoryIndices[state.step] = memoryIndex;
        const scene = node(document, 'section', 'family-story-question');
        const heading = node(document, 'h2', 'family-story-prompt', STORY_PROMPTS[state.step]); heading.id = 'family-origin-question'; heading.tabIndex = -1;
        memoryStage = node(document, 'div', 'family-memory-stage'); memoryStage.setAttribute('role','group'); memoryStage.setAttribute('aria-label', `記憶 ${memoryIndex + 1} / ${question.choices.length}`);
        scene.append(heading, memoryStage); content.append(scene); renderMemory(); return;
      }

      activeQuestion = null; memoryStage = null; live.textContent = '';
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
        const seal = node(document, 'i', 'family-replace-seal', '継'); seal.setAttribute('aria-hidden','true');
        replace.append(acknowledgement, seal, node(document, 'span', '', `${String(savedName || '今の人生').slice(0,24)}を閉じる`));
        scene.append(replace);
      }
      const confirm = node(document, 'button', 'family-birth-confirm'); confirm.type = 'button'; confirm.dataset.originConfirm = 'true'; confirm.disabled = hasSave;
      confirm.innerHTML = '<i class="family-birth-core" aria-hidden="true"></i><span>生まれる</span>';
      acknowledgement?.addEventListener('change', () => { confirm.disabled = !acknowledgement.checked; playRinneLineageAudio('focus', acknowledgement.checked ? 2 : 0); });
      confirm.addEventListener('click', () => {
        const confirmed = journey.confirm(makeId(), {hasSave, replaceAcknowledged:Boolean(acknowledgement?.checked)});
        if (!confirmed) return;
        clearMemoryTimers(); playRinneLineageAudio('confirm'); dialog.dataset.phase = 'birth'; back.hidden = true; dialog.querySelector('[data-origin-cancel]').hidden = true;
        for (const control of dialog.querySelectorAll('button,input')) control.disabled = true;
        dialog.classList.add('is-birthing');
        birthTimer = view.setTimeout(() => {
          dialog.classList.remove('is-birthing'); dialog.dataset.phase = 'loading'; content.replaceChildren();
          const loading = node(document, 'div', 'family-birth-loading');
          loading.innerHTML = '<i class="family-birth-thread" aria-hidden="true"></i><i class="family-birth-seed" aria-hidden="true"></i><span class="family-loading-accessible">生まれています</span>';
          content.append(loading); playRinneLineageAudio('loading');
          loadingTimer = view.setTimeout(() => finish(confirmed), dialog.dataset.motion === 'off' ? 140 : 1250);
        }, dialog.dataset.motion === 'off' ? 140 : 1900);
      });
      scene.append(confirm); content.append(scene); heading.focus({preventScroll:true});
    }

    back.addEventListener('click', () => {
      if (dialog.dataset.answering === 'true' || dialog.dataset.shifting === 'true') return;
      if (journey.back()) { playRinneLineageAudio('back'); renderQuestion(); }
    });
    dialog.querySelector('[data-origin-cancel]').addEventListener('click', cancel);
    dialog.addEventListener('cancel', event => { event.preventDefault(); cancel(); });
    dialog.addEventListener('close', () => { if (journey.snapshot().status !== 'confirmed') cancel(); });
    dialog.addEventListener('keydown', event => {
      event.stopPropagation();
      if (dialog.dataset.phase === 'question' && event.key === 'ArrowRight') { event.preventDefault(); cycleMemory(1); return; }
      if (dialog.dataset.phase === 'question' && event.key === 'ArrowLeft') { event.preventDefault(); cycleMemory(-1); return; }
      if (event.repeat && event.key === 'Enter') event.preventDefault();
    });
    dialog.addEventListener('pointerdown', event => {
      swipeStart = {x:event.clientX,y:event.clientY,time:performance.now()};
      if (dialog.dataset.motion === 'off' || rippleTimers.size >= 4) return;
      const ripple = node(document, 'i', 'family-ripple'); ripple.style.left = `${event.clientX}px`; ripple.style.top = `${event.clientY}px`; dialog.querySelector('.family-ripples').append(ripple);
      const timer = view.setTimeout(() => { ripple.remove(); rippleTimers.delete(timer); }, 1000); rippleTimers.add(timer);
    }, {passive:true});
    dialog.addEventListener('pointerup', event => {
      if (!swipeStart || dialog.dataset.phase !== 'question') { swipeStart = null; return; }
      const dx = event.clientX - swipeStart.x, dy = event.clientY - swipeStart.y; swipeStart = null;
      if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.15) return;
      suppressClick = true; cycleMemory(dx < 0 ? 1 : -1);
      view.clearTimeout(swipeResetTimer); swipeResetTimer = view.setTimeout(() => { suppressClick = false; }, 60);
    }, {passive:true});
    dialog.addEventListener('pointermove', event => {
      if (dialog.dataset.motion === 'off') return;
      pointer = {x:event.clientX / Math.max(1, view.innerWidth), y:event.clientY / Math.max(1, view.innerHeight)};
      if (frame) return;
      frame = view.requestAnimationFrame(() => {
        frame = 0; if (settled || !pointer) return;
        dialog.style.setProperty('--soul-x', `${(pointer.x - .5) * 28}px`); dialog.style.setProperty('--soul-y', `${(pointer.y - .5) * 16}px`);
      });
    }, {passive:true});

    dialog.showModal(); renderQuestion();
  });
}


export function openFamilyHome({document = globalThis.document, state, source = 'title', mode = 'resume', allowClose = true} = {}) {
  if (!state) return Promise.resolve(null);
  const family = familyForLife(state), description = describeFamily(family), ended = Boolean(state.ended || state.phase === 'ended');
  const previousFocus = document.activeElement, dialog = node(document, 'dialog', 'family-memory-dialog family-home-dialog');
  dialog.dataset.source = source; dialog.dataset.lifeEnded = String(ended); dialog.setAttribute('aria-labelledby', 'family-memory-name');
  const shell = node(document, 'section', 'family-home-shell');
  const closeButton = node(document, 'button', 'family-memory-close', '×'); closeButton.type = 'button'; closeButton.setAttribute('aria-label','一族画面を閉じる'); closeButton.hidden = !allowClose;
  const home = node(document, 'div', 'family-home-picture'); home.innerHTML = familyHomeArt(family.cultureId);
  const crest = node(document, 'div', 'family-preview-crest'); crest.innerHTML = familyCrestArt(family.cultureId);
  const heading = node(document, 'h2', 'family-home-name', description.name); heading.id = 'family-memory-name';
  const tradition = node(document, 'p', 'family-preview-tradition', `${description.ethos} · ${description.tradition}`);
  const current = node(document, 'section', 'family-home-current');
  current.append(node(document, 'span', 'family-home-kicker', ended ? '生涯の記録' : '現在の人生'));
  current.append(node(document, 'strong', '', `${state.generation || 1}代目 · ${state.name || '旅人'}`));
  current.append(node(document, 'p', '', ended ? `${Math.floor(Number(state.ageYears)||0)}歳で生涯を終えた` : `${Math.floor(Number(state.ageYears)||0)}歳 · 今を生きている`));
  const lifeEnd = ended ? (state.events || []).find(event => event?.type === 'life-end') : null;
  if (lifeEnd?.text) current.append(node(document, 'small', 'family-home-life-end', lifeEnd.text));
  const stats = node(document, 'div', 'family-home-stats');
  for (const [label,value] of [['撃破',state.defeats||0],['凱旋',state.returns||0],['技',state.knownSkills?.length||0],['故郷',state.homelands?.length||0]]) {
    const item = node(document, 'span', ''); item.append(node(document,'b','',String(value)),node(document,'small','',label)); stats.append(item);
  }
  current.append(stats);
  const records = node(document, 'ol', 'family-contributions family-home-history');
  for (const record of family.contributions.slice(-5)) records.append(node(document, 'li', '', `${record.generation}代目 ${record.name} · 凱旋${record.returns}回 · 遺した技${record.skills.length}つ`));
  if (!family.contributions.length) records.append(node(document, 'li', 'family-home-empty', 'この一族の最初の人生。ここから記録が始まる。'));
  const actions = node(document, 'div', 'family-home-actions');
  const actionButton = (action,label,primary=false) => {
    const button = node(document, 'button', primary ? 'family-home-primary' : 'family-home-secondary', label); button.type = 'button'; button.dataset.familyAction = action; return button;
  };
  if (mode !== 'view') {
    if (ended) actions.append(actionButton('rebirth','次の人生へ',true));
    else actions.append(actionButton('continue','この人生を続ける',true));
    if (source === 'death') actions.append(actionButton('title','タイトルへ'));
  } else actions.append(actionButton('close','閉じる',true));
  shell.append(closeButton,home,crest,heading,tradition,current,node(document,'h3','family-home-history-title','この家の歩み'),records,actions);
  dialog.append(shell); document.body.append(dialog);
  return new Promise(resolve => {
    let settled = false;
    const finish = action => { if (settled) return; settled = true; dialog.remove(); if (previousFocus?.isConnected) previousFocus.focus({preventScroll:true}); resolve(action); };
    closeButton.addEventListener('click',()=>finish(null));
    for (const button of actions.querySelectorAll('[data-family-action]')) button.addEventListener('click',()=>finish(button.dataset.familyAction === 'close' ? null : button.dataset.familyAction));
    dialog.addEventListener('cancel',event=>{event.preventDefault();if(allowClose)finish(null);});
    dialog.addEventListener('close',()=>{if(allowClose)finish(null);});
    dialog.showModal();
  });
}

export function installFamilyMemory({gameScreen, getState}) {
  const document = gameScreen.ownerDocument, trigger = gameScreen.querySelector('.life-chip');
  if (!trigger) return {dispose() {}};
  const old = {role:trigger.getAttribute('role'), tabindex:trigger.getAttribute('tabindex'), label:trigger.getAttribute('aria-label')};
  trigger.setAttribute('role', 'button'); trigger.tabIndex = 0; trigger.setAttribute('aria-label', '一族の詳細をひらく'); trigger.classList.add('family-memory-trigger');
  let opening = false;
  const open = async () => { const state = getState(); if (!state || opening) return; opening = true; try { await openFamilyHome({document,state,source:'game',mode:'view',allowClose:true}); } finally { opening = false; } };
  const key = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); void open(); } };
  trigger.addEventListener('click', open); trigger.addEventListener('keydown', key);
  return {dispose() { trigger.removeEventListener('click', open); trigger.removeEventListener('keydown', key); trigger.classList.remove('family-memory-trigger'); for (const [key, value] of Object.entries({'role':old.role, 'tabindex':old.tabindex, 'aria-label':old.label})) { if (value === null) trigger.removeAttribute(key); else trigger.setAttribute(key, value); } }};
}
