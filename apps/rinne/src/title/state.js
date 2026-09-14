/** Portable title-flow rules. DOM, storage, browser history and clocks live in the UI adapter. */
export const STATES = Object.freeze(['intro', 'title', 'loading', 'playing', 'error']);
const transitions = Object.freeze({
  intro: { reveal: 'title', enter: 'loading', replay: 'intro' },
  title: { enter: 'loading', replay: 'intro' },
  loading: { ready: 'playing', fail: 'error', back: 'title' },
  playing: { back: 'title', fail: 'error' },
  error: { retry: 'loading', back: 'title' },
});
export function transition(state, event) {
  if (!STATES.includes(state)) throw new TypeError(`Unknown title state: ${state}`);
  return transitions[state]?.[event] ?? state;
}
export function normalizeEnvironment(value) {
  return ({ development: 'dev', production: 'prod', dev: 'dev', prod: 'prod', local: 'local', test: 'test' })[value] ?? 'local';
}
export function normalizedSettings(value, systemReducedMotion = false) {
  const hasSound = value && Object.hasOwn(value, 'sound');
  return {
    sound: hasSound ? value.sound === true : true,
    reducedMotion: typeof value?.reducedMotion === 'boolean' ? value.reducedMotion : Boolean(systemReducedMotion),
  };
}
export function acceptsReadyMessage(data, token) {
  return typeof token === 'string' && token.length >= 8 && !!data && data.channel === 'rinne-title-v1' && data.token === token && ['ready', 'error', 'progress', 'asset-request'].includes(data.type);
}

export function acceptsFrameOrigin(eventOrigin, hostOrigin, hostProtocol, offline) {
  if (/^https?:$/.test(hostProtocol)) return eventOrigin === hostOrigin;
  return Boolean(offline) && (eventOrigin === 'null' || eventOrigin === hostOrigin);
}
