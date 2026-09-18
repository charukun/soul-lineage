const finite = value => typeof value === 'number' && Number.isFinite(value);
const median = values => {
  if (!values.length) return null;
  const rows = [...values].sort((a,b)=>a-b), mid = Math.floor(rows.length/2);
  return rows.length % 2 ? rows[mid] : (rows[mid-1] + rows[mid]) / 2;
};

/**
 * Browsers do not expose device temperature. This governor therefore infers
 * sustained thermal/performance pressure from long-horizon frame/GPU drift.
 * It never claims to measure Celsius or battery temperature.
 */
export function createThermalTrendGovernor({
  sampleEverySeconds = 5,
  baselineSamples = 6,
  windowSamples = 12,
  warmRatio = 1.16,
  hotRatio = 1.32,
  recoverRatio = 1.08,
  confirmations = 3,
} = {}) {
  if (!(sampleEverySeconds > 0) || baselineSamples < 3 || windowSamples < 4) throw new Error('Invalid thermal trend configuration');
  let elapsed = 0, frameSum = 0, frameCount = 0, gpuSum = 0, gpuCount = 0;
  const samples = [], baselineRows = [];
  let baselineMs = null, pressure = 0, hotStreak = 0, recoverStreak = 0, lastRatio = 1;

  function commitSample() {
    if (!frameCount) return;
    const frameMs = frameSum / frameCount, gpuMs = gpuCount ? gpuSum / gpuCount : null;
    const effective = Math.max(frameMs, finite(gpuMs) ? gpuMs : 0);
    samples.push({ frameMs, gpuMs, effective }); while (samples.length > windowSamples) samples.shift();
    if (baselineRows.length < baselineSamples) {
      baselineRows.push(effective);
      baselineMs = median(baselineRows);
    } else if (baselineMs > 0) {
      const recent = median(samples.map(row => row.effective));
      lastRatio = recent / baselineMs;
      const target = lastRatio >= hotRatio ? 2 : lastRatio >= warmRatio ? 1 : 0;
      if (target > pressure) { hotStreak++; recoverStreak = 0; if (hotStreak >= confirmations) { pressure = target; hotStreak = 0; } }
      else if (target < pressure && lastRatio <= recoverRatio) { recoverStreak++; hotStreak = 0; if (recoverStreak >= confirmations * 2) { pressure = Math.max(0, pressure - 1); recoverStreak = 0; } }
      else { hotStreak = Math.max(0, hotStreak - 1); recoverStreak = Math.max(0, recoverStreak - 1); }
    }
    frameSum = frameCount = gpuSum = gpuCount = 0;
  }

  return {
    observe(deltaSeconds, frameMs, gpuMs = null) {
      if (!finite(deltaSeconds) || deltaSeconds <= 0 || deltaSeconds > 2 || !finite(frameMs) || frameMs <= 0) return this.snapshot();
      elapsed += deltaSeconds; frameSum += frameMs; frameCount++;
      if (finite(gpuMs) && gpuMs >= 0) { gpuSum += gpuMs; gpuCount++; }
      if (elapsed >= sampleEverySeconds) { elapsed %= sampleEverySeconds; commitSample(); }
      return this.snapshot();
    },
    snapshot() {
      return Object.freeze({ inferred: true, pressure, state: pressure >= 2 ? 'hot' : pressure === 1 ? 'warm' : baselineMs ? 'stable' : 'learning', recommendedMinLevel: pressure >= 2 ? 2 : pressure === 1 ? 1 : 0, baselineMs, ratio: lastRatio, samples: samples.length });
    },
    reset() { elapsed = frameSum = frameCount = gpuSum = gpuCount = 0; samples.length = baselineRows.length = 0; baselineMs = null; pressure = hotStreak = recoverStreak = 0; lastRatio = 1; },
  };
}
