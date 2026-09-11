/** Timeline is authoritative for playback, frame stepping and deterministic VFX. */
export function sampleTime(time, duration, loop = true) {
  if (!Number.isFinite(time) || !Number.isFinite(duration) || duration <= 0) return 0;
  return loop ? ((time % duration) + duration) % duration : Math.max(0, Math.min(duration, time));
}
export function markerAge(time, marker, duration, loop) {
  if (![time,marker,duration].every(Number.isFinite) || marker < 0 || marker > duration || duration <= 0) return Infinity;
  const age = time - marker;
  return age >= 0 ? age : (loop ? age + duration : Infinity);
}
export function createPlayback() {
  return {time:0,duration:0,playing:false,loop:true,speed:1,
    seek(time) { this.time = sampleTime(time, this.duration, false); this.playing = false; return this.time; },
    step(delta) { return this.seek(this.time + delta); },
    update(dt) {
      if (!this.playing || !Number.isFinite(dt) || dt < 0) return this.time;
      const next = this.time + Math.min(dt, .1) * this.speed;
      this.time = sampleTime(next, this.duration, this.loop);
      if (!this.loop && next >= this.duration) this.playing = false;
      return this.time;
    },
  };
}
