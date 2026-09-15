export const BROWSER_PLAYTEST_APPS = Object.freeze(['rinne', 'village', 'demon']);

const markerPattern = /^\s*Browser-Playtest:\s*(.*?)\s*$/gim;

function canonicalApps(values) {
  const requested = new Set(values);
  return BROWSER_PLAYTEST_APPS.filter(app => requested.has(app));
}

export function parseBrowserPlaytestValue(value) {
  const raw = String(value ?? '').trim();
  if (!raw) throw new Error('Browser-Playtest value must not be empty');

  const normalized = raw.toLowerCase();
  if (normalized === 'all') {
    return { declared: true, mode: 'all', raw, apps: [...BROWSER_PLAYTEST_APPS] };
  }
  if (normalized === 'affected') {
    return { declared: true, mode: 'affected', raw, apps: [] };
  }

  const tokens = normalized.split(',').map(token => token.trim());
  if (tokens.some(token => !token)) {
    throw new Error(`Browser-Playtest contains an empty app token: ${raw}`);
  }
  if (new Set(tokens).size !== tokens.length) {
    throw new Error(`Browser-Playtest contains duplicate app tokens: ${raw}`);
  }

  const unknown = tokens.filter(token => !BROWSER_PLAYTEST_APPS.includes(token));
  if (unknown.length) {
    throw new Error(`Browser-Playtest contains unknown apps: ${unknown.join(', ')}`);
  }

  return { declared: true, mode: 'apps', raw, apps: canonicalApps(tokens) };
}

export function parseBrowserPlaytest(body = '') {
  const matches = [...String(body ?? '').matchAll(markerPattern)];
  if (!matches.length) {
    return { declared: false, mode: 'affected', raw: null, apps: [] };
  }
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one Browser-Playtest line, found ${matches.length}`);
  }
  return parseBrowserPlaytestValue(matches[0][1]);
}

export function resolveBrowserPlaytestTargets(affectedApps = [], request = parseBrowserPlaytest()) {
  const affected = [...new Set(affectedApps)];
  const unknownAffected = affected.filter(app => !BROWSER_PLAYTEST_APPS.includes(app));
  if (unknownAffected.length) {
    throw new Error(`Unknown affected browser apps: ${unknownAffected.join(', ')}`);
  }
  return canonicalApps([...affected, ...request.apps]);
}
