import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderExplanationCards, normalizeExplanationLocale} from '../src/web/explanation-ui.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('game sheets use a layered perspective stage instead of a flat trapezoid only', () => {
  const html = read('../index.html');
  const css = read('../src/web/explanation-panels.css');

  assert.match(html, /src\/web\/explanation-panels\.css/);
  assert.match(html, /class="sheet-perspective"/);
  assert.match(css, /\.sheet-perspective\s*\{/);
  assert.match(css, /perspective:\s*1200px/);
  assert.match(css, /transform-style:\s*preserve-3d/);
  assert.match(css, /\.sheet-perspective::before/);
  assert.match(css, /\.sheet-perspective::after/);
  assert.match(css, /translate3d\(/);
  assert.match(css, /rotateY\(/);
  assert.match(css, /env\(safe-area-inset-(?:top|right|bottom|left)\)/);
  assert.match(css, /min-height:\s*44px/);
});

test('tutorial cards are explicit components with depth and fluid typography', () => {
  const css = read('../src/web/explanation-panels.css');

  assert.match(css, /\.explanation-grid/);
  assert.match(css, /\.explanation-card::before/);
  assert.match(css, /\.explanation-card__face/);
  assert.match(css, /\.explanation-card__heading/);
  assert.match(css, /--card-title-size:\s*clamp\(/);
  assert.match(css, /--card-body-size:\s*clamp\(/);
  assert.doesNotMatch(css, /:has\(> p:nth-child\(4\):last-child\)/);
  assert.match(css, /body\.hunt-loop #hud \.hunt-action:not\(\[hidden\]\)/);
});

test('locale-safe renderer accepts long Latin copy without depending on Japanese paragraph counts', () => {
  const html = renderExplanationCards([
    {
      mark: 'W',
      title: 'Weiterbewegen und Abstand gewinnen',
      body: 'Move through the hunting ground while keeping enough distance from enemies to disengage safely.',
      note: 'Long localized text may wrap to additional lines without changing the component contract.'
    },
    {mark: '<', title: 'Return & secure', body: 'Reach the exit and stop inside the ring.'}
  ], {locale: 'de-DE'});

  assert.match(html, /class="explanation-grid"/);
  assert.match(html, /role="list"/);
  assert.match(html, /lang="de-DE"/);
  assert.match(html, /data-depth="left"/);
  assert.match(html, /data-depth="right"/);
  assert.match(html, /Weiterbewegen und Abstand gewinnen/);
  assert.match(html, /&lt;/);
  assert.equal(normalizeExplanationLocale('not a locale!'), 'ja');

  const css = read('../src/web/explanation-panels.css');
  assert.match(css, /:lang\(ja\)/);
  assert.match(css, /:not\(:lang\(ja\)\)/);
  assert.match(css, /hyphens:\s*auto/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /@media \(max-width: 620px\)/);
});


test('the always-visible hunt objective uses a separate face, progress wing and direct guide entry', () => {
  const html = read('../index.html');
  const css = read('../src/web/hunt-flow.css');
  const flow = read('../src/web/hunt-flow-ui.js');
  const main = read('../src/web/main.js');

  assert.match(html, /class="objective-depth__stage"/);
  assert.match(html, /class="objective-depth__face"/);
  assert.match(html, /id="objective-help"/);
  assert.match(html, /data-objective-kicker/);
  assert.match(html, /data-objective-text/);

  assert.match(css, /objective-depth__stage::before/);
  assert.match(css, /objective-depth__stage::after/);
  assert.match(css, /objective-depth__face/);
  assert.match(css, /objective-depth__wing/);
  assert.match(css, /rotateY\(-7\.5deg\)/);
  assert.match(css, /translate3d\(15px,13px,-32px\)/);
  assert.match(css, /min-height:44px/);

  assert.match(flow, /objectiveStage/);
  assert.match(flow, /objectiveKicker/);
  assert.match(flow, /objectiveText/);
  assert.match(flow, /objective-depth__wing/);
  assert.doesNotMatch(flow, /querySelector\(':scope > small'\)/);
  assert.match(main, /\$\('objective-help'\)\.onclick = \(\) => safe\(help\)/);
});
