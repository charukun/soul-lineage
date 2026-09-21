import {openBrandBootGate} from '@soul/shared-ui/boot-gate';
import {applyBootBrand} from '@soul/shared-ui/boot-brand';
import {rinneCrestUrl} from '@soul/assets';

const bootGate=openBrandBootGate({
  app:'village',
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
applyBootBrand({markUrl:rinneCrestUrl,wordmark:'百年転生'});
await bootGate;
