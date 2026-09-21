export function ensureReviewRow({id,className='',parent,before=null,doc=document}={}){
  if(!id||!parent)return null;
  let node=doc.getElementById(id);
  if(node)return node;
  node=doc.createElement('div');
  node.id=id;
  node.className=className;
  if(before)parent.insertBefore(node,before);else parent.append(node);
  return node;
}

export function moveReviewSlot(node,target){
  if(node&&target&&!target.contains(node))target.append(node);
  return node;
}

export function installReviewStageCameraSlot({
  actions=document.querySelector('.stage-actions'),
  selector='[data-camera="front"],[data-camera="side"],[data-camera="back"],[data-camera="face"]',
  groupId='review-stage-camera-options',
  label='向き',
  mountGroup,
  doc=document,
}={}){
  if(!actions||doc.getElementById(groupId))return null;
  const buttons=[...actions.querySelectorAll(selector)];
  if(buttons.length<2)return null;
  const group=doc.createElement('div');
  group.id=groupId;
  group.setAttribute('aria-label',label);
  buttons.forEach((button,index)=>{
    button.hidden=false;
    button.removeAttribute('aria-hidden');
    button.setAttribute('aria-pressed',String(index===0));
    button.addEventListener('click',()=>buttons.forEach(candidate=>candidate.setAttribute('aria-pressed',String(candidate===button))));
    group.append(button);
  });
  actions.prepend(group);
  const shell=mountGroup?.(group,label);
  actions.classList.add('review-slot-stage-actions');
  if(shell)actions.prepend(shell);
  return shell||group;
}

export function createReviewAutoInstaller(install,{doc=document,win=window,attributeFilter=['class','data-review-mode','aria-pressed']}={}){
  let queued=false,destroyed=false;
  const schedule=()=>{
    if(queued||destroyed)return;
    queued=true;
    win.requestAnimationFrame(()=>{queued=false;if(!destroyed)install();});
  };
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  const observer=new MutationObserver(schedule);
  observer.observe(doc.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter});
  return Object.freeze({schedule,destroy(){destroyed=true;observer.disconnect();}});
}
