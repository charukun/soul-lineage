import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normaliseGuideOptions} from '../src/web/angled-guide.js';
import {renderExplanationCards, normalizeExplanationLocale} from '../src/web/explanation-ui.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('explanation-only surfaces use the shared angled side guide while sheet and toast stay separate', () => {
  const html = read('../index.html');
  const css = read('../src/web/explanation-panels.css');
  const main = read('../src/web/main.js');
  const flow = read('../src/web/hunt-flow-ui.js');

  assert.match(html, /src\/web\/explanation-panels\.css/);
  assert.match(html, /id="movement-guide" class="angled-guide" data-side="right"/);
  assert.match(html, /id="first-hunt-guide" class="angled-guide" data-side="right"/);
  assert.match(html, /id="return-hint" class="angled-guide" data-side="left"/);
  assert.doesNotMatch(html, /id="sheet" class="slanted-sheet"/);
  assert.doesNotMatch(html, /class="sheet-perspective"/);
  assert.doesNotMatch(html, /id="toast"[^>]*class="angled-guide"/);

  assert.match(css, /\.angled-guide\[data-side="right"\]/);
  assert.match(css, /\.angled-guide\[data-side="left"\]/);
  assert.match(css, /clip-path:polygon\(/);
  assert.match(css, /perspective:/);
  assert.match(css, /transition-delay:20ms/);
  assert.match(css, /transition-delay:45ms/);
  assert.match(css, /width:min\(75vw,360px\)/);
  assert.match(css, /env\(safe-area-inset-(?:left|right)\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /pointer-events:none/);
  assert.match(css, /:lang\(ja\)/);
  assert.match(css, /:not\(:lang\(ja\)\)/);
  assert.match(css, /hyphens:auto/);

  assert.match(main, /createAngledGuide\(\$\('movement-guide'\)/);
  assert.match(main, /movementGuide\?\.show/);
  assert.match(flow, /this\.firstGuide = createAngledGuide/);
  assert.match(flow, /this\.returnGuide = createAngledGuide/);
});

test('guide content contract supports both sides and content replacement without changing game rules', () => {
  const right = normaliseGuideOptions({side:'right', kicker:'動きかた', title:'指を滑らせろ', body:'移動'});
  const left = normaliseGuideOptions({...right, side:'left', title:'帰路が開いた', body:'輪の中で止まる'});
  assert.equal(right.side, 'right');
  assert.equal(left.side, 'left');
  assert.equal(left.title, '帰路が開いた');
  assert.equal(left.body, '輪の中で止まる');
  assert.equal(normaliseGuideOptions({side:'unknown'}).side, 'right');
});

test('locale utilities from current develop remain safe after the side-guide migration', () => {
  const html = renderExplanationCards([
    {mark:'W', title:'Weiterbewegen und Abstand gewinnen', body:'Move through the hunting ground safely.'},
    {mark:'<', title:'Return & secure', body:'Reach the exit and stop inside the ring.'}
  ], {locale:'de-DE'});
  assert.match(html, /lang="de-DE"/);
  assert.match(html, /Weiterbewegen und Abstand gewinnen/);
  assert.match(html, /&lt;/);
  assert.equal(normalizeExplanationLocale('not a locale!'), 'ja');
});
