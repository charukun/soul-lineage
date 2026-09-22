import {worldScaleKernel} from './world-scale-kernel.js';
self.onmessage=event=>{const{id,type,payload}=event.data||{};if(type!=='plan')return;try{self.postMessage({id,result:worldScaleKernel(payload)});}catch(error){self.postMessage({id,error:error?.message||String(error)});}};
