import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildInventoryReport, inspectAssetBuffer, INSPECTABLE_ASSET_EXTENSIONS } from './lib/asset-inspection.mjs';

const supported = new Set(INSPECTABLE_ASSET_EXTENSIONS);

export function trackedAssetFiles({ root = process.cwd(), exec = execFileSync } = {}) {
  const output = exec('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' });
  return output.split('\0').filter(Boolean).filter(file => supported.has(extname(file).toLowerCase()));
}

export function inspectInventoryFiles(files, { root = process.cwd() } = {}) {
  const rows = [], errors = [];
  for (const entry of files) {
    const absolute = resolve(root, entry), file = relative(root, absolute).replaceAll('\\', '/');
    try {
      if (!existsSync(absolute) || !statSync(absolute).isFile()) throw new Error('tracked asset is missing or not a file');
      const stat = statSync(absolute);
      rows.push(inspectAssetBuffer(readFileSync(absolute), { file, bytes: stat.size }));
    } catch (error) {
      errors.push({ file, error: String(error?.message || error) });
    }
  }
  return { rows, errors };
}

export function buildRepositoryAssetInventory(files, { root = process.cwd(), limit = 20, createdAt } = {}) {
  const { rows, errors } = inspectInventoryFiles(files, { root });
  return { ...buildInventoryReport(rows, { limit, createdAt }), parseErrors: errors };
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
  const root = resolve(args.root || process.cwd());
  const limit = Math.max(1, Number(args.limit || 20));
  if (!Number.isInteger(limit)) throw new Error('--limit must be an integer');
  const output = resolve(args.output || 'test-results/asset-inventory.json');
  const files = trackedAssetFiles({ root });
  const report = buildRepositoryAssetInventory(files, { root, limit });
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`[asset-inventory] assets=${report.summary.assets} ${(report.summary.bytes / 1024 / 1024).toFixed(1)} MiB parseErrors=${report.parseErrors.length}`);
  for (const row of report.priority) console.log(`[asset-inventory] ${row.priority.score.toFixed(1)} ${row.priority.action} ${row.file}`);
  console.log(`[asset-inventory] report=${output}`);
  if (args.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.parseErrors.length) process.exitCode = 1;
}
