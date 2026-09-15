import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  EXTERNAL_CHARACTER_REFERENCE_REGISTRY,
  buildCharacterCoverageMatrix,
  defaultCharacterCoverageTargets,
  externalReferenceConsensusSet
} from '../packages/characters/src/reference-intelligence.js';

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

export function loadCharacterProductionCandidates(root = process.cwd()) {
  const dir = resolve(root, 'packages/characters/production');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(name => name.endsWith('.production.json'))
    .sort()
    .map(name => JSON.parse(readFileSync(resolve(dir, name), 'utf8')))
    .map(manifest => manifest.presentation ? { manifest, presentation: manifest.presentation } : manifest);
}

export function buildCharacterReferenceReport({ root = process.cwd(), apps, renderTiers } = {}) {
  const targets = defaultCharacterCoverageTargets({
    ...(apps ? { apps } : {}),
    ...(renderTiers ? { renderTiers } : {})
  });
  const productionAssets = loadCharacterProductionCandidates(root);
  const matrix = buildCharacterCoverageMatrix(targets, { productionAssets });
  const externalReferenceIds = Object.keys(EXTERNAL_CHARACTER_REFERENCE_REGISTRY).sort();
  const consensus = externalReferenceConsensusSet(externalReferenceIds);
  return {
    schema: 'character-reference-report',
    version: 1,
    externalReferences: externalReferenceIds.map(id => EXTERNAL_CHARACTER_REFERENCE_REGISTRY[id]),
    consensus,
    productionManifestCount: productionAssets.length,
    coverage: matrix
  };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const root = resolve(args.root || process.cwd());
  const output = resolve(args.output || 'test-results/character-reference-report.json');
  const apps = args.apps ? String(args.apps).split(',').filter(Boolean) : undefined;
  const renderTiers = args.tiers ? String(args.tiers).split(',').filter(Boolean) : undefined;
  const report = buildCharacterReferenceReport({ root, apps, renderTiers });
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  const summary = report.coverage.summary;
  console.log(`[character-references] references=${report.externalReferences.length} consensus=${report.consensus.length} manifests=${report.productionManifestCount}`);
  console.log(`[character-references] coverage missing=${summary.missing} reference=${summary['reference-only']} production=${summary['in-production']} runtime=${summary['runtime-ready']} golden=${summary.golden}`);
  console.log(`[character-references] report=${output}`);
  if (args.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
