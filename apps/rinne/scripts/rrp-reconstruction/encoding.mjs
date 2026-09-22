import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';

// Research fixtures, NOT production credentials. Determinism makes traces replayable.
export function canonical(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  throw new TypeError('Only finite safe-integer JSON values are supported');
}
export const keyOf = value => createHash('sha256').update(canonical(value)).digest('hex');
export const copy = value => structuredClone(value);
export const validId = value => typeof value === 'string' && /^[a-zA-Z0-9][\w:./-]{0,119}$/.test(value);
export const equal = (a, b) => canonical(a) === canonical(b);
export const compareBallot = (a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0);
export const validBallot = ballot => Array.isArray(ballot) && ballot.length === 2 &&
  Number.isSafeInteger(ballot[0]) && ballot[0] > 0 && validId(ballot[1]);
export const GENESIS = keyOf({ genesis: 'rrp-independent-reference-v1' });

export function fixturePorts(members) {
  if (!Array.isArray(members) || members.length < 3 || members.length % 2 !== 1 ||
      members.some(id => !validId(id)) || new Set(members).size !== members.length) {
    throw new TypeError('An odd, unique fixed crash-voter configuration is required');
  }
  const identities = new Map(members.map(id => {
    const seed = createHash('sha256').update(`PUBLIC-TEST-KEY-DO-NOT-DEPLOY:${id}`).digest();
    const privateKey = createPrivateKey({ key: Buffer.concat([
      Buffer.from('302e020100300506032b657004220420', 'hex'), seed,
    ]), format: 'der', type: 'pkcs8' });
    return [id, { privateKey, publicKey: createPublicKey(privateKey) }];
  }));
  const configuration = keyOf({ members, version: 1 });
  const publicKeys = new Map([...identities].map(([id, keys]) => [id, keys.publicKey]));
  return new Map(members.map(id => {
    // This closure gets ONE private key; verification sees only public configuration.
    const privateKey = identities.get(id).privateKey;
    return [id, Object.freeze({
      configuration,
      sign(body) {
        if (body.from !== id) throw new Error('A replica cannot sign for another identity');
        return { body: copy(body), signature: sign(null, Buffer.from(canonical(body)), privateKey).toString('hex') };
      },
      verify(message) {
        try {
          const body = message?.body;
          if (!body || body.configuration !== configuration || !publicKeys.has(body.from) ||
              !publicKeys.has(body.to) || typeof message.signature !== 'string') return false;
          return verify(null, Buffer.from(canonical(body)), publicKeys.get(body.from), Buffer.from(message.signature, 'hex'));
        } catch { return false; }
      },
    })];
  }));
}
