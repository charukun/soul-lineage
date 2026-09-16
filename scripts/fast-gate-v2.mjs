const RINNE_RIG_QA = new Set([
  'apps/rinne/tests/motion-continuity-rig.test.mjs',
  'apps/rinne/tests/motion-quality-rig.test.mjs',
]);

const RINNE_RIG_INPUT = [
  /^packages\/(?:characters|animations|rendering)\//,
  /^apps\/rinne\/src\/(?:character-|humanoid-|.*motion|.*weapon)/,
  /^apps\/rinne\/src\/rebuild\/(?:combat|renderer|runtime-character-stage)\.js$/,
  /^apps\/rinne\/tests\/(?:authored-slash|character-|humanoid-|motion-|natural-weapon-stance|slash-motion-warp)/,
];

export function fastGateScope(plan = {}) {
  if (plan.infrastructure) return 'broad';
  if ((plan.packages || []).length) return 'shared';
  if ((plan.apps || []).length) return 'app';
  return 'none';
}

export function requiresRinneRigQa(paths = []) {
  return paths.some(path => RINNE_RIG_INPUT.some(pattern => pattern.test(path)));
}

export function splitFastTests(tests = [], paths = [], { broad = false } = {}) {
  if (broad) return { light: [...tests], heavy: [], skippedHeavy: [] };
  const runRinneRig = requiresRinneRigQa(paths);
  const light = [], heavy = [], skippedHeavy = [];
  for (const test of tests) {
    if (!RINNE_RIG_QA.has(test)) {
      light.push(test);
      continue;
    }
    if (runRinneRig) heavy.push(test);
    else skippedHeavy.push(test);
  }
  return { light, heavy, skippedHeavy };
}

export function summarizeFastGate({ scope, checkedWorkspaces = [], light = [], heavy = [], skippedHeavy = [] } = {}) {
  return {
    scope,
    checkedWorkspaces,
    lightTests: light.length,
    heavyTests: heavy.length,
    skippedHeavyTests: skippedHeavy,
  };
}
