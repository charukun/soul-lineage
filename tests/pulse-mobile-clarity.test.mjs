import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../ops-board/public/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../ops-board/public/progressive-disclosure.css', import.meta.url), 'utf8');
const polish = readFileSync(new URL('../ops-board/public/review-polish.css', import.meta.url), 'utf8');

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
  assert.match(css, /\.overview-publication-card\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;/s);
  assert.match(css, /\.overview-publication-card > strong\s*\{[^}]*font-size:\s*clamp\(/s);
});

test('overview status and ETA text are allowed to wrap instead of being ellipsized', () => {
  const strongRule = css.match(/\.overview-card strong\s*\{([^}]*)\}/s)?.[1] || '';
  const detailRule = css.match(/\.overview-detail\s*\{([^}]*)\}/s)?.[1] || '';
  assert.match(strongRule, /white-space:\s*normal/);
  assert.match(detailRule, /white-space:\s*normal/);
  assert.doesNotMatch(strongRule, /text-overflow:\s*ellipsis/);
  assert.doesNotMatch(detailRule, /text-overflow:\s*ellipsis/);
});

test('app cards use two columns on narrow screens and return to three on wider screens', () => {
  assert.match(polish, /\.app-grid\s*\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/s);
  assert.match(polish, /@media\(min-width:520px\)[^{]*\{[^}]*\.app-grid\s*\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/s);
});
