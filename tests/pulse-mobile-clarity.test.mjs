import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../ops-board/public/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../ops-board/public/progressive-disclosure.css', import.meta.url), 'utf8');

test('PULSE puts DEV publication first in the mobile overview', () => {
  const publication = html.indexOf('id="overview-app-card"');
  const attention = html.indexOf('id="overview-alert-card"');
  const development = html.indexOf('id="overview-task-card"');
  assert.ok(publication >= 0 && publication < attention && attention < development);
  assert.match(html, /<span class="overview-label">DEV公開<\/span>/);
  assert.match(html, /<span class="overview-label">今やること<\/span>/);
  assert.match(html, /<span class="overview-label">開発中<\/span>/);
});

test('DEV publication card spans the overview width and uses larger text', () => {
  assert.match(css, /\.overview-card-primary\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;/s);
  assert.match(css, /\.overview-card-primary strong\s*\{[^}]*font-size:\s*clamp\(/s);
});

test('overview status and ETA text are allowed to wrap instead of being ellipsized', () => {
  const strongRule = css.match(/\.overview-card strong\s*\{([^}]*)\}/s)?.[1] || '';
  const detailRule = css.match(/\.overview-detail\s*\{([^}]*)\}/s)?.[1] || '';
  assert.match(strongRule, /white-space:\s*normal/);
  assert.match(detailRule, /white-space:\s*normal/);
  assert.doesNotMatch(strongRule, /text-overflow:\s*ellipsis/);
  assert.doesNotMatch(detailRule, /text-overflow:\s*ellipsis/);
});
