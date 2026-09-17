import { canonical, GENESIS, keyOf } from './encoding.mjs';

// Specification oracle deliberately imports NEITHER replica nor its interpreter.
// It consumes historical observations, never supplies information to a replica.
function emptyView() {
  return { count: 0, root: GENESIS, balance: 2, items: new Set(), lives: ['origin'], parents: [],
    generation: 1, policy: 'peer', authority: 'n0', operations: new Map() };
}
function expectedApply(view, command, slot) {
  const request = canonical(command);
  const saved = view.operations.get(command.id);
  if (saved) return saved.request === request ? saved.result : { status: 'id-conflict', slot };
  let status = 'ok';
  if (command.generation !== view.generation) status = 'stale-generation';
  else {
    switch (command.type) {
      case 'credit':
        if (Number.isSafeInteger(view.balance + command.amount)) view.balance += command.amount;
        else status = 'overflow';
        break;
      case 'spend':
        if (command.amount > view.balance) status = 'insufficient';
        else view.balance -= command.amount;
        break;
      case 'grow': view.items.add(command.item); break;
      case 'life':
        if (command.parent !== view.lives[view.lives.length - 1]) status = 'stale-parent';
        else if (view.lives.indexOf(command.lifeId) !== -1) status = 'duplicate-resource';
        else { view.lives.push(command.lifeId); view.parents.push([command.lifeId, command.parent]); }
        break;
      case 'switch':
        if (view.generation === Number.MAX_SAFE_INTEGER) status = 'overflow';
        else { view.generation += 1; view.policy = command.policy; view.authority = command.authority; }
        break;
      case 'nop': break;
      default: status = 'unsupported';
    }
  }
  const result = { status, slot };
  view.operations.set(command.id, { request, result });
  return result;
}
function application(view) {
  return { balance: view.balance, items: [...view.items].sort(), lives: view.lives,
    lifeParents: view.parents, generation: view.generation, policy: view.policy,
    authority: view.authority, receipts: [...view.operations] };
}
export function audit(observations, members = ['n0', 'n1', 'n2']) {
  const majority = Math.floor(members.length / 2) + 1;
  const accepts = new Map(), chosen = new Map(), certified = new Set();
  const views = new Map(members.map(id => [id, emptyView()])), quarantine = new Set();
  const errors = [];
  for (let index = 0; index < observations.length; index++) {
    const row = observations[index];
    const fail = message => errors.push(`${index}:${message}`);
    if (row.type === 'storage-loss') { views.set(row.node, emptyView()); quarantine.add(row.node); }
    else if (row.type === 'accept') {
      if (quarantine.has(row.node)) fail('forgotten promise identity voted after storage loss');
      const value = keyOf(row.value), group = canonical([row.value.slot, row.ballot, value]);
      if (!accepts.has(group)) accepts.set(group, new Set());
      accepts.get(group).add(row.node);
      if (accepts.get(group).size >= majority) {
        const previous = chosen.get(row.value.slot);
        if (previous && previous !== value) fail(`two chosen values at slot ${row.value.slot}`);
        chosen.set(row.value.slot, value);
        certified.add(canonical([row.value.slot, value]));
      }
    } else if (row.type === 'apply') {
      const view = views.get(row.node);
      if (!certified.has(canonical([row.value.slot, keyOf(row.value)]))) fail('application without historical durable quorum');
      if (row.value.slot !== view.count + 1 || row.value.prev !== view.root) fail('noncontiguous Canon ancestry');
      const expected = expectedApply(view, row.value.command, row.value.slot);
      if (canonical(expected) !== canonical(row.result)) fail(`incorrect receipt for ${row.value.command.id}`);
      view.count++; view.root = keyOf(row.value);
      if (canonical(application(view)) !== canonical(row.application)) fail(`application invariant/dedupe/generation mismatch for ${row.value.command.id}`);
      if (view.balance < 0) fail('negative stock');
    } else if (row.type === 'snapshot-complete') {
      const view = views.get(row.node);
      if (view.count !== row.manifest.count || view.root !== row.manifest.root ||
          keyOf(application(view)) !== row.manifest.application || row.count !== view.count || row.root !== view.root) {
        fail('incomplete recovery advertised as a complete snapshot');
      }
    } else if (['conflicting-learn', 'broken-prefix'].includes(row.type)) fail(row.type);
  }
  return { pass: errors.length === 0, errors, chosenSlots: chosen.size, observations: observations.length };
}
