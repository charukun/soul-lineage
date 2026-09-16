import { access, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { NON_DISTRIBUTABLE_CHARACTER_FILES } from '../packages/characters/src/license-policy.js';

const PUBLIC_PREFIX = 'apps/rinne/public/';

export function retiredCharacterDistributionPaths() {
  return Object.freeze(NON_DISTRIBUTABLE_CHARACTER_FILES
    .filter(file => file.startsWith(PUBLIC_PREFIX))
    .map(file => file.slice(PUBLIC_PREFIX.length)));
}

export async function stripRetiredCharacterAssets(distRoot) {
  const removed = [];
  for (const relative of retiredCharacterDistributionPaths()) {
    const target = path.join(distRoot, relative);
    try {
      await access(target);
      await rm(target, { force: true });
      removed.push(relative);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  return Object.freeze(removed);
}

export async function assertNoRetiredCharacterAssets(distRoot) {
  const present = [];
  for (const relative of retiredCharacterDistributionPaths()) {
    try { await access(path.join(distRoot, relative)); present.push(relative); }
    catch (error) { if (error?.code !== 'ENOENT') throw error; }
  }
  if (present.length) throw new Error(`Retired character assets remain in distribution: ${present.join(', ')}`);
  return true;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const distRoot = path.resolve(process.argv[2] || 'dist/rinne');
  stripRetiredCharacterAssets(distRoot)
    .then(async removed => {
      await assertNoRetiredCharacterAssets(distRoot);
      console.log(`Retired character assets excluded: ${removed.length}`);
    })
    .catch(error => {
      console.error(`Retired character asset exclusion failed: ${error.message}`);
      process.exitCode = 1;
    });
}
