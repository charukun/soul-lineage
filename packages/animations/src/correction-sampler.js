/** Smooth only presentation correction OFFSETS, never the authored motion itself.
 * Integer source frames and a bounded cache make seeking, reverse review and
 * different display frame rates produce the same answer. evaluate must depend
 * only on frame/time and the rig/body profile; clear when that profile changes.
 */
export function createCorrectionSampler({ evaluate, fps = 60, duration, radius = 3, capacity = 96 }) {
  if (typeof evaluate !== 'function' || !Number.isFinite(duration) || duration < 0 ||
      !Number.isFinite(fps) || fps <= 0 || !Number.isInteger(radius) || radius < 1 || radius > 8 ||
      !Number.isInteger(capacity) || capacity < radius * 2 + 3 || capacity > 4096) throw new Error('Invalid correction sampler');
  const cache = new Map(), last = Math.round(duration * fps);
  const read = frame => {
    frame = Math.max(0, Math.min(last, frame));
    if (!cache.has(frame)) {
      const result = evaluate(frame / fps), copy = {};
      for (const side of ['left', 'right']) {
        copy[side] = {};
        for (const point of ['hand', 'elbow']) {
          const v = result?.[side]?.[point];
          if (!Array.isArray(v) || v.length !== 3 || !v.every(Number.isFinite)) throw new Error('Invalid correction offset');
          copy[side][point] = [...v];
        }
        if (!Number.isFinite(result[side].twist)) throw new Error('Invalid correction twist');
        copy[side].twist = result[side].twist;
      }
      cache.set(frame, copy);
      if (cache.size > capacity) cache.delete(cache.keys().next().value);
    }
    return cache.get(frame);
  };
  return {
    get size() { return cache.size; },
    clear() { cache.clear(); },
    sample(seconds) {
      if (!Number.isFinite(seconds)) throw new Error('Invalid correction time');
      const frame = Math.max(0, Math.min(last, seconds * fps)), result = {
        left: { hand: [0, 0, 0], elbow: [0, 0, 0], twist: 0 }, right: { hand: [0, 0, 0], elbow: [0, 0, 0], twist: 0 }
      };
      let total = 0;
      for (let i = Math.ceil(frame - radius); i <= Math.floor(frame + radius); i++) {
        const weight = (1 + Math.cos(Math.PI * (i - frame) / radius)) / 2;
        if (weight < 1e-12) continue;
        const value = read(i); total += weight;
        for (const side of ['left', 'right']) for (const point of ['hand', 'elbow'])
          for (let axis = 0; axis < 3; axis++) result[side][point][axis] += value[side][point][axis] * weight;
        for (const side of ['left', 'right']) result[side].twist += value[side].twist * weight;
      }
      for (const side of ['left', 'right']) for (const point of ['hand', 'elbow']) result[side][point] = result[side][point].map(v => v / total);
      for (const side of ['left', 'right']) result[side].twist /= total;
      return result;
    }
  };
}
