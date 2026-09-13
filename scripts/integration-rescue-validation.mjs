import assert from 'node:assert/strict';
import { accessSync, constants, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';

// Read-only preflight executed as the same unprivileged UID as npm/fast.
// Print only filesystem/runtime facts, never the environment or credentials.
const expected = realpathSync(process.argv[2]);
assert.equal(realpathSync(process.cwd()), expected, 'VALIDATION_CWD_MISMATCH');
accessSync(expected, constants.R_OK | constants.W_OK | constants.X_OK);
accessSync(resolve(expected, 'package.json'), constants.R_OK);
const lock = JSON.parse(readFileSync(resolve(expected, 'package-lock.json'), 'utf8'));
assert.ok(lock.lockfileVersion >= 1, 'VALIDATION_LOCKFILE_UNREADABLE');
console.log(JSON.stringify({ validationCwd: expected, uid: process.getuid?.(), node: process.version, lockfileVersion: lock.lockfileVersion }));
