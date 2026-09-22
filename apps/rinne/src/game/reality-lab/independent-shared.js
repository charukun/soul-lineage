export const RECONSTRUCTION_EVIDENCE = Object.freeze({
  THEOREM: 'A',
  BOUNDED_MODEL: 'B',
  ASSUMPTION: 'C',
  HEURISTIC: 'D',
  EMPIRICAL: 'E',
  UNKNOWN: 'F',
});

export const clone = value => structuredClone(value);
export const distinct = values => [...new Set(values)];

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  }
  return value;
}

export function canonical(value) {
  return JSON.stringify(stable(value));
}
