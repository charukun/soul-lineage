import assert from 'node:assert/strict';

const key = entry => `${entry.environment}:${entry.app}`;

// Keep explicitly pinned staging/initial releases across ordinary main deployments.
export function retainPinnedEntries(desired, previous) {
  const keys = new Set(desired.map(key));
  return [...desired, ...previous.filter(entry => entry.pinned && !keys.has(key(entry)))];
}

export function missingEnvironmentEntries(candidates, previous, approvedApps) {
  const existing = new Set(previous.map(key));
  const allowed = new Set(approvedApps);
  const selected = candidates.filter(entry => ['staging', 'prod'].includes(entry.environment)
    && allowed.has(entry.app) && !entry.legacy && !existing.has(key(entry)));
  const planned = new Set();
  for (const entry of selected) {
    assert.equal(entry.path, `${entry.environment}/${entry.app}`, 'Initial release must use its own app/environment path');
    assert.ok(!planned.has(key(entry)), 'Duplicate initial environment');
    planned.add(key(entry));
    // The legacy prod/ tree can coexist, but none of its published bytes may collide.
    assert.ok(!previous.some(old => (old.files || []).some(file =>
      `${old.path}/${file.path}`.startsWith(`${entry.path}/`))), `Initial release would overwrite published files: ${entry.path}`);
  }
  return selected.map(entry => ({ ...entry, branch: 'develop', pinned: true }));
}
