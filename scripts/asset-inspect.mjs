import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { STYLIZED_ART_PROFILES } from '../packages/characters/src/art-direction.js';
import { inspectAssetBuffer } from './lib/asset-inspection.mjs';

export function roleBudget(role = null) {
  if (!role) return null;
  const profile = STYLIZED_ART_PROFILES[role];
  if (!profile) throw new Error(`Unknown asset role: ${role}. Expected ${Object.keys(STYLIZED_ART_PROFILES).join(', ')}`);
  return Object.freeze({
    role: profile.id,
    styleId: profile.styleId,
    softTriangleBudget: profile.performance.softTriangleBudget,
    softMaterialBudget: profile.performance.softMaterialBudget,
    softDrawCallBudget: profile.performance.softDrawCallBudget,
  });
}

export function inspectAssetFile(input, { role = null } = {}) {
  const file = resolve(input);
  if (!existsSync(file)) throw new Error(`Missing input: ${file}`);
  const stat = statSync(file);
  if (!stat.isFile()) throw new Error(`Input is not a file: ${file}`);
  return inspectAssetBuffer(readFileSync(file), { file, bytes: stat.size, roleBudget: roleBudget(role) });
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2), next = argv[index + 1];
    if (!next || next.startsWith('--')) values[key] = true;
    else { values[key] = next; index++; }
  }
  return values;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) throw new Error('Use --input <.glb/.gltf/.vrm> [--role hero|npc|enemy|environment|prop|distant] [--output report.json]');
  const result = inspectAssetFile(args.input, { role: args.role || null });
  const json = `${JSON.stringify(result, null, 2)}\n`;
  if (args.output) writeFileSync(resolve(args.output), json);
  process.stdout.write(json);
}
