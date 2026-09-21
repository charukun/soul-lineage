export function decorationBatchPlan({forestCount=0,edgeCount=0,batchSize=20}={}){
  const size=Math.max(1,Math.floor(Number(batchSize)||20)),plan=[];
  for(const [kind,count] of [['forest',forestCount],['edge',edgeCount]]){
    const total=Math.max(0,Math.floor(Number(count)||0));
    for(let start=0;start<total;start+=size)plan.push(Object.freeze({kind,start,end:Math.min(total,start+size)}));
  }
  return Object.freeze(plan);
}

export function scheduleDecorationBatches(tasks,{schedule=cb=>requestAnimationFrame(cb),cancel=id=>cancelAnimationFrame(id),isCurrent=()=>true,onBatch=()=>{},onDone=()=>{}}={}){
  const queue=[...(tasks||[])];let active=true,handle=null,index=0;
  const tick=()=>{
    if(!active||!isCurrent())return;
    const task=queue[index++];if(typeof task==='function'){task();onBatch(index,queue.length);}
    if(index<queue.length)handle=schedule(tick);else onDone();
  };
  // Two frames intentionally separate the synchronous hunt-entry task from decoration,
  // allowing the interactive core/HUD to paint before decorative work begins.
  handle=schedule(()=>{if(active&&isCurrent())handle=schedule(tick);});
  return()=>{active=false;if(handle!==null)cancel(handle);};
}
