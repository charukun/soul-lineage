import { adaptiveQualityProfile, createAdaptiveQualityGovernor } from './adaptive-quality.js';
import { classifyFrameBottleneck } from './gpu-timer.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function profileForBottleneck(profile, bottleneck) {
  const p = { ...profile };
  if (bottleneck === 'cpu') {
    p.renderScale = Math.max(profile.renderScale, profile.level >= 2 ? .9 : .95);
    p.shadowScale = Math.max(profile.shadowScale, profile.level >= 2 ? .65 : .8);
    p.textureAnisotropy = Math.max(profile.textureAnisotropy, 2);
    p.vegetationScale = Math.min(profile.vegetationScale, profile.level >= 2 ? .5 : .72);
    p.streamDistanceScale = Math.min(profile.streamDistanceScale, profile.level >= 2 ? .7 : .84);
    p.animationRateScale = profile.level === 0 ? 1 : profile.level === 1 ? .86 : profile.level === 2 ? .64 : .44;
    p.pressureAxis = 'cpu';
  } else if (bottleneck === 'gpu') {
    p.renderScale = Math.min(profile.renderScale, profile.level === 0 ? .94 : profile.renderScale);
    p.shadowScale = Math.min(profile.shadowScale, profile.level === 0 ? .85 : profile.shadowScale);
    p.vfxScale = Math.min(profile.vfxScale, profile.level === 0 ? .92 : profile.vfxScale);
    p.animationRateScale = 1;
    p.pressureAxis = 'gpu';
  } else if (bottleneck === 'mixed') {
    p.animationRateScale = profile.level <= 1 ? .9 : .72;
    p.pressureAxis = 'mixed';
  } else {
    p.animationRateScale = 1;
    p.pressureAxis = bottleneck;
  }
  return Object.freeze(p);
}

/**
 * Wraps the existing frame governor with GPU telemetry. The quality level still
 * uses the proven hysteresis, while the effective profile decides which budget
 * axis to spend so CPU pressure does not unnecessarily blur the image.
 */
export function createGpuAwareQualityGovernor({ targetFps = 60, initialLevel = 0, onChange = () => {}, bottleneckFrames = 1, ...options } = {}) {
  let candidateBottleneck = 'unknown', candidateFrames = 0;
  let bottleneck = 'unknown', gpuMs = null, cpuMs = null, lastSignature = '';
  const base = createAdaptiveQualityGovernor({ targetFps, initialLevel, ...options });

  function enrich(snapshot) {
    const frameMs = snapshot.frameMs;
    const profile = profileForBottleneck(adaptiveQualityProfile(snapshot.level), bottleneck);
    return Object.freeze({ ...snapshot, profile, bottleneck, gpuMs, cpuMs });
  }

  function notify(snapshot) {
    const value = enrich(snapshot);
    const signature = `${value.level}:${value.bottleneck}`;
    if (signature !== lastSignature) { lastSignature = signature; onChange(value); }
    return value;
  }

  return {
    observeFrame(deltaSeconds, measuredGpuMs = null) {
      const frameMs = Number(deltaSeconds) * 1000;
      if (Number.isFinite(measuredGpuMs) && measuredGpuMs >= 0) gpuMs = measuredGpuMs;
      cpuMs = Number.isFinite(frameMs) ? Math.max(0, frameMs - (gpuMs || 0)) : null;
      const observed=classifyFrameBottleneck({frameMs:Number.isFinite(frameMs)?frameMs:0,gpuMs,targetFps});
      if(observed!==candidateBottleneck){candidateBottleneck=observed;candidateFrames=0;}
      if(++candidateFrames>=Math.max(1,bottleneckFrames))bottleneck=observed;
      return notify(base.observeFrame(deltaSeconds));
    },
    setLevel(level) { return notify(base.setLevel(clamp(level, 0, 3))); },
    snapshot() { return enrich(base.snapshot()); },
  };
}
