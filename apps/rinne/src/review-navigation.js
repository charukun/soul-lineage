import {normalizeReviewBackButton} from '@soul/shared-ui/review-shell';
import { REVIEW_NAVIGATION_FALLBACK, canReturnToPreviousReview } from './review-navigation-state.js';

export function installReviewNavigation(doc = document, win = window) {
  const header=doc.querySelector('.review-surface__header');
  const back=normalizeReviewBackButton({header,href:REVIEW_NAVIGATION_FALLBACK,ariaLabel:'前の画面へ戻る'});
  if(!back||back.dataset.reviewHistoryBound==='true')return back;
  back.dataset.reviewHistoryBound='true';
  back.addEventListener('click',event=>{
    if(!canReturnToPreviousReview({referrer:doc.referrer,currentHref:win.location.href,historyLength:win.history.length}))return;
    event.preventDefault();win.history.back();
  });
  return back;
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') installReviewNavigation();
