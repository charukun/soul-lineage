// Keep this bootstrap independent of large modules so download/initialization
// errors remain visible and retryable rather than stranding the loading screen.
import {installMusicLibrary} from '@soul/shared-ui/music';

const serviceEnvironment = __BUILD_INFO__.environment;
document.title = `叡智豊満 | 百年転生 Village${serviceEnvironment === 'prod' ? '' : ` | ${serviceEnvironment.toUpperCase()}`}`;
if (!document.querySelector('link[rel="manifest"]')) {
  const manifest = document.createElement('link');
  manifest.rel = 'manifest';
  manifest.href = './manifest.webmanifest';
  document.head.append(manifest);
}
const canvas = document.querySelector('#game');
const loading = document.querySelector('#loading');
const progress = document.querySelector('#progress');
const message = document.querySelector('#loadText');
const retry = document.querySelector('#retry');
const recover = document.querySelector('#recover');
const recoverDialog = document.querySelector('#recoverDialog');
const disposeMusic=installMusicLibrary({game:'village',environment:__BUILD_INFO__.environment,defaultTrack:'v01',autoStart:false,preferDefault:true,trigger:'hidden'});
let disposeSpeech=()=>{},disposeResidentAging=()=>{};
let finished = false;
const watchdog = setTimeout(() => {
  if (finished) return;
  message.textContent = '読み込みに時間がかかっています。通信状態を確認し、再試行できます。';
  retry.hidden = false;
}, 20000);
function reportError(error) {
  clearTimeout(watchdog);
  finished = true;
  loading.hidden = false;
  canvas.dataset.renderer = 'error';
  const detail = error?.message || String(error);
  message.textContent = `村をひらけませんでした。\n${detail}`;
  retry.hidden = false;
  recover.hidden = !window.__VILLAGE_BOOT__?.canRecover();
}
retry.onclick = () => location.reload();
recover.onclick = async () => {
  recoverDialog.returnValue = 'cancel';
  const approved = await new Promise(resolve => {
    recoverDialog.addEventListener('close', () => resolve(recoverDialog.returnValue === 'recover'), { once: true });
    recoverDialog.showModal();
  });
  if (!approved) return;
  recover.disabled = true;
  try { await window.__VILLAGE_BOOT__.recover(); location.reload(); }
  catch (error) { reportError(error); recover.disabled = false; }
};
window.addEventListener('village:fatal', event => reportError(event.detail));
try {
  progress.value = 10;
  message.textContent = '村の資産と暮らしの仕組みを読み込んでいます。';
  await import('./mura-patch.js');
  await import('./runtime-scale-stack.js');
  const { boot } = await import('./web/main.js');
  const village=await boot({
    onProgress(value, text) { progress.value = value; message.textContent = text; },
  });
  const {installResidentAging}=await import('./resident-aging.js');
  disposeResidentAging=installResidentAging(village);
  const {installSharedVillageSpeech}=await import('./shared-speech-bubbles.js');
  disposeSpeech=installSharedVillageSpeech(village);
  // Preserve the single enhancement graph introduced on develop. Retired
  // entries are side-effect-free compatibility modules after consolidation.
  const {installInterface}=await import('./web/interface.js');
  installInterface(window.village);
  await import('./mura-entry-polish.js');
  let postEntryEnhancements=null;
  const loadPostEntryEnhancements=()=>postEntryEnhancements??=(async()=>{
    await import('./mura-enhancements.js');
    // Character runtime metadata wraps the final syncActor chain so later
    // presentation enhancers cannot replace the shared semantic state adapter.
    await import('./character-runtime-integration.js');
    await import('./mura-village-visual-language.js');
  })();
  window.addEventListener('village:entered',()=>{void loadPostEntryEnhancements();},{once:true});
  if(serviceEnvironment!=='prod'){
    const speedButton=document.createElement('button'),speeds=[1,5,20];
    speedButton.id='muraDebugTimeAccel';speedButton.type='button';speedButton.dataset.debugControl='time-accel';speedButton.title='クリックで 1× / 5× / 20×';
    const syncSpeedButton=()=>{const speed=Number(village.world.state.settings.speed);speedButton.textContent=`時 ${speed===0?'停止':`${speed}×`}`;speedButton.setAttribute('aria-label',`デバッグ用の時間加速。現在 ${speed===0?'停止':`${speed}倍`}`);};
    speedButton.onclick=()=>{const current=speeds.indexOf(Number(village.world.state.settings.speed));village.world.state.settings.speed=speeds[(current+1)%speeds.length];syncSpeedButton();village.activity();void village.save();};
    syncSpeedButton();document.body.append(speedButton);
  }
  clearTimeout(watchdog);
  finished = true;
  progress.value = 100;
  loading.hidden = true;
} catch (error) {
  console.error(error);
  reportError(error);
}
if (import.meta.hot) {
  import.meta.hot.accept(() => location.reload());
  import.meta.hot.dispose(()=>{disposeResidentAging();disposeSpeech();disposeMusic();});
}
