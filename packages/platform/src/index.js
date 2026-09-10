export const platformContractVersion = 1;
const identifier = /^[a-zA-Z0-9._-]+$/;
export function storageScope({ environment, gameId, playerId = 'guest' }) {
  if (![environment, gameId, playerId].every(v => typeof v === 'string' && identifier.test(v))) throw new Error('Invalid storage scope');
  return `soul:v1:${environment}:${gameId}:${playerId}:`;
}
export function definePlatform(adapter) {
  const ports = { clock: ['now', 'monotonic'], storage: ['read', 'write', 'remove'], network: ['request'], identity: ['current'], lifecycle: ['subscribe'], input: ['subscribe'] };
  for (const [port, methods] of Object.entries(ports)) {
    if (!adapter[port] || methods.some(method => typeof adapter[port][method] !== 'function')) throw new Error(`Missing platform port: ${port}`);
  }
  if (!adapter.locale?.language || !adapter.locale?.timeZone) throw new Error('Missing locale');
  if (adapter.contractVersion !== platformContractVersion || !adapter.id || !adapter.capabilities) throw new Error('Incompatible platform adapter');
  return Object.freeze(adapter);
}
