export const MODEL_VERSION = 'rrp-lab/1';
export const STEP_MS = 50;
export const MODES = Object.freeze({ global: '全体配信', interest: 'Interest配信', cells: 'Cell分散' });
export const SCENARIOS = Object.freeze({ steady: '通常', host: 'Host切断・再接続', cell: 'Cell担当の切断', divergence: '破損パケット', collapse: '未観測区画への再訪' });
export const DEFAULTS = Object.freeze({ seed: 20260916, peers: 30, layout: 'spread', scenario: 'host', durationMs: 24000, latencyMs: 80, jitterMs: 20, loss: 0.01 });

export function normalizeConfig(input = {}) {
  const c = { ...DEFAULTS, ...input };
  for (const [key, min, max] of [['seed', 1, 4294967295], ['peers', 3, 30], ['durationMs', 16000, 60000], ['latencyMs', 0, 1000], ['jitterMs', 0, 500]]) {
    if (!Number.isSafeInteger(c[key]) || c[key] < min || c[key] > max) throw Error(`条件 ${key} が範囲外です。`);
  }
  if (c.durationMs % STEP_MS || !Number.isFinite(c.loss) || c.loss < 0 || c.loss > 0.5) throw Error('時間または欠落率が不正です。');
  if (!['spread', 'dense'].includes(c.layout) || !Object.hasOwn(SCENARIOS, c.scenario)) throw Error('実験条件が不明です。');
  return Object.fromEntries(Object.keys(DEFAULTS).map(key => [key, c[key]]));
}

// This checksum is for reproducible fault detection, not authentication or a cryptographic commitment.
export function checksum(value) {
  let h = 2166136261;
  for (const c of JSON.stringify(value)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0).toString(16).padStart(8, '0');
}
export function random(seed) {
  let x = seed >>> 0;
  return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; };
}
export const peerId = n => `p${String(n).padStart(2, '0')}`;
