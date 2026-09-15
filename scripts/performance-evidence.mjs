import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  buildPhysicalPerformanceEvidence,
  comparePhysicalPerformanceEvidence,
  validatePhysicalEvidenceRecord,
} from './lib/physical-performance-evidence.mjs';

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

function readJson(file, label = 'input') {
  const target = resolve(file || '');
  if (!file || !existsSync(target)) throw new Error(`Missing ${label}: ${target}`);
  return JSON.parse(readFileSync(target, 'utf8'));
}

function outputJson(value, file = null) {
  const json = `${JSON.stringify(value, null, 2)}\n`;
  if (file) {
    const target = resolve(file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, json);
  }
  process.stdout.write(json);
}

export function ingestPhysicalEvidence(input, args = {}) {
  return buildPhysicalPerformanceEvidence(input, {
    evidenceKind: args.kind,
    captureOrigin: args.origin,
    app: args.app,
    buildRevision: args.build,
    deviceModel: args['device-model'],
    deviceClass: args['device-class'],
    os: args.os,
    runtime: args.runtime,
    capturedAt: args['captured-at'],
    viewportWidth: args['viewport-width'],
    viewportHeight: args['viewport-height'],
  });
}

export function compareEvidenceFiles(baseline, current, args = {}) {
  return comparePhysicalPerformanceEvidence(baseline, current, {
    frameP95Ratio: Number(args.frame || 1.12),
    gpuP95Ratio: Number(args.gpu || 1.15),
    drawCallRatio: Number(args.calls || 1.12),
    triangleRatio: Number(args.triangles || 1.18),
    textureRatio: Number(args.texture || 1.15),
    transparencyDrawCallRatio: Number(args.transparentCalls || 1.18),
    transparencyTriangleRatio: Number(args.transparentTriangles || 1.22),
    longFrameDelta: Number(args.longFrames || 3),
  });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const command = process.argv[2];
  const args = parseArgs(process.argv.slice(3));
  if (command === 'ingest') {
    if (!args.input) throw new Error('Use performance:evidence with --input <runtime-snapshot.json> and explicit physical-device provenance');
    const evidence = ingestPhysicalEvidence(readJson(args.input), args);
    outputJson(evidence, args.output || null);
    if (args['require-target'] && evidence.target.gate !== 'pass') process.exitCode = 1;
  } else if (command === 'validate') {
    const evidence = validatePhysicalEvidenceRecord(readJson(args.input));
    outputJson({ valid: true, schema: evidence.schema, app: evidence.app, device: evidence.device, build: evidence.build, target: evidence.target });
  } else if (command === 'compare') {
    const result = compareEvidenceFiles(readJson(args.baseline, 'baseline'), readJson(args.current, 'current'), args);
    outputJson(result, args.output || null);
    if (!result.pass) process.exitCode = 1;
  } else {
    throw new Error('Use performance-evidence.mjs ingest|validate|compare');
  }
}
