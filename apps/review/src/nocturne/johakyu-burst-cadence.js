import {compileTechniqueComposition, normalizeReviewTechnique, techniqueFromCombatForm} from '@soul/johakyu-combat/technique-composition';

// One pressure block: three real contacts per phase, then a punishable recovery.
// These are executor seconds, not a global playback or damage multiplier.
export const BURST_CADENCE = Object.freeze({strike: .2, heavyStrike: .24, strikeGap: .02, phaseGap: .06, recovery: .85});
const PHASES = Object.freeze([['jo', '序'], ['ha', '破'], ['kyu', '急']]);
const cache = new Map();

export function burstCompositionFor(weapon = 'sword') {
  if (cache.has(weapon)) return cache.get(weapon);
  const basic = techniqueFromCombatForm(`basic.${weapon}`, {weapon});
  const composition = Object.fromEntries(PHASES.map(([phase, label]) => [phase, [normalizeReviewTechnique({
    ...basic, name: `${label}・三連撃`,
    // Keep the weapon's three authored attacks and footwork. No extra windup
    // or defensive/ready stage is inserted into a committed pressure block.
    steps: basic.steps.map(step => ({...step, charge: 'none'}))
  })]]));
  const compiled = compileTechniqueComposition(composition, {weapon});
  cache.set(weapon, compiled);
  return compiled;
}

export function burstStageDuration(technique, stage) {
  const kind = stage?.step?.kind ?? stage?.kind;
  const tempo = Number.isFinite(technique?.tempo) ? Math.min(1.08, Math.max(.92, technique.tempo)) : 1;
  return (kind === 'heavy' ? BURST_CADENCE.heavyStrike : BURST_CADENCE.strike) / tempo;
}

export function burstSettleSeconds(beforePhase, afterPhase) {
  if (beforePhase === 'kyu' && afterPhase === 'jo') return BURST_CADENCE.recovery;
  return beforePhase === afterPhase ? BURST_CADENCE.strikeGap : BURST_CADENCE.phaseGap;
}
