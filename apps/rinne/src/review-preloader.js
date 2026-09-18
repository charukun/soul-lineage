export const REVIEW_PRELOAD_GROUPS = Object.freeze({
  characters: Object.freeze({
    route: './characters.html?review=character',
    assets: Object.freeze(['./simulator/assets/kaykit/Knight.glb'])
  }),
  motion: Object.freeze({
    route: './review-motion.html',
    assets: Object.freeze(['./simulator/assets/kaykit/Knight.glb'])
  }),
  assets: Object.freeze({
    route: './review-assets.html',
    assets: Object.freeze(['./asset-review/models/kaykit-skeletons/Skeleton_Warrior.glb'])
  }),
  effects: Object.freeze({
    route: './review-effects.html',
    assets: Object.freeze([
      './simulator/assets/effekseer/docs/effekseer.js',
      './simulator/assets/effekseer/docs/effekseer.wasm',
      './simulator/assets/effekseer/samples/00_Basic/Simple_Ribbon_Sword.efkefc',
      './simulator/assets/effekseer/samples/00_Basic/Texture/SwordLine01.png'
    ])
  }),
  battle: Object.freeze({
    route: './review-battle.html',
    assets: Object.freeze([
      './simulator/assets/kaykit/Rogue.glb',
      './simulator/assets/kaykit/Rogue_Hooded.glb',
      './simulator/assets/kaykit/Knight.glb'
    ])
  })
});

export function reviewPreloadLabel(snapshot = {}) {
  if (snapshot.state === 'ready') return '準備済';
  if (snapshot.state === 'error') return '直接読込';
  if (snapshot.state === 'loading') {
    const completed = Math.max(0, Number(snapshot.completed) || 0);
    const total = Math.max(0, Number(snapshot.total) || 0);
    if (total > 0) return `準備中 ${Math.min(100, Math.round(completed / total * 100))}%`;
    return '準備中';
  }
  return '準備待ち';
}

function launcherLinks(doc = document) {
  return new Map([...doc.querySelectorAll('[data-review-target]')].map(link => [
    link.dataset.reviewTarget,
    link
  ]));
}

function renderSnapshot(links, target, snapshot) {
  const link = links.get(target);
  if (!link) return;
  const state = ['loading', 'ready', 'error'].includes(snapshot?.state) ? snapshot.state : 'queued';
  const label = reviewPreloadLabel(snapshot);
  link.dataset.preloadState = state;
  const output = link.querySelector('[data-review-preload-state]');
  if (output) output.textContent = label;
  const base = link.querySelector('.review-link-label')?.textContent?.trim() || link.textContent.trim();
  link.setAttribute('aria-label', `${base} · ${label}`);
}

async function preloadFallback(links) {
  await Promise.all(Object.entries(REVIEW_PRELOAD_GROUPS).map(async ([target, group]) => {
    const resources = [group.route, ...group.assets];
    let completed = 0;
    renderSnapshot(links, target, {state: 'loading', completed, total: resources.length});
    try {
      for (const resource of resources) {
        const response = await fetch(new URL(resource, document.baseURI), {cache: 'force-cache', credentials: 'same-origin'});
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        await response.arrayBuffer();
        completed += 1;
        renderSnapshot(links, target, {state: 'loading', completed, total: resources.length});
      }
      renderSnapshot(links, target, {state: 'ready', completed, total: resources.length});
    } catch {
      renderSnapshot(links, target, {state: 'error', completed, total: resources.length});
    }
  }));
}

async function startReviewPreload() {
  const links = launcherLinks();
  for (const target of Object.keys(REVIEW_PRELOAD_GROUPS)) {
    renderSnapshot(links, target, {state: 'loading', completed: 0, total: 0});
  }

  if (!('serviceWorker' in navigator)) {
    await preloadFallback(links);
    return;
  }

  const sessionId = `review-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  navigator.serviceWorker.addEventListener('message', event => {
    const message = event.data;
    if (message?.type !== 'rinne-review-preload-progress' || message.sessionId !== sessionId) return;
    renderSnapshot(links, message.target, message.snapshot || {});
  });

  try {
    const workerUrl = new URL('./review-preload-sw.js', document.baseURI);
    await navigator.serviceWorker.register(workerUrl, {scope: './', updateViaCache: 'none'});
    const registration = await navigator.serviceWorker.ready;
    const worker = registration.active;
    if (!worker) throw new Error('review preload worker is not active');
    worker.postMessage({
      type: 'rinne-review-preload-start',
      sessionId,
      groups: REVIEW_PRELOAD_GROUPS
    });
  } catch {
    await preloadFallback(links);
  }
}

if (typeof document !== 'undefined' && typeof navigator !== 'undefined') {
  void startReviewPreload();
}
