// Catch module download/initialization errors before the game owns its loading UI.
const boot = document.querySelector('#boot');
const progress = document.querySelector('#boot-progress');
try {
  progress.value = 1;
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
