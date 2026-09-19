import {buildReviewMotionRegistry,motionRegistryCount} from './review-motion-registry.js';
import {buildMotionReviewCatalog,filterMotionReviewCatalog,REVIEW_MOTION_CATEGORY_LABELS} from './review-motion-catalog.js';

export function createMotionLibraryControls({review,el,onSelect}){
  let registry=null,catalog=[],filter='recommended',selectedIdentity=null;
  function applyFilter(next=filter){
    if(!catalog.length)return null;
    filter=next;
    const rows=filterMotionReviewCatalog(catalog,filter),motion=el('qa-motion');
    selectedIdentity=rows.some(row=>row.sourceIdentity===selectedIdentity)?selectedIdentity:rows[0]?.sourceIdentity??null;
    motion.replaceChildren(...rows.map(row=>new Option(`${row.name} · ${REVIEW_MOTION_CATEGORY_LABELS[row.category]}`,row.sourceIdentity)));
    motion.value=selectedIdentity??'';
    for(const button of document.querySelectorAll('[data-motion-filter]'))button.setAttribute('aria-pressed',String(button.dataset.motionFilter===filter));
    return selectedIdentity;
  }
  function install(){
    const animations=review.motionSourceDocument?.animations;
    if(!Array.isArray(animations)||!animations.length)return false;
    registry=buildReviewMotionRegistry(animations);catalog=buildMotionReviewCatalog(registry.motions,{perCategory:8});
    const count=el('qa-motion-count');if(count)count.textContent=`MOTION CLIPS ${motionRegistryCount(registry)}`;
    const filters=el('qa-motion-filters');
    if(filters&&!filters.childElementCount)for(const key of ['recommended','life','move','combat','reaction','other','all']){
      const button=document.createElement('button');button.type='button';button.dataset.motionFilter=key;button.textContent=REVIEW_MOTION_CATEGORY_LABELS[key];
      button.addEventListener('click',()=>{const before=selectedIdentity;const next=applyFilter(key);if(next&&next!==before)onSelect(next);});filters.append(button);
    }
    applyFilter(filter);return true;
  }
  function sync(nextRegistry){registry=nextRegistry;catalog=buildMotionReviewCatalog(registry.motions,{perCategory:8});applyFilter(filter);}
  return {install,sync,applyFilter,get registry(){return registry;},get selectedIdentity(){return selectedIdentity;},set selectedIdentity(value){selectedIdentity=value;}};
}
