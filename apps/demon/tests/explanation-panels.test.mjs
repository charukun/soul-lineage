import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('game sheets load the shared slanted explanation skin', () => {
  const html = read('../index.html');
  const css = read('../src/web/explanation-panels.css');

  assert.match(html, /src\/web\/explanation-panels\.css/);
  assert.match(html, /id="sheet" class="slanted-sheet"/);
  assert.match(css, /#sheet\.slanted-sheet \.sheet-content/);
  assert.match(css, /clip-path:\s*polygon\(/);
  assert.match(css, /env\(safe-area-inset-(?:top|right|bottom|left)\)/);
  assert.match(css, /min-height:\s*44px/);
});

test('tutorial cards and transient hunt advice share the angled panel language', () => {
  const css = read('../src/web/explanation-panels.css');

  assert.match(css, /#sheet\.slanted-sheet #sheet-body:has\(> p:nth-child\(4\):last-child\)/);
  assert.match(css, /> p:nth-child\(1\)::before \{ content: '歩'; \}/);
  assert.match(css, /> p:nth-child\(2\)::before \{ content: '喰'; \}/);
  assert.match(css, /> p:nth-child\(3\)::before \{ content: '帰'; \}/);
  assert.match(css, /body\.hunt-loop #hud \.hunt-action:not\(\[hidden\]\)/);
  assert.match(css, /@media \(max-width: 620px\)/);
});
