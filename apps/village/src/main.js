// Keep this bootstrap independent of large modules so download/initialization
// errors remain visible and retryable rather than stranding the loading screen.
import {installMusicLibrary} from '@soul/shared-ui/music';

const canvas = document.querySelector('#game');
const loading = document.querySelector('#loading');
const progress = document.querySelector('#progress');
const message = document.querySelector('#loadText');
const retry = document.querySelector('#retry');
const recover = document.querySelector('#recover');
const disposeMusic=installMusicLibrary({game:'village',environment:__BUILD_INFO__.environment,defaultTrack:'v01',autoStart:true,preferDefault:true,trigger:'hidden'});
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
  if (!confirm('現在の保存データを退避して、新しい村を始めます。退避できなければ現在の保存は残します。続けますか？')) return;
  recover.disabled = true;
  try { await window.__VILLAGE_BOOT__.recover(); location.reload(); }
  catch (error) { reportError(error); recover.disabled = false; }
};
window.addEventListener('village:fatal', event => reportError(event.detail));
try {
  progress.value = 10;
  message.textContent = '村の資産と暮らしの仕組みを読み込んでいます。';
  await import('./mura-patch.js');
  await import('./asset-visuals.js');
  const { boot } = await import('./web/main.js');
  await boot({
    onProgress(value, text) { progress.value = value; message.textContent = text; },
  });
  await import('./mura-world-systems.js');
  await import('./mura-performance.js');
  await import('./mura-experience.js');
  await import('./mura-rotation-fix.js');
  await import('./mura-v2-ui.js');
  await import('./mura-entry-polish.js');
  document.title = document.title.replace(/^星継ぎの庭/, 'MURAAAAAAA');
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
  import.meta.hot.dispose(disposeMusic);
}
