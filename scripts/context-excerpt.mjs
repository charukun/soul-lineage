import { createReadStream } from 'node:fs';
import { readFile, writeFile, stat, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { DEFAULT_MAX_BYTES, MAX_LOG_BYTES } from './context-plan.mjs';

function positive(value, name) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) throw new Error(`${name} must be a positive integer`);
  return number;
}

// Scan bounded chunks: a single enormous log line must not fill memory.
export async function readRange(file, { start, end, maxBytes }) {
  const parts = [];
  let line = 1;
  let bytes = 0;
  let truncated = false;
  outer: for await (const chunk of createReadStream(file, { highWaterMark: 4096 })) {
    let offset = 0;
    while (offset < chunk.length) {
      if (line > end) break outer;
      const newline = chunk.indexOf(10, offset);
      const stop = newline < 0 ? chunk.length : newline + 1;
      if (line >= start) {
        const take = Math.min(stop - offset, maxBytes - bytes);
        parts.push(chunk.subarray(offset, offset + take));
        bytes += take;
        if (take < stop - offset) { truncated = true; break outer; }
      }
      if (newline >= 0) line += 1;
      offset = stop;
    }
  }
  // Do not turn a cut UTF-8 sequence into replacement bytes beyond the cap.
  const text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(parts), { stream: truncated });
  if (text.includes('\0')) throw new Error('Binary content is not context; use metadata');
  return { text, bytes: Buffer.byteLength(text), truncated };
}

export async function contextExcerpt({ file, kind = 'doc', start, end, maxBytes, conclusion, ledger }) {
  if (!['doc', 'log', 'patch'].includes(kind)) throw new Error('kind must be doc, log or patch');
  const cap = kind === 'log' ? MAX_LOG_BYTES : DEFAULT_MAX_BYTES;
  const limit = maxBytes === undefined ? cap : positive(maxBytes, 'maxBytes');
  if (limit > cap) throw new Error(`maxBytes cannot exceed ${cap} for ${kind}`);
  if (!ledger) throw new Error('Use a separate per-session ledger file');
  const sourcePath = await realpath(file);
  const ledgerPath = await realpath(ledger).catch(error => {
    if (error.code !== 'ENOENT') throw error;
    return null;
  });
  if (sourcePath === ledgerPath) throw new Error('Use a separate per-session ledger file');
  if (kind === 'log' && !['failure', 'cancelled'].includes(conclusion)) {
    throw new Error('Logs require a current failed/cancelled job conclusion');
  }
  const ranged = start !== undefined || end !== undefined;
  if (ranged && (start === undefined || end === undefined)) throw new Error('Supply both start and end lines');
  if (kind !== 'doc' && !ranged) throw new Error('Logs and patches require explicit line ranges');
  const size = (await stat(file)).size;
  if (!ranged && size > limit) throw new Error('Document deferred: search and request a line range');
  const from = ranged ? positive(start, 'start') : 1;
  const to = ranged ? positive(end, 'end') : Number.MAX_SAFE_INTEGER;
  if (to < from) throw new Error('end must be at least start');
  const result = await readRange(file, { start: from, end: to, maxBytes: limit });
  const digest = createHash('sha256').update(result.text).digest('hex');
  let seen = [];
  try { seen = JSON.parse(await readFile(ledger, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!Array.isArray(seen) || seen.some(item => typeof item !== 'string')) throw new Error('Invalid session ledger');
  const duplicate = seen.includes(digest);
  if (!duplicate && result.bytes > 0) await writeFile(ledger, JSON.stringify([...seen, digest]), { mode: 0o600 });
  return { ...result, text: duplicate ? '' : result.text, bytes: duplicate ? 0 : result.bytes, duplicate, digest };
}

function parseArgs(args) {
  const options = {};
  const names = { '--file': 'file', '--kind': 'kind', '--start': 'start', '--end': 'end', '--max-bytes': 'maxBytes', '--conclusion': 'conclusion', '--ledger': 'ledger' };
  for (let index = 0; index < args.length; index += 1) {
    const name = names[args[index]];
    if (!name || !args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`Invalid option: ${args[index]}`);
    options[name] = args[++index];
  }
  if (!options.file) throw new Error('--file is required');
  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await contextExcerpt(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify({ bytes: result.bytes, duplicate: result.duplicate, truncated: result.truncated, digest: result.digest }));
    if (result.text) process.stdout.write(result.text);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
