import { validate } from './core.js';
import { createSaveEnvelope, readSaveEnvelope } from '@soul/game-data';
import { createIncrementalPatch, appendJournalEntry, replayJournal, shouldCompactJournal, journalBytes } from '@soul/world/incremental-journal';

export const SAVE_KEY = 'living-v5';
const JOURNAL_KEY = `${SAVE_KEY}.journal.v1`;
const COMPACT_KEY = `${SAVE_KEY}.compact.v1`;
const MAX_SAVE_BYTES = 8_000_000;
const SAVE_ATTEMPTS = 3;
const RETRY_DELAY_MS = 40;
let freshVillageLoad = false;

/** Consumed by the post-boot first-run director after boot has safely created the canonical save. */
export function consumeFreshVillageLoad() {
  const fresh = freshVillageLoad;
  freshVillageLoad = false;
  return fresh;
}

const emptyJournal = baseRevision => ({ version: 1, baseRevision, entries: [] });

function parseEnvelope(text) {
  if (typeof text !== 'string' || text.length > MAX_SAVE_BYTES) throw new Error('保存データが大きすぎます');
  const envelope = readSaveEnvelope(JSON.parse(text), { gameId: 'village', playerId: 'local' });
  // A syntactically valid envelope is not a valid recovery candidate until its world is valid.
  validate(envelope.payload);
  return envelope;
}

async function readBestBase(storage) {
  const texts = await Promise.all([storage.read(SAVE_KEY), storage.read(COMPACT_KEY)]);
  const candidates = [], failures = [];
  for (const text of texts) if (text !== null) {
    try { candidates.push(parseEnvelope(text)); } catch (cause) { failures.push(cause); }
  }
  if (candidates.length) return candidates.sort((a, b) => b.revision - a.revision)[0];
  if (failures.length) throw failures[0];
  return null;
}

async function backupSave(storage, now) {
  const keys = [SAVE_KEY, JOURNAL_KEY, COMPACT_KEY];
  const suffixes = ['base', 'journal', 'compact'];
  const originals = await Promise.all(keys.map(key => storage.read(key)));
  if (originals.some(text => text !== null)) {
    const prefix = `${SAVE_KEY}.recovery.${now}`;
    let target = prefix, serial = 0;
    // Retain both old single-file backups and all parts of earlier journal backups.
    while ((await Promise.all([target, ...suffixes.map(suffix => `${target}.${suffix}`)].map(key => storage.read(key)))).some(text => text !== null)) {
      target = `${prefix}.${++serial}`;
    }
    for (let index = 0; index < keys.length; index++) {
      if (originals[index] !== null) await storage.write(`${target}.${suffixes[index]}`, originals[index]);
    }
  }
  // No original is deleted until every present part has a successful backup.
  for (const key of keys) await storage.remove(key);
}

async function writeStorageWithRetry(storage, key, value) {
  let cause;
  for (let attempt = 1; attempt <= SAVE_ATTEMPTS; attempt++) {
    try { await storage.write(key, value); return; }
    catch (nextCause) {
      cause = nextCause;
      if (attempt < SAVE_ATTEMPTS) await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
    }
  }
  throw cause;
}

/** Device-local persistence through injected ports, never a shared-host authority. */
export function createSaveStore(platform) {
  let tail = Promise.resolve(), blocked = false, error = null;
  let revision = 0, baseRevision = 0, lastPayload = null, journal = null;
  let reloadBeforeSave = false;
  const writeWithRetry = (key, value) => writeStorageWithRetry(platform.storage, key, value);
  const envelopeText = (nextRevision, payload) => {
    const text = JSON.stringify(createSaveEnvelope({ gameId: 'village', playerId: 'local', revision: nextRevision, updatedAt: platform.clock.now(), payload }));
    if (text.length > MAX_SAVE_BYTES) throw new Error('保存データが大きすぎます');
    return text;
  };
  const reset = () => {
    revision = baseRevision = 0;
    lastPayload = journal = error = null;
    reloadBeforeSave = false;
    blocked = false;
  };
  async function load() {
    try {
      const base = await readBestBase(platform.storage);
      const journalText = await platform.storage.read(JOURNAL_KEY);
      if (!base) {
        if (journalText !== null) throw new Error('保存差分の基準snapshotがありません');
        reset();
        freshVillageLoad = true;
        return null;
      }
      freshVillageLoad = false;
      baseRevision = base.revision;
      journal = journalText ? JSON.parse(journalText) : emptyJournal(baseRevision);
      let loaded = { payload: base.payload, revision: baseRevision };
      if (journal.baseRevision === baseRevision) loaded = replayJournal(base.payload, journal, { baseRevision });
      else {
        const latest = journal.entries?.at(-1)?.revision ?? journal.baseRevision;
        if (!Number.isSafeInteger(latest) || latest > baseRevision) throw new Error('保存差分の基準revisionが一致しません');
        journal = emptyJournal(baseRevision);
      }
      revision = loaded.revision;
      lastPayload = validate(loaded.payload);
      reloadBeforeSave = false;
      blocked = false;
      error = null;
      return structuredClone(lastPayload);
    } catch (cause) {
      freshVillageLoad = false;
      blocked = true;
      error = cause;
      throw new Error('保存した村を読み込めませんでした。保存データは上書きしていません。', { cause });
    }
  }
  async function persist(payload) {
    // A failed compaction can leave a newer durable shadow or canonical base.
    // Continue from that revision before publishing another successful save.
    if (reloadBeforeSave) await load();
    if (lastPayload === null || baseRevision === 0) {
      const nextRevision = revision + 1;
      await writeWithRetry(SAVE_KEY, envelopeText(nextRevision, payload));
      await platform.storage.remove(JOURNAL_KEY).catch(() => {});
      await platform.storage.remove(COMPACT_KEY).catch(() => {});
      revision = baseRevision = nextRevision;
      journal = emptyJournal(baseRevision);
      lastPayload = payload;
      return;
    }
    const ops = createIncrementalPatch(lastPayload, payload);
    if (!ops.length) { lastPayload = payload; return; }
    const nextRevision = revision + 1;
    const nextJournal = appendJournalEntry(structuredClone(journal || emptyJournal(baseRevision)), { revision: nextRevision, updatedAt: platform.clock.now(), ops });
    if (shouldCompactJournal(nextJournal) || journalBytes(nextJournal) > 1_200_000) {
      const text = envelopeText(nextRevision, payload);
      reloadBeforeSave = true;
      await writeWithRetry(COMPACT_KEY, text);
      await writeWithRetry(SAVE_KEY, text);
      await writeWithRetry(JOURNAL_KEY, JSON.stringify(emptyJournal(nextRevision)));
      await platform.storage.remove(COMPACT_KEY).catch(() => {});
      baseRevision = nextRevision;
      journal = emptyJournal(baseRevision);
      reloadBeforeSave = false;
    } else {
      await writeWithRetry(JOURNAL_KEY, JSON.stringify(nextJournal));
      journal = nextJournal;
    }
    revision = nextRevision;
    lastPayload = payload;
  }
  return {
    load,
    save(world) {
      if (blocked) return Promise.reject(error || new Error('保存が保護されています'));
      // Capture now, not when an earlier asynchronous write eventually completes.
      const payload = JSON.parse(world.export());
      const operation = tail.catch(() => {}).then(() => persist(payload));
      tail = operation;
      operation.then(() => { error = null; }, cause => { error = cause; });
      return operation;
    },
    async recover() {
      await tail.catch(() => {});
      await backupSave(platform.storage, platform.clock.now());
      freshVillageLoad = false;
      reset();
    },
    flush: () => tail,
    diagnostics: () => Object.freeze({ revision, baseRevision, journalEntries: journal?.entries?.length || 0, journalBytes: journalBytes(journal) }),
    get error() { return error; },
    get blocked() { return blocked; },
  };
}
