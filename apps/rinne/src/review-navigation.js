import './review-navigation.css';
import { REVIEW_NAVIGATION_FALLBACK, canReturnToPreviousReview } from './review-navigation-state.js';

const LEGACY_BACK_SELECTORS = [
  '.stage-head > .back-link',
  '.advanced-review .page-head > .back',
  '.battle-bar > a[aria-label="Visual Reviewへ戻る"]',
];

function removeLegacyBackControls(doc) {
  for (const selector of LEGACY_BACK_SELECTORS) {
    for (const node of doc.querySelectorAll(selector)) node.remove();
  }
}

export function installReviewNavigation(doc = document, win = window) {
  const existing = doc.querySelector('[data-review-back]');
  if (existing) return existing;

  removeLegacyBackControls(doc);
  const back = doc.createElement('a');
  back.className = 'review-back-control';
  back.dataset.reviewBack = '';
  back.href = REVIEW_NAVIGATION_FALLBACK;
  back.setAttribute('aria-label', '前の画面へ戻る');
  back.innerHTML = '<span class="review-back-arrow" aria-hidden="true">‹</span><span>戻る</span>';
  back.addEventListener('click', event => {
    if (!canReturnToPreviousReview({
      referrer: doc.referrer,
      currentHref: win.location.href,
      historyLength: win.history.length,
    })) return;
    event.preventDefault();
    win.history.back();
  });
  doc.body.prepend(back);
  return back;
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') installReviewNavigation();
