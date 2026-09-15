export const MACHINE_REVIEW_SCHEMA='visual-machine-review';
export const MACHINE_REVIEW_VERSION=1;
export const MACHINE_REVIEW_VIEWS=Object.freeze(['front','three','right','back','left','top']);
export const MACHINE_REVIEW_DEFAULT_VIEWS=Object.freeze(['front','three','right','back']);

const bounded=(value,fallback,min,max)=>{const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;};

export function normalizeMachineReviewRequest(input={},fallbackTime=0){
  const raw=Array.isArray(input.views)?input.views:input.view?[input.view]:MACHINE_REVIEW_DEFAULT_VIEWS;
  const views=[...new Set(raw)].filter(view=>MACHINE_REVIEW_VIEWS.includes(view));
  if(!views.length)throw new Error('Machine review requires at least one supported camera view');
  const time=bounded(input.time,fallbackTime,0,120);
  const settleFrames=Math.round(bounded(input.settleFrames,2,1,8));
  return Object.freeze({views:Object.freeze(views),time,settleFrames,restore:input.restore!==false});
}

export function buildMachineReviewRecipe({snapshot,view,time,width,height,stateURL}){
  if(!snapshot?.loaded)throw new Error('Visual Review Lab model is not loaded');
  if(!MACHINE_REVIEW_VIEWS.includes(view))throw new Error(`Unsupported machine review camera: ${view}`);
  return Object.freeze({
    schema:MACHINE_REVIEW_SCHEMA,
    version:MACHINE_REVIEW_VERSION,
    renderer:'visual-review-lab',
    renderContract:'lab-real-asset-v1',
    preset:snapshot.state?.preset||null,
    source:snapshot.source||null,
    clip:snapshot.clip||null,
    sequence:Object.freeze([...(snapshot.sequence||[])]),
    time:bounded(time,snapshot.time||0,0,120),
    camera:view,
    build:snapshot.build||null,
    width:Number(width)||0,
    height:Number(height)||0,
    stateURL:stateURL||null,
    visualApproval:'pending'
  });
}

export function isMachineReviewURL(input){
  const url=input instanceof URL?input:new URL(String(input),'https://review.invalid/');
  return url.searchParams.get('machine')==='1';
}
