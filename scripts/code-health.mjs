import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const CONFIG_PATH = fileURLToPath(new URL('./code-health.config.json', import.meta.url));

export async function loadCodeHealthConfig(path = CONFIG_PATH) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export function normalizePath(path) {
  return String(path || '').split(sep).join('/').replace(/^\.\//, '');
}

export function isSourcePath(path, config) {
  const normalized = normalizePath(path);
  if (!config.roots.some(root => normalized.startsWith(root))) return false;
  if (!config.extensions.includes(extname(normalized))) return false;
  const segments = normalized.split('/');
  return !segments.some(segment => config.excludeSegments.includes(segment));
}

export function sanitizeSource(source) {
  let state = 'code';
  let escaped = false;
  let output = '';
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];
    if (state === 'line-comment') {
      if (char === '\n') {
        state = 'code';
        output += '\n';
      } else output += ' ';
      continue;
    }
    if (state === 'block-comment') {
      if (char === '*' && next === '/') {
        output += '  ';
        i += 1;
        state = 'code';
      } else output += char === '\n' ? '\n' : ' ';
      continue;
    }
    if (state !== 'code') {
      if (char === '\n') output += '\n';
      else output += ' ';
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if ((state === 'single' && char === "'") || (state === 'double' && char === '"') || (state === 'template' && char === '`')) {
        state = 'code';
      }
      continue;
    }
    if (char === '/' && next === '/') {
      output += '  ';
      i += 1;
      state = 'line-comment';
    } else if (char === '/' && next === '*') {
      output += '  ';
      i += 1;
      state = 'block-comment';
    } else if (char === "'") {
      output += ' ';
      state = 'single';
    } else if (char === '"') {
      output += ' ';
      state = 'double';
    } else if (char === '`') {
      output += ' ';
      state = 'template';
    } else {
      output += char;
    }
  }
  return output;
}

function countMatches(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

function stripRegexLiterals(source) {
  return source.replace(/\/(?:\\.|[^\/\n])+\/[dgimsuvy]*/g, match => ' '.repeat(match.length));
}

function directDependencyCount(source) {
  const dependencies = new Set();
  const patterns = [
    /(?:^|[;\n])\s*import\s+(?:[^'\"\n;]+?\s+from\s+)?['\"]([^'\"]+)['\"]/gm,
    /(?:^|[;\n])\s*export\s+(?:\*|\{[^}]*\})\s+from\s+['\"]([^'\"]+)['\"]/gm,
    /\brequire\s*\(\s*['\"]([^'\"]+)['\"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) dependencies.add(match[1]);
  }
  return dependencies.size;
}

function looksLikeFunctionStart(line) {
  if (/\bfunction\b[^{};]*\{/.test(line) || /=>\s*\{/.test(line)) return true;
  const method = line.match(/^\s*(?:async\s+)?(?:get\s+|set\s+)?([A-Za-z_$][\w$]*)\s*\([^;{}]*\)\s*\{/);
  if (!method) return false;
  return !new Set(['if', 'for', 'while', 'switch', 'catch', 'with']).has(method[1]);
}

function braceDelta(line) {
  const structural = stripRegexLiterals(line);
  return countMatches(structural, /\{/g) - countMatches(structural, /\}/g);
}

export function functionSpans(sanitized) {
  const lines = sanitized.split('\n');
  const active = [];
  const spans = [];
  let depth = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const before = depth;
    const delta = braceDelta(line);
    if (looksLikeFunctionStart(line) && delta > 0) {
      active.push({ start: index + 1, targetDepth: before + 1 });
    }
    depth += delta;
    for (let cursor = active.length - 1; cursor >= 0; cursor -= 1) {
      if (depth < active[cursor].targetDepth) {
        const item = active.splice(cursor, 1)[0];
        spans.push({ startLine: item.start, endLine: index + 1, lines: index + 2 - item.start });
      }
    }
  }
  for (const item of active) spans.push({ startLine: item.start, endLine: lines.length, lines: lines.length + 1 - item.start });
  return spans;
}

export function analyzeSource(source, path = 'source.js') {
  const sanitized = stripRegexLiterals(sanitizeSource(source));
  const lines = sanitized.split('\n');
  const loc = lines.filter(line => line.trim()).length;
  const spans = functionSpans(sanitized);
  const maxFunction = spans.reduce((best, span) => span.lines > (best?.lines || 0) ? span : best, null);
  const decisions = countMatches(sanitized, /\b(?:if|for|while|case|catch)\b|&&|\|\||\?\?/g);
  return {
    path: normalizePath(path),
    sourceBytes: Buffer.byteLength(source, 'utf8'),
    directDependencies: directDependencyCount(source),
    loc,
    decisions,
    decisionDensity: loc ? Number((decisions * 100 / loc).toFixed(2)) : 0,
    maxFunctionSpan: maxFunction?.lines || 0,
    maxFunctionStartLine: maxFunction?.startLine || null,
    duplicateLines: 0,
  };
}

function meaningfulDuplicateLines(source) {
  const sanitized = sanitizeSource(source);
  return sanitized.split('\n').map((line, index) => ({
    line: index + 1,
    text: line.trim().replace(/\s+/g, ' '),
  })).filter(item => item.text &&
    !/^import\b/.test(item.text) &&
    !/^export\s*\{/.test(item.text) &&
    !/^[{}[\](),;]+$/.test(item.text));
}

function hash(text) {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

export function duplicateGroups(entries, config) {
  const windows = new Map();
  const size = config.thresholds.duplicateWindowLines;
  for (const entry of entries) {
    const lines = meaningfulDuplicateLines(entry.source);
    for (let index = 0; index + size <= lines.length; index += 1) {
      const slice = lines.slice(index, index + size);
      const joined = slice.map(item => item.text).join('\n');
      if (joined.length < config.thresholds.duplicateMinChars) continue;
      const tokens = new Set(joined.match(/[A-Za-z_$][\w$]*/g) || []);
      if (tokens.size < 8) continue;
      const key = hash(joined);
      if (!windows.has(key)) windows.set(key, []);
      const occurrences = windows.get(key);
      if (occurrences.length < 20) occurrences.push({
        path: entry.path,
        startLine: slice[0].line,
        endLine: slice.at(-1).line,
      });
    }
  }
  const groups = [];
  for (const [fingerprint, occurrences] of windows) {
    if (occurrences.length < 2) continue;
    const unique = [];
    for (const occurrence of occurrences) {
      if (!unique.some(existing => existing.path === occurrence.path &&
        Math.abs(existing.startLine - occurrence.startLine) < size)) unique.push(occurrence);
    }
    if (unique.length < 2) continue;
    const distinctFiles = new Set(unique.map(item => item.path)).size;
    if (distinctFiles < 2 && unique.length < 3) continue;
    groups.push({ fingerprint, lines: size, occurrences: unique });
  }
  return groups.sort((a, b) => b.occurrences.length - a.occurrences.length)
    .slice(0, config.thresholds.maxDuplicateGroups);
}

function mergeCoverage(intervals) {
  if (!intervals.length) return 0;
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  let [start, end] = sorted[0];
  let total = 0;
  for (const [nextStart, nextEnd] of sorted.slice(1)) {
    if (nextStart <= end + 1) end = Math.max(end, nextEnd);
    else {
      total += end - start + 1;
      [start, end] = [nextStart, nextEnd];
    }
  }
  return total + end - start + 1;
}

function scale(value, soft, hard, points) {
  if (value <= soft) return 0;
  if (value >= hard) return points;
  return points * (value - soft) / (hard - soft);
}

export function scoreMetric(metric, config) {
  const t = config.thresholds;
  const locScore = scale(metric.loc, t.fileLocSoft, t.fileLocHard, 40);
  const functionScore = scale(metric.maxFunctionSpan, t.functionLinesSoft, t.functionLinesHard, 30);
  const complexityScore = metric.loc >= 250 ? scale(metric.decisionDensity, t.decisionDensitySoft, t.decisionDensityHard, 15) : 0;
  const duplicateScore = scale(metric.duplicateLines || 0, t.duplicateLinesSoft, t.duplicateLinesHard, 20);
  const contextSizeScore = scale(metric.sourceBytes || 0, t.contextBytesSoft, t.contextBytesHard, 60);
  const dependencyScore = scale(metric.directDependencies || 0, t.directDependenciesSoft, t.directDependenciesHard, 15);
  const score = Math.min(100, Math.round(locScore + functionScore + complexityScore + duplicateScore + contextSizeScore + dependencyScore));
  const reasons = [];
  if (metric.loc > t.fileLocSoft) reasons.push(`${metric.loc} LOC`);
  if (metric.maxFunctionSpan > t.functionLinesSoft) reasons.push(`longest function ≈ ${metric.maxFunctionSpan} lines`);
  if (metric.decisionDensity > t.decisionDensitySoft && metric.loc >= 250) reasons.push(`${metric.decisionDensity} decisions / 100 LOC`);
  if ((metric.duplicateLines || 0) > t.duplicateLinesSoft) reasons.push(`${metric.duplicateLines} duplicate-covered lines`);
  if ((metric.sourceBytes || 0) > t.contextBytesSoft) reasons.push(`${(metric.sourceBytes / 1024).toFixed(1)} KiB source context`);
  if ((metric.directDependencies || 0) > t.directDependenciesSoft) reasons.push(`${metric.directDependencies} direct dependencies`);
  const actionable = score >= t.dispatchScore || metric.loc >= t.hardActionFileLoc ||
    metric.maxFunctionSpan >= t.hardActionFunctionLines || (metric.duplicateLines || 0) >= t.hardActionDuplicateLines ||
    (metric.sourceBytes || 0) >= t.hardActionContextBytes;
  return { ...metric, score, reasons, actionable };
}

export function buildAuditReport(entries, config, generatedAt = new Date().toISOString()) {
  const groups = duplicateGroups(entries, config);
  const coverage = new Map(entries.map(entry => [entry.path, []]));
  for (const group of groups) {
    for (const occurrence of group.occurrences) {
      coverage.get(occurrence.path)?.push([occurrence.startLine, occurrence.endLine]);
    }
  }
  const metrics = entries.map(entry => {
    const metric = analyzeSource(entry.source, entry.path);
    metric.duplicateLines = mergeCoverage(coverage.get(entry.path) || []);
    return metric;
  });
  const candidates = metrics.map(metric => scoreMetric(metric, config))
    .sort((a, b) => b.score - a.score || b.sourceBytes - a.sourceBytes || b.loc - a.loc)
    .slice(0, config.thresholds.maxCandidates);
  const actionableCandidates = candidates.filter(candidate => candidate.actionable);
  return {
    version: 1,
    generatedAt,
    summary: {
      scannedFiles: entries.length,
      totalLoc: metrics.reduce((total, metric) => total + metric.loc, 0),
      totalSourceBytes: metrics.reduce((total, metric) => total + metric.sourceBytes, 0),
      contextHotspots: metrics.filter(metric => metric.sourceBytes > config.thresholds.contextBytesSoft).length,
      duplicateGroups: groups.length,
      actionableCandidates: actionableCandidates.length,
      topScore: candidates[0]?.score || 0,
      actionable: actionableCandidates.length > 0,
    },
    candidates,
    duplicateGroups: groups,
  };
}

export function formatMarkdownReport(report) {
  const rows = report.candidates.slice(0, 10).map(candidate =>
    `| ${candidate.score} | \`${candidate.path}\` | ${(candidate.sourceBytes / 1024).toFixed(1)} | ${candidate.directDependencies || 0} | ${candidate.loc} | ${candidate.maxFunctionSpan || '-'} | ${candidate.duplicateLines || 0} | ${candidate.actionable ? 'yes' : 'no'} |`).join('\n');
  return `## Code Health audit\n\n` +
    `Scanned **${report.summary.scannedFiles}** source files / **${report.summary.totalLoc}** LOC / **${(report.summary.totalSourceBytes / 1024).toFixed(1)} KiB**. ` +
    `Context hotspots: **${report.summary.contextHotspots}**. Actionable hotspots: **${report.summary.actionableCandidates}**. Duplicate groups: **${report.summary.duplicateGroups}**.\n\n` +
    `| score | file | KiB | direct deps | LOC | longest function | duplicate lines | actionable |\n| ---: | --- | ---: | ---: | ---: | ---: | ---: | :---: |\n${rows || '| 0 | none | 0 | 0 | 0 | - | 0 | no |'}\n`;
}

export function evaluateGuard(baseMetric, currentMetric, config, path) {
  if (!currentMetric) return [];
  const t = config.thresholds;
  const g = config.guard;
  const reasons = [];
  if (!baseMetric) {
    if (currentMetric.loc >= g.newFileLoc) reasons.push(`new source file has ${currentMetric.loc} LOC (limit ${g.newFileLoc})`);
    if (currentMetric.maxFunctionSpan >= g.newFileFunctionLines) reasons.push(`new source file contains ≈${currentMetric.maxFunctionSpan}-line function (limit ${g.newFileFunctionLines})`);
    if (currentMetric.sourceBytes >= g.newFileContextBytes) reasons.push(`new source file has ${(currentMetric.sourceBytes / 1024).toFixed(1)} KiB of AI context surface (limit ${(g.newFileContextBytes / 1024).toFixed(0)} KiB)`);
    return reasons.map(reason => ({ path, reason }));
  }
  const locDelta = currentMetric.loc - baseMetric.loc;
  const functionDelta = currentMetric.maxFunctionSpan - baseMetric.maxFunctionSpan;
  const decisionDelta = currentMetric.decisions - baseMetric.decisions;
  const contextByteDelta = currentMetric.sourceBytes - baseMetric.sourceBytes;
  if (locDelta >= g.existingLocIncrease && currentMetric.loc > t.fileLocSoft) {
    reasons.push(`source grew by ${locDelta} LOC to ${currentMetric.loc}; split responsibilities instead of extending the hotspot`);
  }
  if (functionDelta >= g.existingFunctionIncrease && currentMetric.maxFunctionSpan > t.functionLinesSoft) {
    reasons.push(`longest function grew by ≈${functionDelta} lines to ≈${currentMetric.maxFunctionSpan}`);
  }
  if (decisionDelta >= g.existingDecisionIncrease && currentMetric.loc >= 250 && currentMetric.decisionDensity > t.decisionDensitySoft) {
    reasons.push(`decision count grew by ${decisionDelta} and density is ${currentMetric.decisionDensity}/100 LOC`);
  }
  if (contextByteDelta >= g.existingContextByteIncrease && currentMetric.sourceBytes > t.contextBytesSoft) {
    reasons.push(`AI context surface grew by ${(contextByteDelta / 1024).toFixed(1)} KiB to ${(currentMetric.sourceBytes / 1024).toFixed(1)} KiB; split independently readable responsibilities instead of extending the hotspot`);
  }
  if (baseMetric.loc < g.hardFileLoc && currentMetric.loc >= g.hardFileLoc) {
    reasons.push(`file crossed hard ${g.hardFileLoc} LOC boundary`);
  }
  if (baseMetric.maxFunctionSpan < g.hardFunctionLines && currentMetric.maxFunctionSpan >= g.hardFunctionLines) {
    reasons.push(`function crossed hard ≈${g.hardFunctionLines}-line boundary`);
  }
  if (baseMetric.sourceBytes < g.hardContextBytes && currentMetric.sourceBytes >= g.hardContextBytes) {
    reasons.push(`source crossed hard ${(g.hardContextBytes / 1024).toFixed(0)} KiB AI context boundary`);
  }
  return reasons.map(reason => ({ path, reason }));
}

function git(cwd, args, options = {}) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', ...options });
}

function changedSourceEntries(cwd, base, head, config) {
  const output = git(cwd, ['diff', '--name-status', '--find-renames', base, head]);
  const entries = [];
  for (const line of output.split('\n')) {
    if (!line.trim()) continue;
    const fields = line.split('\t');
    const status = fields[0];
    if (status.startsWith('R')) {
      const [, basePath, currentPath] = fields;
      if (isSourcePath(currentPath, config) || isSourcePath(basePath, config)) entries.push({ status: 'R', basePath, currentPath });
    } else {
      const currentPath = fields[1];
      if (isSourcePath(currentPath, config)) entries.push({ status: status[0], basePath: currentPath, currentPath });
    }
  }
  return entries;
}

function gitFile(cwd, ref, path) {
  if (!ref || !path) return null;
  try {
    return git(cwd, ['show', `${ref}:${path}`], { maxBuffer: 16 * 1024 * 1024 });
  } catch {
    return null;
  }
}

export function guardChangesFromSources(changes, config) {
  const violations = [];
  for (const change of changes) {
    const baseMetric = change.baseSource == null ? null : analyzeSource(change.baseSource, change.basePath || change.path);
    const currentMetric = change.currentSource == null ? null : analyzeSource(change.currentSource, change.currentPath || change.path);
    violations.push(...evaluateGuard(baseMetric, currentMetric, config, change.currentPath || change.path));
  }
  return violations;
}

async function auditRepository(cwd, config) {
  const files = git(cwd, ['ls-files']).split('\n').filter(path => isSourcePath(path, config));
  const entries = await Promise.all(files.map(async path => ({ path, source: await readFile(resolve(cwd, path), 'utf8') })));
  return buildAuditReport(entries, config);
}

async function runAudit(args) {
  const cwd = process.cwd();
  const config = await loadCodeHealthConfig();
  const report = await auditRepository(cwd, config);
  const jsonIndex = args.indexOf('--json');
  if (jsonIndex >= 0 && args[jsonIndex + 1]) await writeFile(args[jsonIndex + 1], `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const markdown = formatMarkdownReport(report);
  const markdownIndex = args.indexOf('--markdown');
  if (markdownIndex >= 0 && args[markdownIndex + 1]) await writeFile(args[markdownIndex + 1], markdown, 'utf8');
  else process.stdout.write(markdown);
  return report;
}

async function runGuard(base, head) {
  if (!base || !head) throw new Error('usage: node scripts/code-health.mjs guard <base> <head>');
  const cwd = process.cwd();
  const config = await loadCodeHealthConfig();
  const changes = changedSourceEntries(cwd, base, head, config).map(change => ({
    ...change,
    baseSource: change.status === 'A' ? null : gitFile(cwd, base, change.basePath),
    currentSource: change.status === 'D' ? null : gitFile(cwd, head, change.currentPath),
  }));
  const violations = guardChangesFromSources(changes, config);
  if (violations.length) {
    console.error('Code Health regression guard rejected material source growth:');
    for (const violation of violations) console.error(`- ${violation.path}: ${violation.reason}`);
    console.error('Refactor/extract the growing responsibility; do not relax the guard solely to make this PR pass.');
    process.exitCode = 1;
  } else {
    console.log(`Code Health regression guard: ${changes.length} changed source file(s), no material bloat regression.`);
  }
  return violations;
}

async function main() {
  const [command = 'audit', ...args] = process.argv.slice(2);
  if (command === 'audit') await runAudit(args);
  else if (command === 'guard') await runGuard(args[0], args[1]);
  else throw new Error('usage: node scripts/code-health.mjs audit [--json file] [--markdown file] | guard <base> <head>');
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch(error => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
