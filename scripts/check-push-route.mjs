import { execFileSync } from 'node:child_process';

const MiB = 1024 * 1024;
const CONNECTOR_SAFE_LIMIT = 10 * MiB;
const GITHUB_WARN_LIMIT = 50 * MiB;
const GITHUB_HARD_LIMIT = 100 * MiB;

const base = process.argv[2] || 'origin/develop';
const head = process.argv[3] || 'HEAD';

const output = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMRT', `${base}...${head}`], { encoding: 'utf8' });
const files = output.split(/\r?\n/).filter(Boolean);

const rows = [];
for (const file of files) {
  try {
    const sizeText = execFileSync('git', ['cat-file', '-s', `${head}:${file}`], { encoding: 'utf8' }).trim();
    const size = Number(sizeText);
    rows.push({ file, size });
  } catch {
    // Skip non-blob paths such as deleted/submodule entries.
  }
}

const over100 = rows.filter(x => x.size > GITHUB_HARD_LIMIT);
const over50 = rows.filter(x => x.size > GITHUB_WARN_LIMIT);
const over10 = rows.filter(x => x.size > CONNECTOR_SAFE_LIMIT);

const human = bytes => `${(bytes / MiB).toFixed(1)} MiB`;
const print = list => list.map(x => `  - ${x.file}: ${human(x.size)}`).join('\n');

if (over100.length) {
  console.error('PUSH_ROUTE=LFS_REQUIRED');
  console.error('GitHub blocks files larger than 100 MiB in normal Git. Move these assets to Git LFS or another asset channel before opening a Ready PR.');
  console.error(print(over100));
  process.exit(2);
}

if (over50.length) {
  console.log('PUSH_ROUTE=CODESPACES_GIT');
  console.log('Use GitHub Codespaces + normal git push. GitHub warns for files above 50 MiB, so review whether Git LFS is more appropriate.');
  console.log(print(over50));
  process.exit(0);
}

if (over10.length) {
  console.log('PUSH_ROUTE=CODESPACES_GIT');
  console.log('At least one changed file exceeds the repository connector-safe threshold. Do not retry connector/Base64 transport; switch immediately to Codespaces + normal git push.');
  console.log(print(over10));
  process.exit(0);
}

console.log('PUSH_ROUTE=WORK_CONNECTOR_OK');
console.log('Changed files are within the connector-safe threshold. Normal WORK/GitHub connector flow is preferred.');
