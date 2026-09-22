const finite = value => typeof value === 'number' && Number.isFinite(value);

/**
 * WebGL2 GPU timer based on EXT_disjoint_timer_query_webgl2.
 * It is fail-open: unsupported or disjoint devices simply report no GPU sample.
 */
export function createGpuTimer(renderer, { smoothing = .18, maxPending = 6 } = {}) {
  if (!renderer?.getContext) throw new Error('GPU timer requires a WebGLRenderer');
  const gl = renderer.getContext();
  const ext = gl?.getExtension?.('EXT_disjoint_timer_query_webgl2') || null;
  const supported = Boolean(ext && gl?.createQuery && gl?.beginQuery && gl?.endQuery);
  let active = null, lastMs = null, emaMs = null, disjoint = false, samples = 0;
  const pending = [];

  function discard(entry) {
    try { gl.deleteQuery?.(entry.query); } catch {}
  }

  function poll() {
    if (!supported) return snapshot();
    disjoint = Boolean(gl.getParameter(ext.GPU_DISJOINT_EXT));
    while (pending.length) {
      const entry = pending[0];
      if (!gl.getQueryParameter(entry.query, gl.QUERY_RESULT_AVAILABLE)) break;
      pending.shift();
      if (disjoint) { discard(entry); continue; }
      const ns = gl.getQueryParameter(entry.query, gl.QUERY_RESULT);
      discard(entry);
      const ms = Number(ns) / 1e6;
      if (!finite(ms) || ms < 0 || ms > 10000) continue;
      lastMs = ms;
      emaMs = emaMs == null ? ms : emaMs + (ms - emaMs) * smoothing;
      samples++;
    }
    return snapshot();
  }

  function snapshot() {
    return Object.freeze({ supported, active: Boolean(active), pending: pending.length, lastMs, emaMs, disjoint, samples });
  }

  return {
    supported,
    begin(label = 'frame') {
      if (!supported || active) return false;
      poll();
      const query = gl.createQuery();
      if (!query) return false;
      try {
        gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
        active = { query, label };
        return true;
      } catch {
        discard({ query }); active = null; return false;
      }
    },
    end() {
      if (!supported || !active) return false;
      try { gl.endQuery(ext.TIME_ELAPSED_EXT); }
      catch { discard(active); active = null; return false; }
      pending.push(active); active = null;
      while (pending.length > maxPending) discard(pending.shift());
      return true;
    },
    poll,
    snapshot,
    dispose() {
      if (active) { try { gl.endQuery(ext.TIME_ELAPSED_EXT); } catch {} discard(active); active = null; }
      while (pending.length) discard(pending.shift());
    },
  };
}

export function classifyFrameBottleneck({ frameMs, gpuMs = null, targetFps = 60 } = {}) {
  if (!finite(frameMs) || frameMs <= 0 || !finite(targetFps) || targetFps <= 0) return 'unknown';
  const budget = 1000 / targetFps;
  const frameHot = frameMs > budget * 1.06;
  if (!frameHot) return 'healthy';
  if (!finite(gpuMs) || gpuMs < 0) return 'unknown';
  if (gpuMs > budget * .9 || gpuMs > frameMs * .78) return 'gpu';
  if (gpuMs < budget * .66 && gpuMs < frameMs * .62) return 'cpu';
  return 'mixed';
}
