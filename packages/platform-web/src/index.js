import { definePlatform, platformContractVersion, storageScope } from '@soul/platform';
export function createWebPlatform(scope) {
  const prefix = storageScope(scope);
  return definePlatform({
    id: 'web', contractVersion: platformContractVersion,
    capabilities: Object.freeze({ cloudSave: false, crossPlay: false, commerce: false }),
    clock: { now: () => Date.now(), monotonic: () => performance.now() },
    storage: {
      read: async key => localStorage.getItem(prefix + key),
      write: async (key, value) => { localStorage.setItem(prefix + key, value); },
      remove: async key => { localStorage.removeItem(prefix + key); },
    },
    network: { async request({ url, method = 'GET', headers, body }) {
      const response = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(15000) });
      return { status: response.status, body: await response.text() };
    } },
    // Account linking and server identity are deliberately not simulated locally.
    identity: { current: async () => null },
    lifecycle: { subscribe(listener) {
      const onChange = () => listener(document.hidden ? 'suspended' : 'active');
      document.addEventListener('visibilitychange', onChange);
      return () => document.removeEventListener('visibilitychange', onChange);
    } },
    input: { subscribe(listener) {
      const bindings = { Enter: 'confirm', Escape: 'cancel', ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
      const handler = event => { if (bindings[event.code] && !event.repeat) listener({ action: bindings[event.code], pressed: event.type === 'keydown' }); };
      window.addEventListener('keydown', handler); window.addEventListener('keyup', handler);
      return () => { window.removeEventListener('keydown', handler); window.removeEventListener('keyup', handler); };
    } },
    locale: { language: navigator.language || 'ja', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' },
  });
}
