import { copy, equal } from './finite.mjs';

// One trusted semantic owner, two physical representations, not a consensus protocol.
// All completed local transactions survive crash. No node can read another node's
// disk. The scheduler supplies callbacks, never an alive set or global history.
export function initialOwner() {
  return { running: true, disk: { boot: 1, active: 1, revision: 0, v1: { a: 1, b: 2 }, v2: null,
    operations: {}, log: [], migration: null }, volatile: { serial: 0, writes: [] } };
}
function normalized(raw) {
  if (!raw || !equal(Object.keys(raw).sort(), ['amount', 'id', 'key', 'version']) ||
      (typeof raw.id !== 'string' || !/^[a-z][a-z0-9-]{0,40}$/.test(raw.id)) || !['a', 'b'].includes(raw.key) ||
      ![1, 2].includes(raw.version) || !Number.isSafeInteger(raw.amount) || raw.amount <= 0) return null;
  const amount = raw.version === 1 ? raw.amount : raw.amount / 1000;
  if (!Number.isSafeInteger(amount) || amount > 10) return null;
  return { key: raw.key, amount };
}
function enqueue(local, job) {
  const token = `${local.disk.boot}:${++local.volatile.serial}`;
  local.volatile.writes.push({ token, ...copy(job) });
}
function request(local, event) {
  const d = local.disk, m = d.migration;
  if (event.kind === 'command') {
    if (normalized(event.raw)) enqueue(local, { kind: 'command', raw: event.raw });
  } else if (event.kind === 'copy') {
    if (m && ['a', 'b'].includes(event.key)) enqueue(local, { kind: 'copy', job: m.id,
      key: event.key, value: m.snapshot[event.key] * 1000 });
  } else if (event.kind === 'replay') {
    const record = m && d.log[m.cursor];
    if (record) enqueue(local, { kind: 'replay', job: m.id, record });
  } else if (['begin', 'seal', 'activate'].includes(event.kind)) enqueue(local, { kind: event.kind });
}
function command(d, raw, effects, mutation) {
  const intent = normalized(raw);
  if (!intent) return;
  const prior = Object.hasOwn(d.operations, raw.id) ? d.operations[raw.id] : null;
  if (prior) {
    if (equal(prior.intent, intent)) effects.push({ type: 'receipt', raw, receipt: copy(prior.receipt) });
    return;
  }
  if (mutation !== 'old-writer' && (raw.version !== d.active || (d.active === 1 && d.migration && d.migration.cut !== null))) return;
  const target = raw.version === 1 ? d.v1 : d.v2;
  if (!target) return;
  const multiplier = raw.version === 1 || mutation === 'units' ? 1 : 1000;
  if (!Number.isSafeInteger(target[raw.key] + intent.amount * multiplier)) return;
  target[raw.key] += intent.amount * multiplier;
  d.revision++;
  const receipt = { id: raw.id, revision: d.revision, amount: intent.amount, key: intent.key };
  d.operations[raw.id] = { intent, receipt };
  d.log.push({ revision: d.revision, raw: copy(raw), intent: copy(intent) });
  effects.push({ type: 'receipt', raw: copy(raw), receipt: copy(receipt) });
}
function flush(local, token, effects, mutation) {
  const index = local.volatile.writes.findIndex(job => job.token === token);
  if (index < 0) return;
  const [job] = local.volatile.writes.splice(index, 1);
  const d = local.disk, m = d.migration;
  switch (job.kind) {
    case 'command': command(d, job.raw, effects, mutation); break;
    case 'begin':
      if (!m && d.active === 1) d.migration = { id: 'migration-1', base: d.revision,
        snapshot: copy(d.v1), shadow: {}, cursor: d.revision, cut: null, blocked: null };
      break;
    case 'copy':
      if (d.active === 1 && m?.id === job.job && (mutation === 'late-copy' || !Object.hasOwn(m.shadow, job.key))) {
        if (mutation !== 'unchecked-range' && !Number.isSafeInteger(job.value)) { m.blocked = 'target-number-range'; break; }
        m.shadow[job.key] = job.value;
      }
      break;
    case 'replay':
      if (d.active !== 1 || m?.id !== job.job || !['a', 'b'].every(key => Object.hasOwn(m.shadow, key))) break;
      if (mutation !== 'duplicate-delta' && job.record.revision !== m.cursor + 1) break;
      if (m.cut !== null && job.record.revision > m.cut) break;
      const updated = m.shadow[job.record.intent.key] + job.record.intent.amount * 1000;
      if (mutation !== 'unchecked-range' && !Number.isSafeInteger(updated)) { m.blocked = 'target-number-range'; break; }
      m.shadow[job.record.intent.key] = updated;
      m.cursor = Math.max(m.cursor, job.record.revision);
      break;
    case 'seal':
      if (d.active === 1 && m && !m.blocked && m.cut === null) m.cut = d.revision;
      break;
    case 'activate':
      if (d.active !== 1 || !m || m.blocked || m.cut === null || d.revision !== m.cut) break;
      if (mutation !== 'missing-row' && !['a', 'b'].every(key => Object.hasOwn(m.shadow, key))) break;
      if (mutation !== 'skip-catchup' && m.cursor !== m.cut) break;
      d.v2 = copy(m.shadow); d.active = 2;
      if (mutation === 'forget-receipts') d.operations = {};
      effects.push({ type: 'activated', cut: m.cut });
      break;
  }
}

export function transition(before, event, mutation = 'none') {
  const local = copy(before), effects = [];
  if (event.type === 'crash') { local.running = false; local.volatile.writes = []; }
  else if (event.type === 'restart') {
    local.running = true; local.disk.boot++;
    local.volatile = { serial: 0, writes: [] };
  } else if (local.running) {
    if (event.type === 'request') request(local, event);
    else if (event.type === 'flush') flush(local, event.token, effects, mutation);
  }
  return { local, effects };
}
export const rawCommand = (id, key = 'a', version = 1, coins = 1) =>
  ({ id, key, version, amount: version === 1 ? coins : coins * 1000 });
