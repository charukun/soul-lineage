export const PERFORMANCE_PRESETS = Object.freeze({
  quick: Object.freeze({
    id: 'quick',
    label: 'Quick mobile reference',
    deviceClass: 'synthetic-mobile-browser',
    viewport: Object.freeze({ width: 390, height: 844 }),
    minSamples: 90,
    targetFps: 30,
    targetFrameMs: 33.34,
    notes: 'Fast browser evidence. Not a physical-device claim.',
  }),
  'pixel-fold-class': Object.freeze({
    id: 'pixel-fold-class',
    label: 'Pixel Fold-class mobile reference',
    deviceClass: 'synthetic-pixel-fold-class',
    viewport: Object.freeze({ width: 412, height: 892 }),
    minSamples: 300,
    targetFps: 30,
    targetFrameMs: 33.34,
    notes: 'Deterministic browser-class reference for regression comparison. Real Pixel Fold evidence remains a separate physical-device measurement.',
  }),
});

export function performancePreset(id = 'quick') {
  const preset = PERFORMANCE_PRESETS[id];
  if (!preset) throw new Error(`Unknown performance preset: ${id}. Expected ${Object.keys(PERFORMANCE_PRESETS).join(', ')}`);
  return preset;
}

export function benchmarkVerdict(snapshot, preset) {
  const frameP95 = snapshot?.performance?.frame?.p95Ms;
  const gpuP95 = snapshot?.performance?.gpu?.p95Ms;
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  return Object.freeze({
    targetFps: preset.targetFps,
    targetFrameMs: preset.targetFrameMs,
    frameP95Ms: finite(frameP95) ? frameP95 : null,
    gpuP95Ms: finite(gpuP95) ? gpuP95 : null,
    frameTargetMeasured: finite(frameP95),
    meetsFrameTarget: finite(frameP95) ? frameP95 <= preset.targetFrameMs : null,
  });
}
