import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PULSE_FIRST_GLANCE, PULSE_ROLE } from '../ops-board/public/pulse-contract.mjs';

const html = readFileSync(new URL('../ops-board/public/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../ops-board/public/rapid-ui.css', import.meta.url), 'utf8');
const polish = readFileSync(new URL('../ops-board/public/review-polish.css', import.meta.url), 'utf8');
const browserCheck = readFileSync(new URL('../ops-board/browser-check.mjs', import.meta.url), 'utf8');

test('PULSE first glance follows ACTIVE, APPS, ISSUES, RECENT', () => {
  assert.deepEqual(PULSE_FIRST_GLANCE, [
    PULSE_ROLE.DEVELOPMENT,
    PULSE_ROLE.DEV_PUBLICATION,
    PULSE_ROLE.HUMAN_ACTION,
    PULSE_ROLE.RECENT,
  ]);
  const positions = PULSE_FIRST_GLANCE.map(role => html.indexOf('data-pulse-role="' + role + '"'));
  assert.ok(positions.every(position => position >= 0));
  assert.ok(positions.every((position, index) => index === 0 || positions[index - 1] < position));
  for (const label of ['ACTIVE', 'APPS', 'ISSUES', 'RECENT']) assert.match(html, new RegExp('>' + label + '<'));
});

test('rapid control tower keeps the four sections compact on phone widths', () => {
  assert.match(css, /\.rapid-board\s*\{[^}]*display:grid/s);
  assert.match(css, /\.rapid-app-grid\s*\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/s);
  assert.match(css, /\.rapid-lower-grid\s*\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/s);
  assert.match(browserCheck, /first viewport exposes ACTIVE, APPS, ISSUES and RECENT/);
});

test('legacy operational diagnostics remain behind one collapsed PULSE diagnostic disclosure', () => {
  const status = html.indexOf('id="status-section"');
  const tower = html.indexOf('id="control-tower"');
  const tasks = html.indexOf('id="tasks-section"');
  const apps = html.indexOf('id="apps-section"');
  const history = html.indexOf('id="history-section"');
  assert.ok(status >= 0 && status < tower && tower < tasks && tasks < apps && apps < history);
  assert.match(html, /<strong>PULSE診断<\/strong>/);
  assert.doesNotMatch(html, /<details id="status-section"[^>]*open/);
  assert.doesNotMatch(html, /class="rapid-detail-link"/);
  assert.match(browserCheck, /#status-section > summary/);
});

test('app cards use two columns on narrow detailed view and return to three on wider screens', () => {
  assert.match(polish, /\.app-grid\s*\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/s);
  assert.match(polish, /@media\(min-width:520px\)[^{]*\{[^}]*\.app-grid\s*\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/s);
});

test('focused browser verification uses the same 520px detailed app-grid contract', () => {
  assert.match(browserCheck, /for \(const width of \[320,390,519,520,673\]\)/);
  assert.match(browserCheck, /const expectedColumns = width < 520 \? 2 : 3;/);
  assert.match(browserCheck, /metrics\.grids\.every\(n => n === expectedColumns\)/);
});
