import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PULSE_FIRST_GLANCE, PULSE_ROLE } from '../ops-board/public/pulse-contract.mjs';

const html = readFileSync(new URL('../ops-board/public/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../ops-board/public/rapid-ui.css', import.meta.url), 'utf8');
const polish = readFileSync(new URL('../ops-board/public/review-polish.css', import.meta.url), 'utf8');
const browserCheck = readFileSync(new URL('../ops-board/browser-check.mjs', import.meta.url), 'utf8');

test('PULSE exposes the contract-defined three operator roles first on mobile', () => {
  assert.deepEqual(PULSE_FIRST_GLANCE, [
    PULSE_ROLE.HUMAN_ACTION,
    PULSE_ROLE.DEVELOPMENT,
    PULSE_ROLE.DEV_PUBLICATION,
  ]);
  const positions = PULSE_FIRST_GLANCE.map(role => html.indexOf(`data-pulse-role="${role}"`));
  assert.ok(positions.every(position => position >= 0));
  assert.ok(positions[0] < positions[1] && positions[1] < positions[2]);
});

test('operator overview is three equal glance cards and expands DEV details only when needed', () => {
  assert.match(css, /\.pulse-overview\s*\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/s);
  assert.match(css, /\.overview-publication-card\.is-expanded\s*\{[^}]*grid-column:1\/-1/s);
  assert.match(css, /\.overview-publication-card\.is-expanded \.overview-publication-grid\s*\{[^}]*display:grid/s);
});

test('overview values stay readable without ellipsis in the compact cards', () => {
  const strongRule = css.match(/\.overview-card strong,[\s\S]*?\{([^}]*)\}/s)?.[1] || '';
  const detailRule = css.match(/\.overview-detail,[\s\S]*?\{([^}]*)\}/s)?.[1] || '';
  assert.doesNotMatch(strongRule, /text-overflow:\s*ellipsis/);
  assert.doesNotMatch(detailRule, /text-overflow:\s*ellipsis/);
});

test('app cards use two columns on narrow screens and return to three on wider screens', () => {
  assert.match(polish, /\.app-grid\s*\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/s);
  assert.match(polish, /@media\(min-width:520px\)[^{]*\{[^}]*\.app-grid\s*\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/s);
});

test('focused browser verification uses the same 520px app-grid contract', () => {
  assert.match(browserCheck, /for \(const width of \[320,390,519,520,673\]\)/);
  assert.match(browserCheck, /const expectedColumns = width < 520 \? 2 : 3;/);
  assert.match(browserCheck, /metrics\.grids\.every\(n => n === expectedColumns\)/);
  assert.doesNotMatch(browserCheck, /metrics\.grids\.every\(n => n === 3\)/);
});


test('operational control detail is collapsed behind the primary action decision', () => {
  const action = html.indexOf('id="control-headline"');
  const next = html.indexOf('id="control-next"');
  const disclosure = html.indexOf('class="control-details nested-disclosure"');
  const flow = html.indexOf('id="control-flow"');
  assert.ok(action >= 0 && action < next && next < disclosure && disclosure < flow);
  assert.doesNotMatch(html, /<details class="control-details nested-disclosure"[^>]*open/);
});

test('clarity pass keeps the operator surface compact on phone widths', () => {
  assert.match(css, /@media\(max-width:519px\)[\s\S]*\.pulse-overview\s*\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /\.overview-publication-row\s*\{[^}]*grid-template-columns:48px minmax\(0,1fr\)/s);
  assert.match(css, /\.control-details\s*\{[^}]*margin-top:5px/s);
});
