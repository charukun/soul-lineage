import { platformContractVersion } from '@soul/platform';
export { createVillageAuthority, advanceVillageAuthority, VILLAGE_PHASE } from './village-authority.js';
export { createVillageCheckpoint, validateVillageCheckpoint } from './village-checkpoint.js';
// HTTP transport is injected. No browser, console SDK, region or account is hardcoded.
export function createApiClient(platform, endpoint) {
  if (platform.contractVersion !== platformContractVersion) throw new Error('Incompatible platform');
  if (!/^https:\/\//.test(endpoint)) throw new Error('HTTPS endpoint required');
  const base = new URL(endpoint.endsWith('/') ? endpoint : endpoint + '/');
  return { async request(path, { method = 'GET', body, headers = {} } = {}) {
    const url = new URL(path, base);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) throw new Error('Request escaped service endpoint');
    return platform.network.request({ url: url.href, method, headers, body });
  } };
}
