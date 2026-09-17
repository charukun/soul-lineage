import './character-workshop-ux.js';

const CHARACTER_MODEL_QUERY = 'characterModel';
const REVIEW_MODES = Object.freeze({
  character: {
    title: 'キャラ確認',
    tab: 'parts',
    description: 'キャラクターを切り替えて、向きや見た目を確認できます。ゲーム本編のデータは変わりません。',
    steps: ['キャラを選ぶ', '向きを変える', '見た目を比べる']
  },
  motion: {
    title: 'モーション確認',
    tab: 'qa',
    description: '動きを選んで再生し、速度や角度を変えて確認できます。ゲーム本編のデータは変わりません。',
    steps: ['動きを選ぶ', '再生する', '角度・速度を変える']
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

function addPreviewHints() {
  const wrap = qs('.canvas-wrap');
  if (!wrap) return;
  if (!byId('simple-review-badge')) {
    const badge = document.createElement('span');
    badge.id = 'simple-review-badge';
    badge.className = 'simple-review-badge';
    badge.textContent = 'プレビュー';
    wrap.append(badge);
  }
  if (!byId('simple-review-help')) {
    const help = document.createElement('span');
    help.id = 'simple-review-help';
    help.className = 'simple-review-help';
    help.textContent = 'ドラッグで回転 · ピンチで拡大';
    wrap.append(help);
  }
}

function addGuide(mode) {
  const controls = qs('.review-controls');
  if (!controls) return;
  let guide = byId('simple-review-guide');
  if (!guide) {
    const spec = REVIEW_MODES[mode];
    guide = document.createElement('section');
    guide.id = 'simple-review-guide';
    guide.className = 'simple-review-guide';
    guide.setAttribute('aria-label', `${spec.title}の使い方`);

    const description = document.createElement('p');
    description.className = 'simple-review-description';
    description.textContent = spec.description;
    guide.append(description);

    const steps = document.createElement('div');
    steps.className = 'simple-review-steps';
    spec.steps.forEach((label, index) => {
      const step = document.createElement('span');
      step.className = 'simple-review-step';
      const number = document.createElement('b');
      number.textContent = String(index + 1);
      step.append(number, document.createTextNode(label));
      steps.append(step);
    });
    guide.append(steps);
  }
  controls.prepend(guide);
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
  const dock = qs('.editor-dock');
  dock?.setAttribute('aria-label', spec.title);
  addPreviewHints();
  addGuide(mode);
}

function prepareCharacterReview() {
  const title = byId('character-model-title');
  if (title) title.textContent = 'キャラクターを選ぶ';
  const buildRequest = qs('[data-character-build-request]');
  buildRequest?.classList.add('simple-review-technical');
  byId('character-model-note')?.classList.add('simple-review-technical');
  byId('capture')?.classList.add('simple-review-technical');
}

function prepareMotionReview() {
  const root = byId('motion-qa');
  if (!root || byId('simple-motion-controls')) return;

  setText('qa-play', '▶ 再生');
  setText('qa-stop', '停止');
  setText('qa-prev', '1コマ戻す');
  setText('qa-next', '1コマ進む');
  setText('qa-before', '修正前と比較');
  const start = byId('qa-start');
  start?.setAttribute('aria-label', '30秒まとめて再生');
  replaceLabelText(byId('qa-motion'), '動きを選ぶ');
  replaceLabelText(byId('qa-speed'), '速度');
  replaceLabelText(byId('qa-tour'), '自動で全方向を見る');

  const basics = document.createElement('section');
  basics.id = 'simple-motion-controls';
  basics.className = 'simple-motion-controls';
  basics.setAttribute('aria-label', '基本操作');

  const motionLabel = byId('qa-motion')?.closest('label');
  const playback = byId('qa-speed')?.closest('.qa-playback');
  if (motionLabel) basics.append(motionLabel);
  if (playback) basics.append(playback);

  const cameras = byId('qa-cameras');
  const tour = byId('qa-tour')?.closest('label');
  if (cameras || tour) {
    const viewTitle = document.createElement('h3');
    viewTitle.textContent = '角度';
    basics.append(viewTitle);
    if (cameras) basics.append(cameras);
    if (tour) basics.append(tour);
  }

  const quickbar = start?.parentElement;
  if (quickbar) root.insertBefore(basics, quickbar);
  else root.prepend(basics);

  const details = byId('workshop-qa-details');
  const summary = details?.querySelector(':scope > summary');
  if (summary) summary.textContent = '詳細・問題記録';

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
  }
}

function openRequestedReview() {
  const url = new URL(location.href);
  const mode = requestedReviewMode(url);
  const requestedModel = url.searchParams.get(CHARACTER_MODEL_QUERY);
  if (!mode && !requestedModel) return;
  if (mode) prepareShell(mode);

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
        const tab = byId(`tab-${REVIEW_MODES[mode].tab}`);
        tab?.click();
        prepareShell(mode);
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
