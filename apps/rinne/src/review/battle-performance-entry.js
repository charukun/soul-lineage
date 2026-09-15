const q = selector => document.querySelector(selector);

function installAutoBattlePerformanceEntry() {
  const grid = q('.performance-mode-grid');
  if (!grid || grid.querySelector('[data-performance-mode="battle"]')) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.performanceMode = 'battle';
  button.setAttribute('aria-label', '自動戦闘を観戦');
  button.innerHTML = '<span>自動戦闘</span><small>Tidebreak</small>';
  button.addEventListener('click', () => {
    const battleTab = q('[data-review-tab="battle"]');
    if (!battleTab) {
      const status = q('#review-status');
      if (status) {
        status.textContent = '自動戦闘を準備できませんでした';
        status.dataset.kind = 'error';
      }
      return;
    }
    battleTab.click();
  });
  grid.append(button);
}

// Add the entry after performance-shell has bound its four choreography modes.
// This keeps Tidebreak on the battle shell while letting the shared performance
// picker discover it through the same data-performance-mode contract.
queueMicrotask(installAutoBattlePerformanceEntry);
