import { validate } from './core.js';
import { createSaveEnvelope, readSaveEnvelope } from '@soul/game-data';

export const SAVE_KEY = 'living-v5';
const MAX_SAVE_BYTES = 8_000_000;

/** Device-local persistence through injected ports, never a shared-host authority. */
export function createSaveStore(platform) {
  let tail = Promise.resolve();
  let blocked = false;
  let error = null;
  let revision = 0;
  const decode = text => {
    if (typeof text !== 'string' || text.length > MAX_SAVE_BYTES) throw new Error('保存データが大きすぎます');
    const envelope = readSaveEnvelope(JSON.parse(text), { gameId: 'village', playerId: 'local' });
    revision = envelope.revision;
    return validate(envelope.payload);
  };
  return {
    async load() {
      try {
        const text = await platform.storage.read(SAVE_KEY);
        const state = text === null ? null : decode(text);
        blocked = false;
        error = null;
        return state;
      } catch (cause) {
        blocked = true;
        error = cause;
        throw new Error('保存した村を読み込めませんでした。保存データは上書きしていません。', { cause });
      }
    },
    save(world) {
      if (blocked) return Promise.reject(error || new Error('保存が保護されています'));
      // Capture now, not when an earlier asynchronous write eventually completes.
      const payload = JSON.parse(world.export());
      const envelope = JSON.stringify(createSaveEnvelope({ gameId: 'village', playerId: 'local', revision: ++revision, updatedAt: platform.clock.now(), payload }));
      if (envelope.length > MAX_SAVE_BYTES) return Promise.reject(new Error('保存データが大きすぎます'));
      const operation = tail.catch(() => {}).then(() => platform.storage.write(SAVE_KEY, envelope));
      tail = operation;
      operation.then(() => { error = null; }, cause => { error = cause; });
      return operation;
    },
    async recover() {
      await tail.catch(() => {});
      const original = await platform.storage.read(SAVE_KEY);
      // A failed backup must never be followed by deletion of the original.
      if (original !== null) {
        const prefix = `${SAVE_KEY}.recovery.${platform.clock.now()}`;
        let key = prefix;
        let suffix = 0;
        while (await platform.storage.read(key) !== null) key = `${prefix}.${++suffix}`;
        await platform.storage.write(key, original);
      }
      await platform.storage.remove(SAVE_KEY);
      blocked = false;
      error = null;
      revision = 0;
    },
    flush: () => tail,
    get error() { return error; },
    get blocked() { return blocked; },
  };
}
