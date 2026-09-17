// Intentionally imports neither implementation nor representation/normalization code.
// History is summarized by distinct operation receipts, so exploration may merge only
// states with identical summaries. A restart never erases this retrospective observer.
export const initialOracle = () => ({ coins: { a: 1, b: 2 }, receipts: {}, revision: 0,
  active: 1, activations: 0, errors: [] });
export function observe(before, effects) {
  const out = structuredClone(before);
  for (const effect of effects) {
    const fail = message => out.errors.push(message);
    if (effect.type === 'receipt') {
      const { raw, receipt } = effect;
      const coins = raw.version === 1 ? raw.amount : raw.amount / 1000;
      const prior = Object.hasOwn(out.receipts, raw.id) ? out.receipts[raw.id] : null;
      if (prior) {
        if (prior.key !== raw.key || prior.amount !== coins || receipt.revision !== prior.revision ||
            receipt.amount !== prior.amount || receipt.key !== prior.key || receipt.id !== raw.id) {
          fail(`operation ${raw.id} changed meaning/receipt after migration`);
        }
      } else {
        if (receipt.revision !== out.revision + 1 || receipt.amount !== coins || receipt.key !== raw.key || receipt.id !== raw.id) {
          fail('receipt does not describe the committed semantic operation');
        }
        out.coins[raw.key] += coins; out.revision++;
        out.receipts[raw.id] = { key: raw.key, amount: coins, revision: receipt.revision };
      }
    } else if (effect.type === 'activated') {
      out.activations++;
      if (out.activations !== 1 || effect.cut !== out.revision) fail('activation did not preserve the accepted operation cut');
      out.active = 2;
    } else if (effect.type === 'view') {
      if (effect.active !== out.active || effect.revision !== out.revision) fail('visibility moved outside the durable semantic prefix');
      for (const key of ['a', 'b']) {
        if (!Number.isSafeInteger(effect.rows?.[key])) fail('published representation left the exact integer domain');
        const expected = out.coins[key] * (effect.active === 2 ? 1000 : 1);
        if (effect.rows?.[key] !== expected) fail(`visible ${key} lost, duplicated or reinterpreted accepted information`);
      }
    }
  }
  return out;
}
