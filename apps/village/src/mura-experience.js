const {world,view}=window.village;
const $=id=>document.getElementById(id);
const DAYS_YEAR=12;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const pad=n=>String(n).padStart(2,'0');
function installSmoothWorldTime(){
 let targetHour=world.state.time,last=performance.now();
 view.setTime=hour=>{targetHour=((hour%24)+24)%24;};
 const lerpColor=(color,hex,k)=>{const r=((hex>>16)&255)/255,g=((hex>>8)&255)/255,b=(hex&255)/255;color.r+=(r-color.r)*k;color.g+=(g-color.g)*k;color.b+=(b-color.b)*k;};
 const mixHex=(a,b,t)=>{const ar=(a>>16)&255,ag=(a>>8)&255,ab=a&255,br=(b>>16)&255,bg=(b>>8)&255,bb=b&255;return((Math.round(ar+(br-ar)*t)<<16)|(Math.round(ag+(bg-ag)*t)<<8)|Math.round(ab+(bb-ab)*t));};
 const loop=now=>{
  const dt=Math.min(.1,(now-last)/1000);last=now;
  const h=targetHour,day=smooth(5.1,7.2,h)*(1-smooth(17.0,20.2,h)),sunset=Math.max(0,1-Math.abs(h-18.15)/2.35),k=1-Math.exp(-dt/4.8);
  const baseSky=mixHex(0x263e54,0xb5d0cf,day),sky=mixHex(baseSky,0xd2a98e,sunset*.56);
  const baseSun=mixHex(0xb1c9ea,0xffe0b2,day),sun=mixHex(baseSun,0xffa864,sunset*.72);
  const hemi=mixHex(0x93afd2,0xddeafb,day),ground=mixHex(0x4c6555,0x8e9f6b,day),water=mixHex(0x345369,0x65a4ae,day);
  view.sun.intensity+=(.2+day*2.45+sunset*.28-view.sun.intensity)*k;lerpColor(view.sun.color,sun,k);
  view.hemi.intensity+=(.68+day*1.05-view.hemi.intensity)*k;lerpColor(view.hemi.color,hemi,k);lerpColor(view.hemi.groundColor,ground,k);
  lerpColor(view.scene.background,sky,k);lerpColor(view.scene.fog.color,sky,k);lerpColor(view.waterMat.uniforms.tint.value,water,k);
  view.renderer.toneMappingExposure+=(1.03+day*.09-view.renderer.toneMappingExposure)*k;
  const calendar=$('calendar');if(calendar){const hour=Math.floor(h),minute=Math.floor((h-hour)*60);calendar.textContent=`${Math.floor(world.state.clock/DAYS_YEAR)+1}年目 · ${Math.floor(world.state.clock%DAYS_YEAR)+1}日 · ${pad(hour)}:${pad(minute)}`;}
  requestAnimationFrame(loop);
 };
 requestAnimationFrame(loop);
}

installSmoothWorldTime();
window.__MURAAAAAAA_EXPERIENCE__={version:2};
