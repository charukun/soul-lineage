import assert from 'node:assert/strict';
import test from 'node:test';
import { auditTransparency, combineTransparencyAudits } from '../packages/rendering/src/transparency-audit.js';

function root(children) {
  return { traverse(callback) { for (const child of children) callback(child); } };
}

const geometry = triangles => ({ index: { count: triangles * 3 } });

test('transparency audit separates blended and cutout pressure', () => {
  const opaque = { opacity: 1, transparent: false, alphaTest: 0 };
  const blended = { opacity: .6, transparent: true, alphaTest: 0 };
  const cutout = { opacity: 1, transparent: false, alphaTest: .5 };
  const audit = auditTransparency(root([
    { isMesh: true, visible: true, geometry: geometry(100), material: opaque },
    { isMesh: true, visible: true, geometry: geometry(300), material: blended },
    { isInstancedMesh: true, count: 4, visible: true, geometry: geometry(50), material: cutout },
  ]));
  assert.equal(audit.blendedDrawCalls, 1);
  assert.equal(audit.cutoutDrawCalls, 1);
  assert.equal(audit.transparentTriangleUpperBound, 300);
  assert.equal(audit.cutoutTriangleUpperBound, 200);
  assert.equal(audit.risk, 'pass');
});

test('hidden meshes are excluded and mixed material meshes use a safe upper bound', () => {
  const audit = auditTransparency(root([
    { isMesh: true, visible: false, geometry: geometry(999), material: { transparent: true, opacity: .5 } },
    { isMesh: true, visible: true, geometry: geometry(500), material: [{ opacity: 1 }, { transparent: true, opacity: .8 }] },
  ]));
  assert.equal(audit.meshes, 1);
  assert.equal(audit.blendedDrawCalls, 1);
  assert.equal(audit.transparentTriangleUpperBound, 500);
});

test('combined audit marks large alpha pressure for review', () => {
  const combined = combineTransparencyAudits([
    { blendedDrawCalls: 20, transparentTriangleUpperBound: 70000 },
    { blendedDrawCalls: 7, transparentTriangleUpperBound: 60000 },
  ]);
  assert.equal(combined.blendedDrawCalls, 27);
  assert.equal(combined.transparentTriangleUpperBound, 130000);
  assert.equal(combined.risk, 'review');
});
