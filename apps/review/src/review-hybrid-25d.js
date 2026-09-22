import {mountHybrid25dLab} from './hybrid-25d-lab.js';
import {mountShino25dWorkshop} from './shino25d-workshop.js';

mountShino25dWorkshop(mountHybrid25dLab());

const build=document.querySelector('[data-build]');
if(build){
  const sha=String(__BUILD_INFO__?.commit||'').slice(0,12);
  build.textContent=sha?'source '+sha:'source unknown';
}
