import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(path, 'utf8');

test('Visual Review Lab keeps performance review inside the shared shell', async () => {
  const [html, shell, shellCss, childHtml, childBridge, childCss] = await Promise.all([
    read('apps/rinne/review.html'),
    read('apps/rinne/src/review/performance-shell.js'),
    read('apps/rinne/src/review/performance-shell.css'),
    read('apps/rinne/public/simulator/motion-review.html'),
    read('apps/rinne/public/simulator/src/motion-review-embed.js'),
    read('apps/rinne/public/simulator/src/motion-review-embed.css')
  ]);

  assert.match(html, /data-review-tab="演舞"/);
  assert.match(html, /data-review-page="演舞"/);
  assert.match(html, /id="performance-stage"[^>]+embed=1/);
  assert.doesNotMatch(html, /authored-slash-launch/);
  assert.match(html, /data-performance-mode="posture"/);
  assert.match(html, /data-performance-mode="sequence"/);
  assert.match(html, /data-performance-mode="combination"/);
  assert.match(html, /data-performance-mode="baseline"/);
  assert.match(shell, /visual-review-performance-control/);
  assert.match(shell, /visual-review-performance-state/);
  assert.match(shell, /canvas\.hidden = active/);
  assert.match(shell, /send\('pause'\)/);
  assert.match(shell, /review-primary-switch/);
  assert.match(shell, /notebook\.insertBefore\(performancePage, secondary\)/);
  assert.match(shellCss, /\.performance-stage/);
  assert.match(childHtml, /motion-review-embed\.css/);
  assert.match(childHtml, /motion-review-embed\.js/);
  assert.match(childBridge, /event\.source !== parent/);
  assert.match(childBridge, /\['posture','sequence','combination','baseline'\]/);
  assert.match(childBridge, /case 'seek'/);
  assert.match(childBridge, /case 'view'/);
  assert.match(childCss, /\.embedded-review \.controls\{display:none!important\}/);
});
