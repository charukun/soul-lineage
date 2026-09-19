import './character-workshop-ux.js';

const CHARACTER_MODEL_QUERY = 'characterModel';
const REVIEW_MODES = Object.freeze({
  character: {
    title: 'キャラクターモデル確認',
    tab: 'parts',
    description: '実際に使うキャラクターモデルの形状・個体差・年齢差・シルエット・干渉を確認します。'
  },
  motion: {
    title: 'モーション確認',
    tab: 'qa',
    description: '動きを選んで、そのまま再生して確認します。'
  }
});

const byId = id => document.getElementById(id);
const qs = selector => document.querySelector(selector);

function requestedReviewMode(url) {
  const query = url.searchParams.get('review');
  if (REVIEW_MODES[query]) return query;
  return url.hash === '#motion-review' ? 'motion' : null;
}

function setText(id, text) {
  const node = byId(id);
  if (node && node.textContent !== text) node.textContent = text;
}

function replaceLabelText(control, text) {
  const label = control?.closest('label');
  if (!label) return;
  const textNode = [...label.childNodes].find(node => node.nodeType === 3 && node.textContent.trim());
  if (textNode) textNode.textContent = text;
  else label.prepend(document.createTextNode(text));
}

function addSummary(mode) {
  const controls = qs('.review-controls');
  if (!controls || byId('simple-review-summary')) return;
  const spec = REVIEW_MODES[mode];
  const summary = document.createElement('section');
  summary.id = 'simple-review-summary';
  summary.className = 'simple-review-summary';
  summary.setAttribute('aria-label', `${spec.title}の説明`);

  const description = document.createElement('p');
  description.textContent = spec.description;
  const gestures = document.createElement('small');
  gestures.textContent = 'ドラッグ: 回転　ピンチ: 拡大';
  summary.append(description, gestures);
  controls.prepend(summary);
}

function moveSubjectSwitcher() {
  const controls = qs('.review-controls');
  const subject = qs('.subject-row');
  const summary = byId('simple-review-summary');
  if (!controls || !subject || subject.classList.contains('simple-review-subject')) return;
  subject.classList.add('simple-review-subject');
  if (summary?.nextSibling) controls.insertBefore(subject, summary.nextSibling);
  else controls.prepend(subject);
}

function moveFrameButtonToStage() {
  const actions = qs('.stage-actions');
  const frame = byId('frame-model');
  if (!actions || !frame || actions.contains(frame)) return;
  frame.textContent = '全身';
  frame.title = 'モデル全体を表示';
  actions.append(frame);
}

function compactCharacterModelLabels() {
  const aliases = [
    [/^量産|量産モデル/i, '量産'],
    [/child\s*boy|少年/i, '少年'],
    [/child\s*girl|少女/i, '少女'],
    [/elderly\s*man|老人.*男/i, '老人 男'],
    [/elderly\s*woman|老人.*女/i, '老人 女'],
    [/kaykit\s*knight|主人公/i, '主人公']
  ];
  for (const button of document.querySelectorAll('#character-model-options [data-character-model]')) {
    const full = button.getAttribute('aria-label') || button.textContent.trim();
    if (!full) continue;
    button.setAttribute('aria-label', full);
    const alias = aliases.find(([pattern]) => pattern.test(full))?.[1];
    if (alias && button.textContent !== alias) button.textContent = alias;
  }
}

function prepareCharacterCameraStrip() {
  const actions = qs('.stage-actions');
  if (!actions) return;
  byId('camera-cycle')?.classList.add('simple-review-technical');
  byId('pause')?.classList.add('simple-review-technical');
  byId('capture')?.classList.add('simple-review-technical');
  actions.querySelector('[data-camera="overview"]')?.classList.add('simple-review-technical');
  for (const preset of ['front', 'side', 'back', 'face']) {
    const button = actions.querySelector(`[data-camera="${preset}"]`);
    if (!button) continue;
    button.hidden = false;
    button.removeAttribute('aria-hidden');
  }
}

function moveCameraControlsToStage() {
  const actions = qs('.stage-actions');
  const cameras = byId('qa-cameras');
  if (!actions || !cameras || actions.contains(cameras)) return;
  for (const node of [...actions.children]) {
    if (node !== byId('frame-model')) node.classList.add('simple-review-technical');
  }
  cameras.classList.add('simple-review-camera-strip');
  actions.prepend(cameras);
}

function prepareShell(mode) {
  const spec = REVIEW_MODES[mode];
  if (!spec) return;
  document.body.classList.add('simple-review');
  document.body.dataset.reviewMode = mode;
  document.title = `${spec.title} | 輪廻転焦`;

  const heading = qs('.stage-head h1');
  if (heading) heading.textContent = spec.title;
  const back = qs('.stage-head .back-link');
  if (back) {
    back.href = './review.html';
    back.setAttribute('aria-label', '確認メニューへ戻る');
  }
  qs('.editor-dock')?.setAttribute('aria-label', spec.title);
  addSummary(mode);
  moveSubjectSwitcher();
  moveFrameButtonToStage();
}

function prepareCharacterReview() {
  const title = byId('character-model-title');
  if (title) title.textContent = 'キャラクター';
  compactCharacterModelLabels();
  prepareCharacterCameraStrip();
  qs('[data-character-build-request]')?.classList.add('simple-review-technical');
  byId('character-model-note')?.classList.add('simple-review-technical');
}

function prepareMotionReview() {
  const root = byId('motion-qa');
  if (!root || byId('simple-motion-controls')) return;

  setText('qa-play', '▶ 再生');
  setText('qa-stop', '停止');
  setText('qa-prev', '1コマ戻す');
  setText('qa-next', '1コマ進む');
  setText('qa-before', '修正前と比較');
  byId('qa-start')?.setAttribute('aria-label', '30秒まとめて再生');
  replaceLabelText(byId('qa-motion'), '動き');
  replaceLabelText(byId('qa-speed'), '速度');
  replaceLabelText(byId('qa-tour'), '自動で全方向を見る');

  const basics = document.createElement('section');
  basics.id = 'simple-motion-controls';
  basics.className = 'simple-motion-controls';
  basics.setAttribute('aria-label', 'モーション操作');

  const motionLabel = byId('qa-motion')?.closest('label');
  const playback = byId('qa-speed')?.closest('.qa-playback');
  if (motionLabel) basics.append(motionLabel);
  if (playback) basics.append(playback);

  const quickbar = byId('qa-start')?.parentElement;
  if (quickbar) root.insertBefore(basics, quickbar);
  else root.prepend(basics);

  moveCameraControlsToStage();
  byId('qa-tour')?.closest('label')?.classList.add('simple-review-technical');
  const details = byId('workshop-qa-details');
  const summary = details?.querySelector(':scope > summary');
  if (summary) summary.textContent = '詳細';
  root.querySelector('[data-qa-count]')?.parentElement?.classList.add('simple-review-technical');
  byId('qa-record-count')?.classList.add('simple-review-technical');
  byId('qa-export')?.parentElement?.classList.add('simple-review-technical');
  byId('capture')?.classList.add('simple-review-technical');
}

function normalizeSimpleReviewLabels() {
  const mode = document.body.dataset.reviewMode;
  if (!mode) return;
  if (mode === 'motion') {
    setText('qa-play', '▶ 再生');
    setText('qa-stop', '停止');
    setText('qa-prev', '1コマ戻す');
    setText('qa-next', '1コマ進む');
    setText('qa-before', '修正前と比較');
  } else if (mode === 'character') {
    compactCharacterModelLabels();
  }
}

function openRequestedReview() {
  const url = new URL(location.href);
  const mode = requestedReviewMode(url);
  const requestedModel = url.searchParams.get(CHARACTER_MODEL_QUERY);
  if (!mode && !requestedModel) return;

  let frames = 0;
  const open = () => {
    const studio = window.characterStudio;
    const uxReady = document.body.classList.contains('workshop-ux-ready');
    if (studio && (!mode || uxReady)) {
      if (requestedModel && studio.workspace?.modelId !== requestedModel) {
        try {
          studio.workspace?.selectModel(requestedModel);
        } catch (error) {
          console.error('Character model review selection failed', error);
        }
      }
      if (mode) {
        prepareShell(mode);
        byId(`tab-${REVIEW_MODES[mode].tab}`)?.click();
        if (mode === 'character') prepareCharacterReview();
        else prepareMotionReview();

        if (url.hash === '#motion-review') {
          url.searchParams.set('review', 'motion');
          url.hash = '';
          history.replaceState(null, '', `${url.pathname}${url.search}`);
        }
      }
      normalizeSimpleReviewLabels();
      return;
    }
    if (frames++ < 180) requestAnimationFrame(open);
  };
  requestAnimationFrame(open);
}

const observer = new MutationObserver(normalizeSimpleReviewLabels);
observer.observe(document.body, { childList: true, subtree: true, characterData: true });
openRequestedReview();
