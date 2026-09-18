/** Advance fixed combat steps from monotonic elapsed time, independent of UI frames. */
export function createHostClock(tick, startMs) {
  const step = 1 / 30;
  let previous = startMs, remainder = 0, snapshot;
  return nowMs => {
    if (!Number.isFinite(nowMs) || nowMs < previous) return snapshot;
    // Catch up ordinary background timer throttling; bound work after device suspension.
    remainder += Math.min((nowMs - previous) / 1000, 2);
    previous = nowMs;
    while (remainder + 1e-9 >= step) {
      snapshot = tick(step);
      remainder -= step;
    }
    return snapshot;
  };
}
