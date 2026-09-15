// Real-player villages are intentionally absent from the normal hunt flow.
// Friend invitations use the Village app's dedicated, non-hostile visitor entry.
// Preserve the latest boot adapter lifecycle without creating UI, storage or peers.
export function installOnlineRaid() {
 return Object.freeze({
  enabled: false,
  reason: 'friend-invite-only',
  open() {},
  close() {},
  dispose() {},
 });
}
