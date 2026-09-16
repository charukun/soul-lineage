import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const SHA = /^[a-f0-9]{40}$/;
const html = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const href = path => path.split('/').map(encodeURIComponent).join('/');
const mediaType = path => /\.(png|jpg|jpeg|webp|gif)$/i.test(path) ? 'image' : /\.(webm|mp4)$/i.test(path) ? 'video' : null;

function validHeader(path, bytes) {
  const ext = extname(path).toLowerCase();
  if (ext === '.png') return bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
  if (ext === '.jpg' || ext === '.jpeg') return bytes.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'));
  if (ext === '.gif') return /^GIF8[79]a$/.test(bytes.toString('ascii', 0, 6));
  if (ext === '.webp') return bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (ext === '.webm') return bytes.subarray(0, 4).equals(Buffer.from('1a45dfa3', 'hex'));
  return ext === '.mp4' && bytes.toString('ascii', 4, 8) === 'ftyp';
}

export function collectCompletionEvidence({ directory, head, result, environment, scenario, receipt = null, requireReceipt = false }) {
  if (!SHA.test(head || '') || !['success', 'failure', 'cancelled', 'skipped'].includes(result) || !environment || !scenario) {
    throw new Error('INVALID_EVIDENCE_IDENTITY');
  }
  if (receipt && receipt.head !== head) throw new Error('EVIDENCE_HEAD_MISMATCH');
  if (receipt && (!Array.isArray(receipt.executedApps) || !Array.isArray(receipt.completedApps))) throw new Error('INVALID_PLAYTEST_RECEIPT');
  const media = [], omitted = [];
  let bytesRead = 0, visited = 0;
  function scan(relative = '', depth = 0) {
    if (depth > 8) throw new Error('EVIDENCE_DEPTH_LIMIT');
    if (!existsSync(join(directory, relative))) return;
    for (const entry of readdirSync(join(directory, relative), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (++visited > 1000) throw new Error('EVIDENCE_FILE_LIMIT');
      const path = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) { scan(path, depth + 1); continue; }
      if (!entry.isFile() || !mediaType(path)) continue;
      // Bound reads before allocating a potentially large video buffer.
      const file = join(directory, path);
      const bytes = readMedia(file, bytesRead);
      if (!bytes) { omitted.push(path); continue; }
      bytesRead += bytes.length;
      if (!validHeader(path, bytes)) { omitted.push(path); continue; }
      media.push({ path, kind: mediaType(path), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    }
  }
  scan();
  const receiptComplete = !receipt || (!receipt.failed && receipt.executedApps.every(app => receipt.completedApps.includes(app)));
  const effectiveResult = result === 'success' && !receiptComplete ? 'failure' : result;
  const missingReceipt = requireReceipt && !receipt;
  const state = missingReceipt || !media.length ? 'missing' : 'captured';
  return {
    schema: 1, head, result: effectiveResult, environment, scenario,
    generatedAt: new Date().toISOString(), startedAt: receipt?.startedAt || null,
    state, reason: missingReceipt ? 'playtest receipt missing' : !media.length ? 'no valid screenshot or video captured' : null,
    scope: 'Recorded scenario only; PR preview is not deployed DEV verification',
    executedApps: receipt?.executedApps || [], completedApps: receipt?.completedApps || [],
    media: missingReceipt ? [] : media, omitted,
  };
}

function readMedia(file, bytesRead) {
  const size = statSync(file).size;
  if (size < 12 || size > 64 * 1024 * 1024 || bytesRead + size > 256 * 1024 * 1024) return null;
  return readFileSync(file);
}

export function evidenceMarkdown(report) {
  return [
    '# 確認エビデンス', '',
    `- 対象SHA: \`${report.head}\``,
    `- 環境: ${report.environment}`,
    `- 確認内容: ${report.scenario}`,
    `- 検証結果: ${report.result} / 画像・動画: ${report.state}`,
    '- 確認範囲は記録したシナリオのみ。PR previewをDEV公開確認とは扱いません。',
    report.reason ? `- 未取得理由: ${report.reason}` : '',
    report.omitted.length ? `- サイズ上限・形式不一致による除外: ${report.omitted.length}件` : '',
    '', '展開後に [index.html](index.html) を開くと画像・動画を確認できます。', '',
    ...report.media.map(item => item.kind === 'image' ? `![${item.path}](${href(item.path)})` : `[動画: ${item.path}](${href(item.path)})`),
  ].filter(line => line !== undefined).join('\n');
}

export function evidenceHtml(report) {
  const cards = report.media.map(item => `<figure>${item.kind === 'image'
    ? `<img loading="lazy" src="${href(item.path)}" alt="${html(item.path)}">`
    : `<video controls playsinline preload="metadata" src="${href(item.path)}"></video>`}<figcaption>${html(item.path)}</figcaption></figure>`).join('\n');
  return `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>確認エビデンス</title><style>body{font:16px/1.7 system-ui,sans-serif;margin:24px auto;padding:0 18px;max-width:1100px;background:#f4f5f7;color:#19202b}h1{font-size:28px}code{overflow-wrap:anywhere}.media{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}figure{margin:0;padding:12px;background:white;border:1px solid #d6dbe4;border-radius:8px}img,video{display:block;max-width:100%;max-height:75vh;margin:auto}figcaption{overflow-wrap:anywhere;font-size:13px}p{margin:8px 0}</style>
<h1>確認エビデンス</h1><p>${html(report.scenario)}</p><p>環境: ${html(report.environment)} ／ 検証: ${html(report.result)} ／ 証拠: ${html(report.state)}</p><p>対象SHA: <code>${report.head}</code></p>
<p>確認範囲は記録したシナリオのみ。PR previewはDEV公開確認ではありません。</p>${report.reason ? `<p>未取得: ${html(report.reason)}</p>` : ''}<div class="media">${cards}</div></html>`;
}

function main() {
  const [directoryArg, head, result, environment = 'local PR preview', scenario = 'Affected mobile/WebGL browser smoke'] = process.argv.slice(2);
  if (!directoryArg) throw new Error('Usage: completion-evidence.mjs <directory> <head SHA> <success|failure|cancelled|skipped> [environment] [scenario]');
  const currentHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (head !== currentHead) throw new Error('EVIDENCE_CHECKOUT_HEAD_MISMATCH');
  const directory = resolve(directoryArg), receiptPath = join(directory, 'playtest-receipt.json');
  const receipt = existsSync(receiptPath) ? JSON.parse(readFileSync(receiptPath, 'utf8')) : null;
  const report = collectCompletionEvidence({ directory, head, result, environment, scenario, receipt, requireReceipt: process.env.GITHUB_JOB === 'browser' });
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'completion-evidence.json'), JSON.stringify(report, null, 2));
  writeFileSync(join(directory, 'README.md'), evidenceMarkdown(report));
  writeFileSync(join(directory, 'index.html'), evidenceHtml(report));
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `state=${report.state}\nimages=${report.media.filter(m => m.kind === 'image').length}\nvideos=${report.media.filter(m => m.kind === 'video').length}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, evidenceMarkdown({ ...report, media: [] }));
  console.log(JSON.stringify({ head, state: report.state, result: report.result, media: report.media.length, directory }));
  if (report.result !== result) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
