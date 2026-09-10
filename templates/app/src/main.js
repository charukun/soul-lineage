import { sharedEmblemUrl } from '@soul/assets';
import { createWorldPreview } from '@soul/rendering';
import { showStatus } from '@soul/shared-ui';
import { createWebPlatform } from '@soul/platform-web';
import { createApp } from './app.js';
import '@soul/shared-ui/style.css';
const info = __BUILD_INFO__;
const canvas = document.querySelector('#game');
const status = document.querySelector('#status');
document.title = `${info.name} | ${info.environment.toUpperCase()}`;
document.querySelector('#emblem').src = sharedEmblemUrl;
canvas.dataset.app = info.app; canvas.dataset.commit = info.commit; canvas.dataset.environment = info.environment;
try {
  const platform = createWebPlatform({ gameId: '__APP_ID__', environment: info.environment });
  const app = createApp(platform);
  const preview = createWorldPreview(canvas, app.world);
  canvas.dataset.platform = platform.id; canvas.dataset.contentVersion = app.contentVersion;
  showStatus(status, '起動完了 · 共通ワールドを読み込みました');
  if (import.meta.hot) import.meta.hot.dispose(() => preview.dispose());
} catch (error) {
  canvas.dataset.renderer = 'unavailable'; showStatus(status, '表示を開始できませんでした。WebGL2対応環境でお試しください。', 'error'); console.error(error);
}
