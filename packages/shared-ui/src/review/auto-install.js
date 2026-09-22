export function createReviewAutoInstaller(install,{root=document.documentElement,attributeFilter=['class','data-review-mode','aria-pressed']}={}){
  let queued=false,destroyed=false;
  const schedule=()=>{
    if(queued||destroyed)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;if(!destroyed)install();});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  const observer=new MutationObserver(schedule);
  observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter});
  return {schedule,destroy(){destroyed=true;observer.disconnect();}};
}

export function ensureReviewRow(id,className,parent,before=null){
  let node=document.getElementById(id);
  if(node||!parent)return node;
  node=document.createElement('div');node.id=id;node.className=className;
  if(before)parent.insertBefore(node,before);else parent.append(node);
  return node;
}

export function moveReviewControl(shell,target){if(shell&&target&&!target.contains(shell))target.append(shell);return shell;}
