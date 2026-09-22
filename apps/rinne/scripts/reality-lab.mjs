import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { runComparison } from '../src/game/reality-lab/engine.js';
import { DEFAULTS, normalizeConfig } from '../src/game/reality-lab/config.js';
import { createReport } from '../src/game/reality-lab/report.js';

const args = process.argv.slice(2);
let config = { ...DEFAULTS }, out = null;
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--config') config = JSON.parse(args[++i]);
  else if (args[i] === '--out') out = args[++i];
  else throw Error(`Unknown argument: ${args[i]}`);
}
config = normalizeConfig(config);
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().length > 0;
const report = createReport({ config, results: runComparison(config), build: { commit: `${commit}${dirty ? '-dirty' : ''}` }, createdAt: new Date().toISOString() });
if (out) writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ format: report.format, config, results: report.results.map(({ mode, payloadBytes, primaryKbps, maxPeerKbps, darkMs, rollbackMs, epoch, phase, root, invalid, repairs, collapseMatchesReference }) => ({ mode, payloadBytes, primaryKbps, maxPeerKbps, darkMs, rollbackMs, epoch, phase, root, invalid, repairs, collapseMatchesReference })) }, null, 2));
