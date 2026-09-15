const finite = value => typeof value === 'number' && Number.isFinite(value);
const percentile = (values, p) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1))];
};

export function createPerformanceRecorder({ label = 'runtime', maxSamples = 1800 } = {}) {
  const frames = [], gpu = [], calls = [], triangles = [], memory = [], transparentCalls = [], transparentTriangles = [];
  let longFrames = 0, startedAt = Date.now();
  const trim = list => { while (list.length > maxSamples) list.shift(); };
  return {
    sample({ frameMs, gpuMs = null, drawCalls = null, triangles: tris = null, textureBytes = null, transparentDrawCalls = null, transparentTriangleUpperBound = null } = {}) {
      if (finite(frameMs) && frameMs > 0) { frames.push(frameMs); if (frameMs > 50) longFrames++; trim(frames); }
      if (finite(gpuMs) && gpuMs >= 0) { gpu.push(gpuMs); trim(gpu); }
      if (finite(drawCalls) && drawCalls >= 0) { calls.push(drawCalls); trim(calls); }
      if (finite(tris) && tris >= 0) { triangles.push(tris); trim(triangles); }
      if (finite(textureBytes) && textureBytes >= 0) { memory.push(textureBytes); trim(memory); }
      if (finite(transparentDrawCalls) && transparentDrawCalls >= 0) { transparentCalls.push(transparentDrawCalls); trim(transparentCalls); }
      if (finite(transparentTriangleUpperBound) && transparentTriangleUpperBound >= 0) { transparentTriangles.push(transparentTriangleUpperBound); trim(transparentTriangles); }
      return this.snapshot?.();
    },
    snapshot() {
      const average = list => list.length ? list.reduce((a, b) => a + b, 0) / list.length : null;
      return Object.freeze({
        label,
        startedAt,
        samples: frames.length,
        frame: { averageMs: average(frames), p50Ms: percentile(frames, .5), p95Ms: percentile(frames, .95), p99Ms: percentile(frames, .99), longFrames },
        gpu: { averageMs: average(gpu), p95Ms: percentile(gpu, .95), samples: gpu.length },
        drawCalls: { average: average(calls), p95: percentile(calls, .95) },
        triangles: { average: average(triangles), p95: percentile(triangles, .95) },
        textureBytes: { average: average(memory), p95: percentile(memory, .95) },
        transparency: {
          drawCalls: { average: average(transparentCalls), p95: percentile(transparentCalls, .95) },
          triangleUpperBound: { average: average(transparentTriangles), p95: percentile(transparentTriangles, .95) },
        },
      });
    },
    reset() {
      frames.length = gpu.length = calls.length = triangles.length = memory.length = transparentCalls.length = transparentTriangles.length = 0;
      longFrames = 0;
      startedAt = Date.now();
    },
  };
}

export function comparePerformanceSnapshots(baseline, current, {
  frameP95Ratio = 1.12,
  gpuP95Ratio = 1.15,
  drawCallRatio = 1.12,
  triangleRatio = 1.18,
  textureRatio = 1.15,
  transparencyDrawCallRatio = 1.18,
  transparencyTriangleRatio = 1.22,
  longFrameDelta = 3,
} = {}) {
  const regressions = [], warnings = [];
  const ratioCheck = (name, before, after, limit, severity = 'error') => {
    if (!finite(before) || before <= 0 || !finite(after)) return;
    const ratio = after / before;
    if (ratio > limit) (severity === 'error' ? regressions : warnings).push({ metric: name, baseline: before, current: after, ratio, limit });
  };
  ratioCheck('frame.p95Ms', baseline?.frame?.p95Ms, current?.frame?.p95Ms, frameP95Ratio);
  ratioCheck('gpu.p95Ms', baseline?.gpu?.p95Ms, current?.gpu?.p95Ms, gpuP95Ratio);
  ratioCheck('drawCalls.p95', baseline?.drawCalls?.p95, current?.drawCalls?.p95, drawCallRatio);
  ratioCheck('triangles.p95', baseline?.triangles?.p95, current?.triangles?.p95, triangleRatio, 'warning');
  ratioCheck('textureBytes.p95', baseline?.textureBytes?.p95, current?.textureBytes?.p95, textureRatio, 'warning');
  ratioCheck('transparency.drawCalls.p95', baseline?.transparency?.drawCalls?.p95, current?.transparency?.drawCalls?.p95, transparencyDrawCallRatio, 'warning');
  ratioCheck('transparency.triangleUpperBound.p95', baseline?.transparency?.triangleUpperBound?.p95, current?.transparency?.triangleUpperBound?.p95, transparencyTriangleRatio, 'warning');
  if (finite(baseline?.frame?.longFrames) && finite(current?.frame?.longFrames) && current.frame.longFrames - baseline.frame.longFrames > longFrameDelta) {
    regressions.push({ metric: 'frame.longFrames', baseline: baseline.frame.longFrames, current: current.frame.longFrames, delta: current.frame.longFrames - baseline.frame.longFrames, limit: longFrameDelta });
  }
  return Object.freeze({ pass: regressions.length === 0, regressions, warnings });
}
