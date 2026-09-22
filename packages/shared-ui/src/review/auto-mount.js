export function mountReviewAutoInstaller(install,{doc=document,win=window,attributeFilter=['class','data-review-mode','aria-pressed']}={}){
  if(typeof install!=='function')throw new TypeError('install must be a function');
  let queued=false,destroyed=false,frame=0;
  const schedule=()=>{
    if(queued||destroyed)return;
    queued=true;
    frame=win.requestAnimationFrame(()=>{queued=false;frame=0;if(!destroyed)install();});
  };
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  const observer=new MutationObserver(schedule);
  observer.observe(doc.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter});
  return {schedule,destroy(){destroyed=true;observer.disconnect();if(frame)win.cancelAnimationFrame(frame);}};
}
