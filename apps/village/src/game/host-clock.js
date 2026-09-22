/** Advance fixed combat steps from monotonic elapsed time, independent of UI frames. */
export function createHostClock(tick, startMs) {
  const step = 1 / 30;
  let previous = Number.isFinite(startMs) ? startMs : null, remainder = 0, snapshot;
  return nowMs => {
    if (!Number.isFinite(nowMs)) return snapshot;
    if (previous === null) { previous = nowMs; return snapshot; }
    if (nowMs < previous) return snapshot;
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

/** Preserve accelerated world time while bounding simulation work per rendered frame. */
export function advanceAcceleratedFrame(deltaSeconds,tick,{maxSlices=8,maxSliceSeconds=1/12}={}){
  if(!Number.isFinite(deltaSeconds)||deltaSeconds<=0)return 0;
  const slices=Math.max(1,Math.min(maxSlices,Math.ceil(deltaSeconds/maxSliceSeconds))),step=deltaSeconds/slices;
  for(let i=0;i<slices;i++)tick(step);
  return slices;
}
