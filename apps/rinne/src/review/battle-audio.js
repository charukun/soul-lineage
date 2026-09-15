const AudioContextCtor = globalThis.AudioContext || globalThis.webkitAudioContext;

const FIST_ATTACKS = new Set(['jab', 'straight', 'hook', 'bodyblow', 'risingfist', 'oneinch', 'barrage', 'rushfist']);

export function createBattleAudio() {
  let context = null;
  let master = null;
  let noiseBuffer = null;
  let wanted = new URLSearchParams(globalThis.location?.search || '').get('audio') !== 'off';
  let unlockArmed = true;

  function ensureContext() {
    if (!AudioContextCtor) return null;
    if (context) return context;
    context = new AudioContextCtor({ latencyHint: 'interactive' });
    master = context.createGain();
    master.gain.value = wanted ? 0.28 : 0.0001;
    master.connect(context.destination);
    return context;
  }

  function ensureNoise() {
    const ctx = ensureContext();
    if (!ctx || noiseBuffer) return noiseBuffer;
    const frames = Math.max(1, Math.floor(ctx.sampleRate * 0.45));
    noiseBuffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return noiseBuffer;
  }

  function available() {
    return Boolean(context && master && wanted && context.state === 'running');
  }

  function envelope(gain, at, peak, attack, release) {
    gain.cancelScheduledValues(at);
    gain.setValueAtTime(0.0001, at);
    gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
    gain.exponentialRampToValueAtTime(0.0001, at + attack + release);
  }

  function tone({ frequency = 160, end = 70, duration = 0.12, gain = 0.08, type = 'sine', delay = 0 } = {}) {
    if (!available()) return;
    const at = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const level = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), at);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, end), at + duration);
    envelope(level.gain, at, gain, 0.004, duration);
    oscillator.connect(level).connect(master);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.03);
  }

  function noise({ duration = 0.11, gain = 0.08, frequency = 1400, q = 0.8, delay = 0 } = {}) {
    if (!available()) return;
    const buffer = ensureNoise();
    if (!buffer) return;
    const at = context.currentTime + delay;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const level = context.createGain();
    source.buffer = buffer;
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = q;
    envelope(level.gain, at, gain, 0.003, duration);
    source.connect(filter).connect(level).connect(master);
    source.start(at);
    source.stop(at + duration + 0.03);
  }

  async function unlock() {
    const ctx = ensureContext();
    if (!ctx || !wanted) return false;
    try {
      if (ctx.state === 'suspended') await ctx.resume();
      if (ctx.state === 'running') unlockArmed = false;
      return ctx.state === 'running';
    } catch {
      return false;
    }
  }

  function setEnabled(next) {
    wanted = Boolean(next);
    if (master && context) master.gain.setTargetAtTime(wanted ? 0.28 : 0.0001, context.currentTime, 0.012);
    if (wanted) void unlock();
  }

  function attack(kind = '') {
    if (!available()) return;
    if (FIST_ATTACKS.has(kind)) {
      noise({ duration: 0.055, gain: 0.045, frequency: 560, q: 0.7 });
      tone({ frequency: 125, end: 82, duration: 0.07, gain: 0.045, type: 'triangle' });
      return;
    }
    noise({ duration: 0.16, gain: 0.055, frequency: 2100, q: 0.55 });
    tone({ frequency: 620, end: 170, duration: 0.13, gain: 0.035, type: 'sawtooth' });
  }

  function hit(strong = false) {
    if (!available()) return;
    noise({ duration: strong ? 0.16 : 0.11, gain: strong ? 0.14 : 0.09, frequency: strong ? 720 : 980, q: 0.6 });
    tone({ frequency: strong ? 118 : 155, end: strong ? 42 : 64, duration: strong ? 0.18 : 0.12, gain: strong ? 0.16 : 0.1, type: 'sine' });
    if (strong) tone({ frequency: 62, end: 36, duration: 0.22, gain: 0.1, type: 'triangle', delay: 0.015 });
  }

  function guard() {
    if (!available()) return;
    noise({ duration: 0.09, gain: 0.07, frequency: 3200, q: 1.2 });
    tone({ frequency: 780, end: 280, duration: 0.1, gain: 0.055, type: 'square' });
  }

  function knockout() {
    if (!available()) return;
    tone({ frequency: 120, end: 32, duration: 0.38, gain: 0.14, type: 'sine' });
    noise({ duration: 0.2, gain: 0.06, frequency: 420, q: 0.5, delay: 0.03 });
  }

  const autoUnlock = () => {
    if (!unlockArmed || !wanted) return;
    void unlock();
  };
  for (const type of ['pointerdown', 'touchstart', 'keydown']) {
    globalThis.addEventListener?.(type, autoUnlock, { capture: true, passive: type !== 'keydown' });
  }
  queueMicrotask(autoUnlock);

  return {
    get supported() { return Boolean(AudioContextCtor); },
    get enabled() { return Boolean(AudioContextCtor) && wanted; },
    get audible() { return available(); },
    get wanted() { return wanted; },
    unlock,
    setEnabled,
    attack,
    hit,
    guard,
    knockout,
  };
}
