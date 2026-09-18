export const MOTION_REFERENCE_BENCHMARK_VERSION = 1;

const PRIMARY_REFERENCE = Object.freeze({
  id: 'soldier-third-person-threejs',
  repository: 'https://github.com/achrefelouafi/SoldierThirdPersonThreeJS',
  revision: '814a5631aaff1fdb0623be8e1e9356fefe772b43',
  license: 'MIT',
  role: 'technique-reference',
  evidence: Object.freeze([
    'src/animation/Locomotion.js',
    'src/animation/Attack.js',
    'src/core/App.js',
    'README.md'
  ]),
  techniques: Object.freeze([
    'locomotion-phase-lock',
    'actual-speed-playback-rate',
    'single-transform-authority',
    'horizontal-root-motion-policy',
    'motion-warped-approach',
    'contact-coordinated-impact'
  ])
});

export const MOTION_REFERENCE_LIBRARY = Object.freeze({
  [PRIMARY_REFERENCE.id]: PRIMARY_REFERENCE
});

const finite = value => Number.isFinite(value);
const phase = value => finite(value) && value >= 0 && value <= 1;
const enumValue = (value, values, name) => {
  if (!values.includes(value)) throw new Error(`Invalid ${name}`);
  return value;
};
const number = (value, name, { min = -Infinity, max = Infinity, minExclusive = false } = {}) => {
  if (!finite(value) || (minExclusive ? value <= min : value < min) || value > max) throw new Error(`Invalid ${name}`);
  return value;
};
const boolean = (value, name) => {
  if (typeof value !== 'boolean') throw new Error(`Invalid ${name}`);
  return value;
};

export function getMotionReference(id = PRIMARY_REFERENCE.id) {
  const reference = MOTION_REFERENCE_LIBRARY[id];
  if (!reference) throw new Error('Unknown motion reference');
  return reference;
}

function normalizeInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid motion benchmark input');
  const referenceId = input.referenceId ?? PRIMARY_REFERENCE.id;
  getMotionReference(referenceId);

  const locomotion = input.locomotion;
  if (!locomotion || typeof locomotion !== 'object') throw new Error('Invalid locomotion evidence');
  const masterPhase = locomotion.masterPhase;
  const followerPhase = locomotion.followerPhase;
  if (!phase(masterPhase) || !phase(followerPhase)) throw new Error('Invalid locomotion phase');
  const normalizedLocomotion = {
    actualSpeed: number(locomotion.actualSpeed, 'actual speed', { min: 0 }),
    authoredSpeed: number(locomotion.authoredSpeed, 'authored speed', { min: 0, minExclusive: true }),
    playbackRate: number(locomotion.playbackRate, 'playback rate', { min: 0 }),
    masterPhase,
    followerPhase,
    phaseTolerance: number(locomotion.phaseTolerance ?? 0.04, 'phase tolerance', { min: 0, max: 0.5 }),
    playbackTolerance: number(locomotion.playbackTolerance ?? 0.05, 'playback tolerance', { min: 0, max: 1 })
  };

  const rootMotion = input.rootMotion;
  if (!rootMotion || typeof rootMotion !== 'object') throw new Error('Invalid root motion evidence');
  const normalizedRootMotion = {
    transformAuthority: enumValue(rootMotion.transformAuthority, ['controller', 'action', 'clip'], 'transform authority'),
    horizontalMode: enumValue(rootMotion.horizontalMode, ['frozen', 'extracted', 'clip-applied'], 'horizontal root mode'),
    replayAuthority: enumValue(rootMotion.replayAuthority, ['none', 'controller', 'action', 'clip'], 'root replay authority')
  };
  if (normalizedRootMotion.horizontalMode !== 'extracted' && normalizedRootMotion.replayAuthority !== 'none') {
    throw new Error('Ambiguous root motion ownership');
  }

  const attack = input.attack;
  if (!attack || typeof attack !== 'object') throw new Error('Invalid attack evidence');
  const warp = attack.warp;
  if (!warp || typeof warp !== 'object') throw new Error('Invalid warp evidence');
  const normalizedAttack = {
    duration: number(attack.duration, 'attack duration', { min: 0, minExclusive: true }),
    turnEnd: attack.turnEnd,
    warpStart: attack.warpStart,
    contact: attack.contact,
    recovery: attack.recovery,
    warp: {
      targetLocked: boolean(warp.targetLocked, 'warp target lock'),
      requestedDistance: number(warp.requestedDistance, 'warp requested distance', { min: 0 }),
      maxDistance: number(warp.maxDistance, 'warp max distance', { min: 0 }),
      transformWriter: enumValue(warp.transformWriter, ['controller', 'attack', 'clip'], 'warp transform writer'),
      clock: enumValue(warp.clock, ['action', 'world', 'parallel'], 'warp clock')
    }
  };
  for (const key of ['turnEnd', 'warpStart', 'contact', 'recovery']) {
    if (!phase(normalizedAttack[key])) throw new Error(`Invalid attack ${key}`);
  }
  if (!(normalizedAttack.contact < normalizedAttack.recovery)) throw new Error('Invalid attack contact/recovery timing');

  const impact = input.impact;
  if (!impact || typeof impact !== 'object') throw new Error('Invalid impact evidence');
  const normalizedImpact = {
    hitStopSeconds: number(impact.hitStopSeconds, 'hit-stop duration', { min: 0 }),
    worldTimeScale: number(impact.worldTimeScale, 'world time scale', { min: 0, max: 1, minExclusive: true }),
    cameraImpulse: boolean(impact.cameraImpulse, 'camera impulse'),
    hitReaction: boolean(impact.hitReaction, 'hit reaction'),
    cameraClock: enumValue(impact.cameraClock, ['real', 'scaled'], 'camera clock')
  };

  return { referenceId, locomotion: normalizedLocomotion, rootMotion: normalizedRootMotion, attack: normalizedAttack, impact: normalizedImpact };
}

const round = value => Math.round(value * 1e6) / 1e6;
const phaseDelta = (a, b) => {
  const d = Math.abs(a - b) % 1;
  return Math.min(d, 1 - d);
};
const criterion = (id, pass, observed, gap) => ({ id, status: pass ? 'pass' : 'gap', observed, gap: pass ? null : gap });

function evaluateNormalized(input) {
  const reference = getMotionReference(input.referenceId);
  const l = input.locomotion;
  const expectedRate = l.actualSpeed / l.authoredSpeed;
  const gaitPhaseError = phaseDelta(l.masterPhase, l.followerPhase);
  const rateError = Math.abs(l.playbackRate - expectedRate);

  const root = input.rootMotion;
  const rootOwnershipPass = root.transformAuthority === 'controller' && (
    (root.horizontalMode === 'frozen' && root.replayAuthority === 'none') ||
    (root.horizontalMode === 'extracted' && root.replayAuthority === 'controller')
  );

  const a = input.attack;
  const attackPhasePass = a.turnEnd <= a.warpStart && a.warpStart <= a.contact && a.contact < a.recovery;
  const warpPass = a.warp.targetLocked && a.warp.requestedDistance <= a.warp.maxDistance + 1e-9 && a.warp.transformWriter === 'controller' && a.warp.clock === 'action';

  const i = input.impact;
  const impactPass = i.hitStopSeconds > 0 && i.worldTimeScale < 1 && i.cameraImpulse && i.hitReaction && i.cameraClock === 'real';

  const criteria = [
    criterion('locomotion.phase-sync', gaitPhaseError <= l.phaseTolerance, { error: round(gaitPhaseError), tolerance: l.phaseTolerance }, 'Blend gaits on a shared normalized foot-contact phase.'),
    criterion('locomotion.speed-match', rateError <= l.playbackTolerance, { actualSpeed: l.actualSpeed, authoredSpeed: l.authoredSpeed, playbackRate: l.playbackRate, expectedRate: round(expectedRate), error: round(rateError), tolerance: l.playbackTolerance }, 'Scale playback from actual ground speed versus authored clip travel speed.'),
    criterion('root-motion.single-authority', rootOwnershipPass, { ...root }, 'Keep one transform authority; freeze horizontal clip travel or extract it for controller-owned replay.'),
    criterion('attack.phase-order', attackPhasePass, { turnEnd: a.turnEnd, warpStart: a.warpStart, contact: a.contact, recovery: a.recovery }, 'Face first, approach inside the authored move, contact before recovery.'),
    criterion('attack.motion-warp', warpPass, { ...a.warp }, 'Lock the target once, bound the warp, use the action clock and let the controller write the transform.'),
    criterion('impact.single-beat', impactPass, { ...i }, 'Coordinate hit-stop, camera impulse and hit reaction on the contact beat; keep camera impulse on real time.')
  ];

  return {
    schema: 'motion-reference-benchmark',
    version: MOTION_REFERENCE_BENCHMARK_VERSION,
    reference: {
      id: reference.id,
      repository: reference.repository,
      revision: reference.revision,
      license: reference.license,
      role: reference.role,
      evidence: [...reference.evidence],
      techniques: [...reference.techniques]
    },
    input,
    result: criteria.every(row => row.status === 'pass') ? 'pass' : 'gaps',
    criteria,
    visualApprovalRequired: true
  };
}

export function evaluateMotionReferenceBenchmark(input) {
  return evaluateNormalized(normalizeInput(input));
}

export function validateMotionReferenceBenchmark(evidence) {
  if (!evidence || evidence.schema !== 'motion-reference-benchmark' || evidence.version !== MOTION_REFERENCE_BENCHMARK_VERSION) throw new Error('Invalid motion benchmark evidence');
  const expected = evaluateNormalized(normalizeInput(evidence.input));
  if (JSON.stringify(evidence) !== JSON.stringify(expected)) throw new Error('Motion benchmark evidence does not match its inputs');
  return evidence;
}
