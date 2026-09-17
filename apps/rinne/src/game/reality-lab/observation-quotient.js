// Classical finite-state research helper, not a quantum or consensus protocol.
// See docs/QUANTUM_PHILOSOPHY_LOOP.md for the observation-contract boundary.
const MAX_STATES = 256;
const MAX_ACTIONS = 32;
const own = (value, key) => Object.hasOwn(value, key);

function record(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be a plain record`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${name} must be a plain record`);
  }
  if (Reflect.ownKeys(value).some(key => typeof key !== 'string' ||
      !Object.getOwnPropertyDescriptor(value, key).enumerable ||
      !own(Object.getOwnPropertyDescriptor(value, key), 'value'))) {
    throw new TypeError(`${name} must contain enumerable data properties only`);
  }
  return value;
}

function fields(value, names, name) {
  record(value, name);
  if (Object.keys(value).length !== names.length || names.some(key => !own(value, key))) {
    throw new TypeError(`${name} requires exactly: ${names.join(', ')}`);
  }
}

function identifier(value, name) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_.:-]{1,120}$/.test(value)) {
    throw new TypeError(`${name} must be a nonempty identifier`);
  }
  return value;
}

// Compare complete JSON values, not collision-prone digests. Unknown is explicit null.
function jsonKey(value, ancestors = new Set(), depth = 0) {
  if (depth > 64) throw new RangeError('Observation JSON is too deep');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number' && Number.isFinite(value) && !Object.is(value, -0)) {
    return JSON.stringify(value);
  }
  if (!value || typeof value !== 'object') throw new TypeError('Expected finite JSON data');
  if (ancestors.has(value)) throw new TypeError('Cyclic JSON data');
  ancestors.add(value);
  let result;
  if (Array.isArray(value)) {
    if (Reflect.ownKeys(value).length !== value.length + 1) {
      throw new TypeError('Expected a dense JSON array without extra properties');
    }
    const parts = [];
    for (let i = 0; i < value.length; i++) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
      if (!descriptor || !own(descriptor, 'value') || !descriptor.enumerable) {
        throw new TypeError('Expected a dense JSON data array');
      }
      parts.push(jsonKey(descriptor.value, ancestors, depth + 1));
    }
    result = `[${parts.join(',')}]`;
  } else {
    record(value, 'JSON value');
    result = `{${Object.keys(value).sort().map(key =>
      `${JSON.stringify(key)}:${jsonKey(value[key], ancestors, depth + 1)}`).join(',')}}`;
  }
  ancestors.delete(value);
  return result;
}

function compileModel(model) {
  fields(model, ['actions', 'states'], 'Model');
  if (!Array.isArray(model.actions) || !model.actions.length || model.actions.length > MAX_ACTIONS) {
    throw new RangeError(`Declare 1-${MAX_ACTIONS} actions`);
  }
  if (!Array.isArray(model.states) || !model.states.length || model.states.length > MAX_STATES) {
    throw new RangeError(`Declare 1-${MAX_STATES} states`);
  }
  // Validate container arrays too: holes/accessors must not erase an action or state.
  jsonKey(model.actions);
  jsonKey(model.states);
  const actions = model.actions.map(action => identifier(action, 'Action'));
  if (new Set(actions).size !== actions.length) throw new TypeError('Duplicate action');
  const ids = model.states.map(state => {
    fields(state, ['id', 'observation', 'canon', 'transitions'], 'State');
    return identifier(state.id, 'State ID');
  });
  if (new Set(ids).size !== ids.length) throw new TypeError('Duplicate state ID');
  const index = new Map(ids.map((id, i) => [id, i]));
  const states = model.states.map(state => {
    fields(state.transitions, actions, 'Transitions');
    return {
      observation: jsonKey(state.observation),
      canon: jsonKey(state.canon),
      transitions: actions.map(action => {
        const edge = state.transitions[action];
        fields(edge, ['to', 'output'], 'Transition');
        if (!index.has(edge.to)) throw new TypeError('Unknown transition destination');
        return { to: index.get(edge.to), output: jsonKey(edge.output) };
      }),
    };
  });
  return { ids, actions, states };
}

function partition(signatures) {
  const groups = new Map();
  return signatures.map(signature => {
    if (!groups.has(signature)) groups.set(signature, groups.size);
    return groups.get(signature);
  });
}

/**
 * Coarsest observation/Canon-preserving stable partition of a declared total,
 * deterministic finite machine. Every action and transition output is relevant.
 * This does not verify that a game's observation/action contract is complete.
 *
 * @param {{actions: string[], states: object[]}} model Explicit finite graph.
 * @returns {object} Model-only equivalence classes; no runtime is modified.
 */
export function observationQuotient(model) {
  const { ids, actions, states } = compileModel(model);
  let labels = partition(states.map(state => JSON.stringify([state.observation, state.canon])));
  let refinements = 0;
  while (true) {
    const next = partition(states.map((state, i) => JSON.stringify([
      labels[i], state.transitions.map(edge => [edge.output, labels[edge.to]]),
    ])));
    if (next.every((label, i) => label === labels[i])) break;
    labels = next;
    refinements++;
    // Each nonstable round must split a class, so no horizon truncation is used.
    if (refinements >= states.length) throw new Error('Partition did not converge');
  }
  const classes = Array.from({ length: Math.max(...labels) + 1 }, () => []);
  ids.forEach((id, i) => classes[labels[i]].push(id));
  return {
    format: 'rrp-observation-quotient/1',
    evidenceClass: 'model',
    scope: 'declared finite deterministic total graph only',
    states: states.length,
    actions: actions.length,
    refinements,
    classes,
  };
}
