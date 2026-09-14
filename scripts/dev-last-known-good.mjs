import assert from 'node:assert/strict';
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const PREFIX = 'dev-lkg-site-';
const SHA = /^[0-9a-f]{40}$/;

export function chooseLastKnownGood(artifacts = [], currentSha = '') {
  return artifacts
    .filter(artifact => !artifact.expired && String(artifact.name || '').startsWith(PREFIX))
    .map(artifact => ({ ...artifact, sourceSha: String(artifact.name).slice(PREFIX.length) }))
    .filter(artifact => SHA.test(artifact.sourceSha) && artifact.sourceSha !== currentSha)
    .sort((a, b) => Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0))[0] || null;
}

export function verifyLastKnownGood(root, expectedSha) {
  assert.match(expectedSha || '', SHA);
  const manifest = JSON.parse(readFileSync(resolve(root, 'deployment-manifest.json'), 'utf8'));
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.validatedDevelop, expectedSha, 'LKG artifact manifest must match artifact source SHA');
  assert.equal(manifest.environmentSnapshots?.dev?.commit, expectedSha, 'LKG DEV snapshot must match artifact source SHA');
  return { sourceSha: expectedSha, entries: manifest.entries?.length || 0 };
}

async function locate() {
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const currentSha = process.env.CURRENT_SHA || '';
  assert.equal(repository, 'charukun/soul-lineage');
  assert.ok(token);
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  const artifacts = [];
  for (let page = 1; page <= 3; page++) {
    const response = await fetch(`https://api.github.com/repos/${repository}/actions/artifacts?per_page=100&page=${page}`, { headers, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`LKG_ARTIFACT_LIST_HTTP_${response.status}`);
    const payload = await response.json();
    artifacts.push(...(payload.artifacts || []));
    if ((payload.artifacts || []).length < 100) break;
  }
  const selected = chooseLastKnownGood(artifacts, currentSha);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `found=${Boolean(selected)}\nartifact_id=${selected?.id || ''}\nsource_sha=${selected?.sourceSha || ''}\nname=${selected?.name || ''}\n`);
  console.log(JSON.stringify(selected ? { found:true, artifactId:selected.id, sourceSha:selected.sourceSha, name:selected.name } : { found:false }));
}

async function main() {
  const mode = process.argv[2];
  if (mode === 'locate') return locate();
  if (mode === 'verify') {
    const root = process.argv[3];
    const sha = process.argv[4];
    console.log(JSON.stringify(verifyLastKnownGood(root, sha)));
    return;
  }
  throw new Error('usage: dev-last-known-good.mjs <locate|verify> [root sha]');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
