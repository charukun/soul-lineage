import {buildMachineReviewRecipe,isMachineReviewURL,normalizeMachineReviewRequest,MACHINE_REVIEW_DEFAULT_VIEWS,MACHINE_REVIEW_VERSION} from './machine-review-contract.js';

function installMachineReview(){
  const machineMode=isMachineReviewURL(window.location.href);
  const q=selector=>document.querySelector(selector);
  const nextFrame=()=>new Promise(resolve=>window.requestAnimationFrame(resolve));
  const lab=()=>{if(!window.__reviewLab)throw new Error('Visual Review Lab API is not ready');return window.__reviewLab;};
  const canvas=()=>{const node=q('#review-canvas');if(!node)throw new Error('Visual Review Lab canvas is unavailable');return node;};
  const setPlaying=playing=>{const api=lab(),snapshot=api.snapshot();if(Boolean(snapshot.playing)===Boolean(playing))return;const toggle=q('#play-toggle');if(!toggle)throw new Error('Visual Review Lab playback control is unavailable');toggle.click();};
  const settle=async count=>{for(let i=0;i<count;i+=1)await nextFrame();};
  const stateURL=()=>{const url=new URL(lab().stateURL());if(machineMode)url.searchParams.set('machine','1');return url.href;};

  async function captureOne({view,time,settleFrames}){
    const api=lab();api.frame(view);api.seek(time);await settle(settleFrames);
    const node=canvas(),snapshot=api.snapshot();
    return Object.freeze({
      recipe:buildMachineReviewRecipe({snapshot,view,time,width:node.width,height:node.height,stateURL:stateURL()}),
      image:node.toDataURL('image/png')
    });
  }

  async function captureSet(input={}){
    const api=lab(),before=api.snapshot();
    if(!before.loaded)throw new Error('Visual Review Lab model is not loaded');
    const request=normalizeMachineReviewRequest(input,before.time||0);
    setPlaying(false);
    try{
      const captures=[];
      for(const view of request.views)captures.push(await captureOne({view,time:request.time,settleFrames:request.settleFrames}));
      return Object.freeze({schema:'visual-machine-review-capture-set',version:MACHINE_REVIEW_VERSION,captures:Object.freeze(captures)});
    }finally{
      if(request.restore){api.frame(before.state?.camera||'three');api.seek(before.time||0);await settle(1);setPlaying(Boolean(before.playing));}
    }
  }

  const machine=Object.freeze({
    version:MACHINE_REVIEW_VERSION,
    mode:machineMode,
    defaultViews:MACHINE_REVIEW_DEFAULT_VIEWS,
    ready:()=>Boolean(window.__reviewLab?.snapshot?.().loaded),
    recipe:({view,time}={})=>{const api=lab(),snapshot=api.snapshot(),node=canvas(),camera=view||snapshot.state?.camera||'three';return buildMachineReviewRecipe({snapshot,view:camera,time:time??snapshot.time,width:node.width,height:node.height,stateURL:stateURL()});},
    capture:async input=>{const snapshot=lab().snapshot();const request=normalizeMachineReviewRequest({...input,views:[input?.view||snapshot.state?.camera||'three']},snapshot.time||0);const set=await captureSet(request);return set.captures[0];},
    captureSet
  });

  window.__reviewMachine=machine;
  document.documentElement.dataset.reviewMachine=machineMode?'machine':'human';
  document.addEventListener('review-model-loaded',async()=>{if(!machineMode)return;await settle(2);document.dispatchEvent(new CustomEvent('review-machine-ready',{detail:machine.recipe()}));});
}

if(typeof window!=='undefined'&&typeof document!=='undefined')installMachineReview();
