import {openBrandBootGate} from '@soul/shared-ui/boot-gate';

await openBrandBootGate({
  app:'demon',
  load:async report=>{
    const progress=document.getElementById('boot-progress');
    const update=()=>report((Number(progress?.value)||0)/(Number(progress?.max)||3));
    const observer=new MutationObserver(update);
    if(progress)observer.observe(progress,{attributes:true,attributeFilter:['value']});
    update();
    await import('./main.js');
    update();
    observer.disconnect();
    if((Number(progress?.value)||0)<(Number(progress?.max)||3))throw new Error('demon boot incomplete');
  },
});
