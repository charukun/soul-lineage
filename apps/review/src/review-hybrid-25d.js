const legacy=new URLSearchParams(location.search).get('legacy25d')==='1';
if(legacy){
  const [{mountHybrid25dLab},{mountCharacter25DForge}]=await Promise.all([import('./hybrid-25d-lab.js'),import('./character25d-forge.js')]);
  mountCharacter25DForge(mountHybrid25dLab());
  document.querySelector('h1').textContent='旧Forge / Character25D v1・v2';
}else{
  const {mountSpriteSetPlayground}=await import('./sprite-set-playground.js');mountSpriteSetPlayground();
}
const build=document.querySelector('[data-build]');
if(build){const sha=String(__BUILD_INFO__?.commit||'').slice(0,12);build.textContent=sha?'source '+sha:'source unknown';}
