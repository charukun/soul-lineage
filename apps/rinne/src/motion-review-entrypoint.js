const REVIEW_QUERY = 'motion';
const LABELS = Object.freeze({
  tab: '演舞レビュー',
  heading: '演舞レビュー',
  start: '▶ 30秒演舞'
});

function setText(id, text) {
  const node = document.getElementById(id);
  if (node && node.textContent !== text) node.textContent = text;
}

function normalizeMotionReviewLabels() {
  setText('tab-qa', LABELS.tab);
  setText('qa-start', LABELS.start);
  const heading = document.querySelector('#motion-qa > h2');
  if (heading && heading.textContent !== LABELS.heading) heading.textContent = LABELS.heading;
}

function openRequestedMotionReview() {
  const url = new URL(location.href);
  const requested = url.searchParams.get('review') === REVIEW_QUERY || url.hash === '#motion-review';
  if (!requested) return;

  let frames = 0;
  const open = () => {
    const tab = document.getElementById('tab-qa');
    if (tab && window.characterStudio) {
      tab.click();
      url.searchParams.delete('review');
      if (url.hash === '#motion-review') url.hash = '';
      history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
      normalizeMotionReviewLabels();
      return;
    }
    if (frames++ < 120) requestAnimationFrame(open);
  };
  requestAnimationFrame(open);
}

const observer = new MutationObserver(normalizeMotionReviewLabels);
observer.observe(document.body, { childList: true, subtree: true, characterData: true });
normalizeMotionReviewLabels();
openRequestedMotionReview();
