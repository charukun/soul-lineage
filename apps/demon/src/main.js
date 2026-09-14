// Keep service identity explicit without replacing the current in-game title or favicon.
const serviceEnvironment = __BUILD_INFO__.environment;
document.title = `尽喰廻遊 | 人間狩りの夜${serviceEnvironment === 'prod' ? '' : ` | ${serviceEnvironment.toUpperCase()}`}`;
if (!document.querySelector('link[rel="manifest"]')) {
  const manifest = document.createElement('link');
  manifest.rel = 'manifest';
  manifest.href = './manifest.webmanifest';
  document.head.append(manifest);
}
// Catch module download/initialization errors before the game owns its loading UI.
const boot = document.querySelector('#boot');
const progress = document.querySelector('#boot-progress');
try {
  progress.value = 1;
  await import('./runtime-scale-stack.js');
  const game = await import('./web/main.js');
  progress.value = 2;
  await game.boot();
  progress.value = 3;
} catch (error) {
  console.error(error);
  boot.hidden = false;
  document.querySelector('#boot-message').textContent = '夜を開けませんでした';
  document.querySelector('#boot-detail').textContent = error.message || String(error);
  document.querySelector('#boot-retry').hidden = false;
  document.querySelector('#game').dataset.renderer = 'error';
}
document.querySelector('#boot-retry').onclick = () => location.reload();

import {installMusicLibrary} from '@soul/shared-ui/music';
const disposeMusic=installMusicLibrary({
  game:'demon',
  environment:__BUILD_INFO__.environment,
  defaultTrack:'d01',
  autoStart:true,
  trigger:'hidden',
  contextNote:'この画面では単独狩りを止めています。閉じると設定画面に戻ります。'
});
if(import.meta.hot)import.meta.hot.dispose(disposeMusic);
