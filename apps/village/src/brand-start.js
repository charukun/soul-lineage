import './web/dialog-exit-contract.css';
import {openBrandBootGate} from '@soul/shared-ui/boot-gate';

await openBrandBootGate({
  load:async report=>{
    const progress=document.getElementById('progress');
    const update=()=>report((Number(progress?.value)||0)/(Number(progress?.max)||100));
    const observer=new MutationObserver(update);
    if(progress)observer.observe(progress,{attributes:true,attributeFilter:['value']});
    update();
    await import('./main.js');
    update();
    observer.disconnect();
    if((Number(progress?.value)||0)<(Number(progress?.max)||100))throw new Error('village boot incomplete');
  },
});
