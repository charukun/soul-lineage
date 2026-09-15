import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { comparePerformanceSnapshots } from '@soul/rendering/performance-lab';

const args = Object.fromEntries(process.argv.slice(2).reduce((rows, value, index, all) => {
  if (value.startsWith('--')) rows.push([value.slice(2), all[index + 1]]);
  return rows;
}, []));
if (!args.baseline || !args.current) throw new Error('Use --baseline <json> --current <json>');
const parse = file => JSON.parse(readFileSync(resolve(file), 'utf8'));
const baseline = parse(args.baseline), current = parse(args.current);
const report = comparePerformanceSnapshots(baseline.performance || baseline, current.performance || current, {
  frameP95Ratio: Number(args.frame || 1.12),
  gpuP95Ratio: Number(args.gpu || 1.15),
  drawCallRatio: Number(args.calls || 1.12),
  triangleRatio: Number(args.triangles || 1.18),
  textureRatio: Number(args.texture || 1.15),
  transparencyDrawCallRatio: Number(args.transparentCalls || 1.18),
  transparencyTriangleRatio: Number(args.transparentTriangles || 1.22),
  longFrameDelta: Number(args.longFrames || 3),
});
console.log(JSON.stringify(report, null, 2));
if (!report.pass) process.exitCode = 1;
