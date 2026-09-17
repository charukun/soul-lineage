import { canonical, copy, validId } from './encoding.mjs';

const fields = Object.freeze({
  credit: ['amount'], spend: ['amount'], grow: ['item'],
  life: ['parent', 'lifeId'], switch: ['policy', 'authority'], nop: [],
});
export const initialApplication = () => ({
  balance: 2, items: [], lives: ['origin'], lifeParents: [],
  generation: 1, policy: 'peer', authority: 'n0', receipts: [],
});

export function validCommand(command) {
  if (!command || !Object.hasOwn(fields, command.type) || !validId(command.id) ||
      !Number.isSafeInteger(command.generation) || command.generation < 1) return false;
  const expected = ['type', 'id', 'generation', ...fields[command.type]].sort();
  if (canonical(Object.keys(command).sort()) !== canonical(expected)) return false;
  if (['spend', 'credit'].includes(command.type)) return Number.isSafeInteger(command.amount) && command.amount > 0;
  if (command.type === 'life') return validId(command.parent) && validId(command.lifeId);
  if (command.type === 'switch') return ['peer', 'relay', 'external'].includes(command.policy) && validId(command.authority);
  if (command.type === 'grow') return validId(command.item);
  return true;
}

// Pure deterministic interpreter. Canon records rejected operations too. Neither a
// signature nor ordering alone proves an application invariant; this gate is separate.
export function applyCommand(application, command, slot, mutation = 'none') {
  const state = copy(application);
  if (!validCommand(command)) return { state, result: { status: 'unsupported', slot } };
  const request = canonical(command);
  const prior = state.receipts.find(([id]) => id === command.id)?.[1];
  if (prior && mutation !== 'dedupe') {
    return { state, result: prior.request === request ? copy(prior.result) : { status: 'id-conflict', slot } };
  }
  let status = 'ok';
  if (mutation !== 'generation' && command.generation !== state.generation) status = 'stale-generation';
  else if (command.type === 'spend') {
    if (state.balance < command.amount) status = 'insufficient';
    else state.balance -= command.amount;
  } else if (command.type === 'credit') {
    if (!Number.isSafeInteger(state.balance + command.amount)) status = 'overflow';
    else state.balance += command.amount;
  } else if (command.type === 'grow') state.items = [...new Set([...state.items, command.item])].sort();
  else if (command.type === 'life') {
    if (mutation !== 'parent' && command.parent !== state.lives.at(-1)) status = 'stale-parent';
    else if (state.lives.includes(command.lifeId)) status = 'duplicate-resource';
    else { state.lives.push(command.lifeId); state.lifeParents.push([command.lifeId, command.parent]); }
  } else if (command.type === 'switch') {
    if (!Number.isSafeInteger(state.generation + 1)) status = 'overflow';
    else { state.generation++; state.policy = command.policy; state.authority = command.authority; }
  }
  const result = { status, slot };
  const entry = [command.id, { request, result: copy(result) }];
  if (prior) state.receipts[state.receipts.findIndex(([id]) => id === command.id)] = entry;
  else state.receipts.push(entry);
  return { state, result };
}
