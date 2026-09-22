export const REVIEW_NAVIGATION_FALLBACK='https://soul-lineage-review-dev.c-okamoto.workers.dev/';

export function canReturnToPreviousReview({referrer='',currentHref='',historyLength=0}={}){
  if(!referrer||!currentHref||historyLength<=1)return false;
  try{
    const current=new URL(currentHref);
    const previous=new URL(referrer,current);
    return previous.origin===current.origin&&previous.href!==current.href;
  }catch{return false}
}

export function bindReviewBackNavigation(back,{fallbackHref=REVIEW_NAVIGATION_FALLBACK,doc=document,win=window}={}){
  if(!back)return null;
  if(fallbackHref)back.href=fallbackHref;
  if(back.dataset.reviewHistoryBound==='true')return{destroy(){}};
  const onClick=event=>{
    if(!canReturnToPreviousReview({referrer:doc.referrer,currentHref:win.location.href,historyLength:win.history.length}))return;
    event.preventDefault();
    win.history.back();
  };
  back.dataset.reviewHistoryBound='true';
  back.addEventListener('click',onClick);
  return{destroy(){back.removeEventListener('click',onClick);delete back.dataset.reviewHistoryBound;}};
}
