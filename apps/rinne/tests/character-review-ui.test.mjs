import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const html = read('../characters.html');
const source = read('../src/character-review.js');
const css = read('../src/character-review.css');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);

test('simulator entry has unique controls for every literal controller binding', () => {
  assert.equal(ids.length, new Set(ids).size);
  for (const [, id] of source.matchAll(/\bel\('([^']+)'\)/g)) assert.ok(ids.includes(id), `Missing #${id}`);
  for (const gene of ['height', 'build', 'hair', 'eyes', 'skin']) assert.ok(ids.includes(`gene-${gene}`));
  for (const camera of ['overview', 'front', 'back', 'side', 'face']) assert.ok(html.includes(`data-camera="${camera}"`));
  assert.match(html, /type="module" src="\.\/src\/character-review\.js"/);
  assert.match(html, /href="\.\/src\/character-review\.css"/);
});

test('model loading stays audited, bounded and relative to the app entry', () => {
  assert.match(source, /new URL\('\.\/simulator\/assets\/SHINO_review\.vrm', location\.href\)/);
  assert.ok(source.indexOf('auditShinoDocument(json, hash)') < source.indexOf('new GLTFLoader().parseAsync(bytes'));
  assert.match(source, /if \(!audit\.approved\) throw/);
  assert.match(source, /length > MAX_MODEL_BYTES/);
  assert.match(source, /file\.size > MAX_SESSION_BYTES/);
  assert.match(source, /webglcontextlost/);
  assert.match(source, /webglcontextrestored/);
});

test('review is opt-in, uses canonical records and does not access game saves or network authority', () => {
  assert.match(source, /@soul\/rendering\/master-character-production/);
  assert.match(source, /createReviewCohort/);
  assert.match(source, /deserializeReviewSession/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|WebSocket|RTCPeerConnection|\.innerHTML\s*=/);
  assert.match(html, /本編・セーブ・通信には接続しません/);
  assert.match(html, /REVIEW ONLY/);
});

test('mobile controls wrap and frame diagnostics retain slow visible frames', () => {
  assert.match(css, /\.stage-tools\{[^}]*flex-wrap:wrap/);
  assert.match(css, /touch-action:none/);
  assert.match(source, /if \(document\.hidden \|\| !review\.ready\) return/);
  assert.doesNotMatch(source, /actual\s*<\s*\.5/);
  assert.match(source, /hardwareAcceptance: 'not-measured'/);
});
