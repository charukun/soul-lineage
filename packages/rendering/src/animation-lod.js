const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function animationLODForDistance(distance, { hero = false, qualityLevel = 0 } = {}) {
  if (!Number.isFinite(distance) || distance < 0) throw new Error('Invalid animation LOD distance');
  if (hero) return Object.freeze({ id: 'hero', hz: 60, expressions: true, secondaryMotion: true });
  const pressure = clamp(Math.floor(Number(qualityLevel) || 0), 0, 3);
  const scale = [1, .92, .82, .72][pressure];
  if (distance < 18 * scale) return Object.freeze({ id: 'near', hz: 60, expressions: true, secondaryMotion: true });
  if (distance < 42 * scale) return Object.freeze({ id: 'mid', hz: pressure >= 2 ? 24 : 30, expressions: true, secondaryMotion: true });
  if (distance < 72 * scale) return Object.freeze({ id: 'far', hz: 15, expressions: pressure < 3, secondaryMotion: false });
  return Object.freeze({ id: 'distant', hz: 8, expressions: false, secondaryMotion: false });
}

export function createAnimationLODScheduler({ hero = false } = {}) {
  let accumulated = 0, lastTier = null;
  return {
    update(deltaSeconds, distance, qualityLevel = 0) {
      if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0 || deltaSeconds > 1) throw new Error('Invalid animation LOD delta');
      const tier = animationLODForDistance(distance, { hero, qualityLevel });
      const changed = tier.id !== lastTier;
      lastTier = tier.id;
      accumulated = Math.min(.5, accumulated + deltaSeconds);
      const interval = 1 / tier.hz;
      const shouldSample = hero || changed || accumulated + 1e-9 >= interval;
      const sampleDelta = shouldSample ? accumulated : 0;
      if (shouldSample) accumulated = Math.max(0, accumulated - interval);
      return Object.freeze({ ...tier, changed, shouldSample, sampleDelta, expressionsDue: shouldSample && tier.expressions });
    },
    reset() { accumulated = 0; lastTier = null; },
  };
}
