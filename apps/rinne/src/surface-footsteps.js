const PROFILES = Object.freeze({
  soil: { filter: 'lowpass', frequency: 1250, body: 88, noise: .09, duration: .105, thump: .019 },
  grass: { filter: 'bandpass', frequency: 2800, body: 68, noise: .055, duration: .14, thump: .012 },
  stone: { filter: 'highpass', frequency: 1800, body: 155, noise: .07, duration: .06, thump: .021 },
  wood: { filter: 'bandpass', frequency: 740, body: 112, noise: .045, duration: .09, thump: .028 },
});

/** Short, layered contacts on the existing unlocked AudioContext. No separate
 * music/context owner, queued resume sounds, downloads, or per-frame buffers. */
export function createSurfaceFootsteps({ getContext, canPlay }) {
  let buffer = null, owner = null, lastAt = -Infinity;
  const voices = new Set();
  function clear() {
    for (const voice of [...voices]) voice.stop();
    lastAt = -Infinity;
  }
  function step(contact) {
    const context = getContext(), profile = PROFILES[contact?.surface];
    if (!profile || !canPlay() || !context || context.state !== 'running' || !(contact.speed > .1)) return false;
    if (owner !== context) { clear(); owner = context; buffer = null; }
    const now = context.currentTime;
    if (now - lastAt < .13 || voices.size >= 6) return false;
    lastAt = now;
    if (!buffer) {
      buffer = context.createBuffer(1, Math.ceil(context.sampleRate * .24), context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (.6 + .4 * Math.sin(i * .41) ** 2);
    }
    const energy = Math.min(1, .36 + contact.speed / 12) * (contact.carried ? .88 : 1);
    const variation = .94 + Math.random() * .12, duration = profile.duration;
    const source = context.createBufferSource(), filter = context.createBiquadFilter(), amp = context.createGain();
    const body = context.createOscillator(), bodyAmp = context.createGain();
    source.buffer = buffer; source.playbackRate.value = variation;
    filter.type = profile.filter; filter.frequency.value = profile.frequency * variation; filter.Q.value = .7;
    amp.gain.setValueAtTime(.0001, now); amp.gain.linearRampToValueAtTime(profile.noise * energy, now + .004);
    amp.gain.exponentialRampToValueAtTime(.0001, now + duration);
    source.connect(filter).connect(amp).connect(context.destination);
    body.type = 'sine'; body.frequency.setValueAtTime(profile.body * variation, now);
    body.frequency.exponentialRampToValueAtTime(profile.body * .52, now + duration);
    bodyAmp.gain.setValueAtTime(.0001, now); bodyAmp.gain.linearRampToValueAtTime(profile.thump * energy, now + .003);
    bodyAmp.gain.exponentialRampToValueAtTime(.0001, now + duration);
    body.connect(bodyAmp).connect(context.destination);
    let stopped = false;
    const voice = { stop() {
      if (stopped) return; stopped = true;
      for (const node of [source, body]) { try { node.stop(); } catch {} }
      for (const node of [source, body, filter, amp, bodyAmp]) node.disconnect();
      voices.delete(voice);
    } };
    voices.add(voice); source.onended = voice.stop;
    source.start(now); body.start(now); source.stop(now + duration + .015); body.stop(now + duration + .01);
    return true;
  }
  return { step, clear, dispose() { clear(); buffer = owner = null; } };
}
