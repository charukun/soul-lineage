#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  createCharacterDistributionManifest,
  createCharacterModelBuildRequest,
  createCharacterModelCandidate,
  reviewCharacterModelCandidate,
  validateCharacterModelBuildRequest,
  validateCharacterModelCandidate
} from '../packages/characters/src/model-builder.js';

function readJson(path) {
  return JSON.parse(readFileSync(resolve(path), 'utf8'));
}

function writeJson(path, value) {
  const target = resolve(path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  console.log(target);
}

function usage() {
  console.error(`Usage:
  node scripts/character-model-builder.mjs request <referenceId> <out.json> [provider]
  node scripts/character-model-builder.mjs candidate <request.json> <format> <artifactPath> <sha256> <provider> <out.json>
  node scripts/character-model-builder.mjs review <candidate.json> <gate-results.json> <out.json>
  node scripts/character-model-builder.mjs distribute <accepted-candidate.json> <out.json> [appId ...]

The CLI prepares and validates handoff metadata. 3D geometry is produced by an external provider adapter and remains a candidate until all required gates pass.`);
  process.exitCode = 2;
}

const [command, ...args] = process.argv.slice(2);

try {
  if (command === 'request') {
    const [referenceId, out, provider = 'unassigned'] = args;
    if (!referenceId || !out) return usage();
    writeJson(out, createCharacterModelBuildRequest(referenceId, { provider, requestedBy: 'character-model-builder-cli' }));
  } else if (command === 'candidate') {
    const [requestPath, format, artifactPath, sha256, provider, out] = args;
    if (![requestPath, format, artifactPath, sha256, provider, out].every(Boolean)) return usage();
    const request = readJson(requestPath); validateCharacterModelBuildRequest(request);
    writeJson(out, createCharacterModelCandidate(request, { format, path: artifactPath, sha256, provider }));
  } else if (command === 'review') {
    const [candidatePath, resultsPath, out] = args;
    if (![candidatePath, resultsPath, out].every(Boolean)) return usage();
    const candidate = readJson(candidatePath); validateCharacterModelCandidate(candidate);
    writeJson(out, reviewCharacterModelCandidate(candidate, readJson(resultsPath)));
  } else if (command === 'distribute') {
    const [candidatePath, out, ...targets] = args;
    if (!candidatePath || !out) return usage();
    const candidate = readJson(candidatePath); validateCharacterModelCandidate(candidate);
    writeJson(out, createCharacterDistributionManifest(candidate, targets.length ? targets : undefined));
  } else {
    usage();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
