import test from 'node:test';
import assert from 'node:assert/strict';
import { createQAReport, serializeQAReport, deserializeQAReport, createAuthoringReview,
  authoringProgress, QA_WORKER_CONTRACT } from '../src/index.js';

// Synthetic contract fixtures, not motion/render/quality evidence.
const report = () => createQAReport({ reviewer: 'worker', review: {
  sequence: 'fixture', fps: 60, viewport: [390, 420], dpr: 1,
  lighting: 'fixture', motionRevision: 'after-revision', characters: []
} });
const evidence = (role, kind = 'video', camera = 'front') => ({
  role, kind, camera, uri: `fixture/${role}-${camera}.${kind === 'video' ? 'mp4' : 'png'}`,
  revision: role === 'reference' ? 'fixture/reference.mp4' : `${role}-revision`,
  range: [0, .66], speed: 1, renderer: role === 'reference' ? 'reference' : 'cpu-mesh', reviewed: true
});
function completed() {
  const r = report(), a = r.authoring;
  a.intent = 'Carry weight into the cut';
  a.source = { before: 'before-revision', after: 'after-revision', model: 'SHINO',
    rig: 'raw-humanoid', motions: ['slash'], invariants: '.66 seconds; native contact clock unchanged' };
  a.reference = { asset: 'fixture/reference.mp4', range: [0, 4], originalRange: [2.5, 6.5] };
  a.keyPoses = ['load', 'contact', 'follow-through'].map((label, i) => ({
    label, time: i * .2, support: 'left', centerOfMass: 'over supporting foot', silhouette: 'weapon clear of torso'
  }));
  a.limitations = ['CPU simplified light; WebGL and device fps unverified'];
  a.remaining = ['Needs more variation in weight transfer'];
  a.stages.blocking = { status: 'reviewed', outcome: 'improved', observation: 'Full-body shapes read in both views',
    evidence: [evidence('after', 'image'), evidence('after', 'image', 'left'), evidence('reference', 'image')] };
  for (const id of ['primary', 'polish']) a.stages[id] = {
    status: 'reviewed', outcome: 'improved', observation: 'Compared support, timing and carry-through in uninterrupted playback',
    evidence: ['before', 'after', 'reference'].map(role => evidence(role))
  };
  return r;
}

test('existing report export includes pending authoring; legacy v1 stays importable and unassessed', () => {
  const r = report();
  assert.equal(authoringProgress(r.authoring).nextStage, 'blocking');
  assert.deepEqual(deserializeQAReport(serializeQAReport(r)), r);
  delete r.authoring;
  const old = deserializeQAReport(serializeQAReport(r));
  assert.equal(authoringProgress(old.authoring).complete, false);
  assert.equal(old.visualApproval, 'pending');
  assert.equal(QA_WORKER_CONTRACT.authoringGuide, 'docs/characters/MOTION_AUTHORING.md');
});
test('completed evidence does not approve art, erase remaining problems or change the source report', () => {
  const r = completed(), before = structuredClone(r);
  assert.equal(authoringProgress(r.authoring).complete, true);
  assert.equal(authoringProgress(r.authoring).visualApproval, 'not-assessed');
  assert.deepEqual(deserializeQAReport(serializeQAReport(r)), before);
  assert.equal(r.visualApproval, 'pending');
  assert.equal(r.authoring.remaining.length, 1);
});
test('review cannot skip key poses or close polish while primary needs revision', () => {
  for (const id of ['blocking', 'primary']) {
    const r = completed();r.authoring.stages[id].status = 'revise';
    assert.throws(() => serializeQAReport(r), /requires preceding stages/);
  }
  const r = completed();r.authoring.keyPoses = [];
  assert.throws(() => serializeQAReport(r), /major full-body poses/);
});
test('normal-speed evaluation requires all three observed temporal sources', () => {
  for (const id of ['primary', 'polish']) for (const role of ['before', 'after', 'reference']) {
    for (const patch of [{ speed: .25 }, { kind: 'image' }, { reviewed: false }]) {
      const r = completed();Object.assign(r.authoring.stages[id].evidence.find(e => e.role === role), patch);
      assert.throws(() => serializeQAReport(r), /requires reviewed 1x/);
    }
  }
});
test('front-only images, stale revisions and reference range overclaims are rejected', () => {
  const r = completed();r.authoring.stages.blocking.evidence[1].camera = 'front';
  assert.throws(() => serializeQAReport(r), /front and side/);
  const stale = completed();stale.authoring.stages.primary.evidence[1].revision = 'older';
  assert.throws(() => serializeQAReport(stale), /stale evidence revision/);
  const changed = completed();changed.review.motionRevision = 'newer';
  assert.throws(() => serializeQAReport(changed), /Stale authoring source/);
  const range = completed();range.authoring.stages.primary.evidence[2].range = [0, 5];
  assert.throws(() => serializeQAReport(range), /outside inspected range/);
});
test('regression stays resumable but cannot be reviewed as a supported result', () => {
  const r = completed();r.authoring.stages.primary.outcome = 'regressed';
  assert.throws(() => serializeQAReport(r), /not a regression/);
  r.authoring.stages.primary.status = 'revise';
  r.authoring.stages.polish = createAuthoringReview().stages.polish;
  assert.equal(authoringProgress(deserializeQAReport(serializeQAReport(r)).authoring).nextStage, 'primary');
});
test('source identity, finite values, renderer provenance and CPU limitations are required', () => {
  for (const change of [
    r => { r.authoring.source.after = 'before-revision'; },
    r => { r.authoring.keyPoses[0].time = NaN; },
    r => { r.authoring.stages.primary.evidence[0].renderer = 'reference'; },
    r => { r.authoring.limitations = []; },
    r => { r.authoring.stages.polish.evidence[0].range = [0, Infinity]; },
    r => { r.authoring.stages.primary.evidence[0].speed = 0; },
    r => { r.authoring.stages.blocking.status = 'approved'; }
  ]) { const r = completed();change(r);assert.throws(() => serializeQAReport(r)); }
});
