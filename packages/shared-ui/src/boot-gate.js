const ID='soul-brand-boot';
function unlockAudio(){
  window.__SOUL_AUDIO_UNLOCKED__=true;
  const C=window.AudioContext||window.webkitAudioContext;
  if(C)try{const c=window.__SOUL_AUDIO_GATE_CONTEXT__??new C;window.__SOUL_AUDIO_GATE_CONTEXT__=c;void c.resume()}catch{}
  window.dispatchEvent(new CustomEvent('soul:audio-unlocked'));
}
export function openBrandBootGate({app='rinne'}={}){
  if(typeof document==='undefined')return Promise.resolve();
  const style=document.createElement('style');
  style.textContent='#soul-brand-boot{position:fixed;inset:0;z-index:2147483000;width:100%;height:100dvh;border:0;display:grid;place-items:center;background:radial-gradient(circle at 50% 42%,#252832,#101219 52%,#08090d);color:#f7f0e2;cursor:pointer;touch-action:manipulation}#soul-brand-boot .lock{display:grid;justify-items:center;gap:14px;transform:translateY(-2vh);transition:.45s ease}#soul-brand-boot svg{width:min(22vw,100px)}#soul-brand-boot svg *{fill:none;stroke:currentColor;stroke-width:4;stroke-linecap:round;stroke-linejoin:round}#soul-brand-boot .orbit{opacity:.3;stroke-width:1.4;stroke-dasharray:2 7;transform-origin:50% 50%;animation:soulOrbit 7s linear infinite}#soul-brand-boot .name{font-family:"Hiragino Mincho ProN","Yu Mincho",serif;font-size:clamp(25px,7vw,44px);font-weight:600;letter-spacing:.22em;text-indent:.22em;white-space:nowrap}#soul-brand-boot .roman{font:600 9px ui-sans-serif,system-ui;letter-spacing:.34em;text-indent:.34em;opacity:.5}#soul-brand-boot .tap{position:absolute;bottom:max(8vh,48px);display:grid;justify-items:center;gap:8px;font:500 10px ui-sans-serif,system-ui;letter-spacing:.18em;color:#fff9}#soul-brand-boot .tap i{width:36px;height:36px;border:1px solid #fff5;border-radius:50%;box-shadow:inset 0 0 0 14px transparent;animation:soulTap 1.7s ease-in-out infinite}#soul-brand-boot.leave{opacity:0;transition:opacity .45s ease}#soul-brand-boot.leave .lock{transform:translateY(-2vh) scale(.94);opacity:0}@keyframes soulTap{50%{transform:scale(.82);box-shadow:inset 0 0 0 14px #fff1}}@keyframes soulOrbit{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){#soul-brand-boot .orbit,#soul-brand-boot .tap i{animation:none}}';
  document.head.append(style);
  const old=document.documentElement.style.overflow;
  document.documentElement.style.overflow='hidden';
  const el=document.createElement('button');
  el.id=ID;el.type='button';el.dataset.app=app;el.setAttribute('aria-label','輪廻転焦を起動する');
  el.innerHTML='<span class="lock" aria-hidden="true"><svg viewBox="0 0 100 100"><circle class="orbit" cx="50" cy="50" r="43"/><path d="M50 14c-8 11-12 20-12 28 0 8 5 14 12 17 7-3 12-9 12-17 0-8-4-17-12-28Z"/><path d="M50 86c8-11 12-20 12-28 0-8-5-14-12-17-7 3-12 9-12 17 0 8 4 17 12 28Z"/><path d="M20 50h60"/></svg><span class="name">輪廻転焦</span><span class="roman">SOUL LINEAGE</span></span><span class="tap" aria-hidden="true"><i></i><span>TOUCH</span></span>';
  document.body.append(el);
  return new Promise(resolve=>{let done=false;const enter=()=>{if(done)return;done=true;unlockAudio();el.disabled=true;el.classList.add('leave');setTimeout(()=>{el.remove();style.remove();document.documentElement.style.overflow=old;resolve()},500)};el.addEventListener('pointerup',enter,{once:true});el.addEventListener('click',e=>{if(e.detail===0)enter()},{once:true})});
}
