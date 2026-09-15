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
    // The unified 演舞 picker first activates the performance tab. That queues
    // cleanup for the previous battle view. Open Tidebreak in the next microtask
    // so that stale cleanup runs first and cannot immediately close the new battle.
    queueMicrotask(() => battleTab.click());
  });
  grid.append(button);
}

// Add the entry after performance-shell has bound its choreography modes.
// Tidebreak remains owned by the battle shell while sharing the 演舞 picker.
queueMicrotask(installAutoBattlePerformanceEntry);
