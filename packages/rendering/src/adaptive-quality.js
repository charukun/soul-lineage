const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const ADAPTIVE_QUALITY_LEVELS = Object.freeze([
  Object.freeze({ id: 'full', level: 0, renderScale: 1, shadowScale: 1, vegetationScale: 1, vfxScale: 1, textureAnisotropy: 8, lodDistanceScale: 1, streamDistanceScale: 1 }),
  Object.freeze({ id: 'balanced', level: 1, renderScale: .9, shadowScale: .75, vegetationScale: .86, vfxScale: .9, textureAnisotropy: 4, lodDistanceScale: .92, streamDistanceScale: .94 }),
  Object.freeze({ id: 'mobile', level: 2, renderScale: .8, shadowScale: .5, vegetationScale: .68, vfxScale: .72, textureAnisotropy: 2, lodDistanceScale: .8, streamDistanceScale: .84 }),
  Object.freeze({ id: 'survival', level: 3, renderScale: .68, shadowScale: .25, vegetationScale: .46, vfxScale: .5, textureAnisotropy: 1, lodDistanceScale: .68, streamDistanceScale: .72 }),
]);

export function adaptiveQualityProfile(level) {
  const index = clamp(Math.floor(Number(level) || 0), 0, ADAPTIVE_QUALITY_LEVELS.length - 1);
  return ADAPTIVE_QUALITY_LEVELS[index];
}

export function createAdaptiveQualityGovernor({ targetFps = 60, initialLevel = 0, degradeFrames = 28, recoverFrames = 180, cooldownFrames = 90, onChange = () => {} } = {}) {
  if (!Number.isFinite(targetFps) || targetFps < 20 || targetFps > 240) throw new Error('Invalid adaptive quality target FPS');
  let level = adaptiveQualityProfile(initialLevel).level;
  let emaMs = 1000 / targetFps;
  let lowFrames = 0, highFrames = 0, cooldown = 0, samples = 0;
  const snapshot = () => Object.freeze({ level, profile: adaptiveQualityProfile(level), fps: 1000 / emaMs, frameMs: emaMs, targetFps, samples });
  const change = next => {
    const clamped = adaptiveQualityProfile(next).level;
    if (clamped === level) return snapshot();
    level = clamped; lowFrames = 0; highFrames = 0; cooldown = cooldownFrames;
    const value = snapshot(); onChange(value); return value;
  };
  return {
    observeFrame(deltaSeconds) {
      if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0 || deltaSeconds > 1) return snapshot();
      const ms = deltaSeconds * 1000;
      emaMs += (ms - emaMs) * (samples < 30 ? .12 : .045); samples++;
      if (cooldown > 0) { cooldown--; return snapshot(); }
      const fps = 1000 / emaMs;
      if (fps < targetFps * .88) { lowFrames++; highFrames = 0; }
      else if (fps > targetFps * .985) { highFrames++; lowFrames = 0; }
      else { lowFrames = Math.max(0, lowFrames - 1); highFrames = Math.max(0, highFrames - 2); }
      if (lowFrames >= degradeFrames && level < ADAPTIVE_QUALITY_LEVELS.length - 1) return change(level + 1);
      if (highFrames >= recoverFrames && level > 0) return change(level - 1);
      return snapshot();
    },
    setLevel(next) { return change(next); },
    snapshot,
  };
}
