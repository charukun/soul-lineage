import { sharedEmblemUrl } from '@soul/assets';
import { createWorldPreview } from '@soul/rendering';
import { showStatus } from '@soul/shared-ui';
import { createWebPlatform } from '@soul/platform-web';
import { createApp } from './app.js';
import { installVillageHostRehearsal } from './village-link.js';
import '@soul/shared-ui/style.css';
import { installOnlinePlayer } from './online.js';
const info = __BUILD_INFO__;
const canvas = document.querySelector('#game');
const status = document.querySelector('#status');
document.title = `${info.name} | ${info.environment.toUpperCase()}`;
document.querySelector('#emblem').src = sharedEmblemUrl;
canvas.dataset.app = info.app; canvas.dataset.commit = info.commit; canvas.dataset.environment = info.environment;
try {
  const platform = createWebPlatform({ gameId: 'rinne', environment: info.environment });
  const app = createApp(platform);
  const preview = createWorldPreview(canvas, app.world);
  let worldTimeMs = 0, lastFrame = performance.now(), frameId;
  const frame = now => { if (!window.__VILLAGE_WORLD_PAUSED__) worldTimeMs += Math.max(0, now - lastFrame); lastFrame = now; canvas.dataset.worldTimeMs = String(Math.round(worldTimeMs)); frameId = requestAnimationFrame(frame); };
  frameId = requestAnimationFrame(frame);
  const villageLink = installVillageHostRehearsal({
    capture: () => ({ worldTimeMs: Math.round(worldTimeMs), world: app.world, characters: [], npcs: [], randomState: null }),
    apply: checkpoint => { worldTimeMs = checkpoint.worldTimeMs; canvas.dataset.worldRevision = String(checkpoint.world?.revision ?? ''); },
  });
  canvas.dataset.platform = platform.id; canvas.dataset.contentVersion = app.contentVersion;
  showStatus(status, '起動完了 · 共通ワールドを読み込みました');
  installOnlinePlayer();
  if (import.meta.hot) import.meta.hot.dispose(() => { preview.dispose(); cancelAnimationFrame(frameId); villageLink?.then(link => link.dispose()); });
} catch (error) {
  canvas.dataset.renderer = 'unavailable'; showStatus(status, '表示を開始できませんでした。WebGL2対応環境でお試しください。', 'error'); console.error(error);
}
