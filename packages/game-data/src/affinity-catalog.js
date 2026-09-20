export const EFFECT_AFFINITIES = Object.freeze(['fire','water','ice','wind','thunder','earth','light','dark']);

export const EFFECT_AFFINITY_LABELS = Object.freeze({
  fire:'炎', water:'水', ice:'氷', wind:'風', thunder:'雷', earth:'地', light:'光', dark:'闇',
});

const EFFECT_AFFINITY_SET = new Set(EFFECT_AFFINITIES);

export function isEffectAffinity(value) {
  return typeof value === 'string' && EFFECT_AFFINITY_SET.has(value);
}

export function normalizeEffectAffinities(values=[]) {
  return [...new Set((Array.isArray(values)?values:[]).filter(isEffectAffinity))];
}
