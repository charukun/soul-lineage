import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const ALWAYS = ['AGENTS.md'];
const MAX_DOCS = 8;

const ROUTES = [
  {
    test: ({ text, paths }) => /\b(integration|merge|ready|handoff|deploy|release|ci|github actions)\b|統合|マージ|デプロイ|公開|引き渡し/i.test(text)
      || paths.some(path => path.startsWith('.github/workflows/')),
    docs: ['docs/DEVELOPMENT.md', 'docs/INTEGRATION.md', 'docs/RINNE_PROJECT_EXECUTION_POLICY.md'],
  },
  {
    test: ({ text, paths }) => /\b(rescue|watchdog|pulse)\b|救済|レスキュー/i.test(text)
      || paths.some(path => /integration-rescue|pulse/i.test(path)),
    docs: ['docs/INTEGRATION_RESCUE.md'],
  },
  {
    test: ({ text, paths }) => /\b(browser|playwright|e2e|self[- ]?heal|visual regression)\b|ブラウザ|自己修復/i.test(text)
      || paths.some(path => /browser|playwright/i.test(path)),
    docs: ['docs/BROWSER_SELF_HEALING.md'],
  },
  {
    test: ({ text, paths }) => /\b(dispatch|worker dispatch)\b|派生|別セッション/i.test(text)
      || paths.some(path => /dispatch/i.test(path)),
    docs: ['docs/DISPATCHER.md'],
  },
  {
    test: ({ text, paths }) => /\b(motion|animation|stance|pose|locomotion|rig)\b|モーション|構え|姿勢|アニメーション/i.test(text)
      || paths.some(path => /motion|animation|character/i.test(path)),
    docs: ['docs/characters/MOTION_AUTHORING.md', 'docs/characters/MOTION_QUALITY.md', 'docs/PLATFORMS.md'],
  },
  {
    test: ({ text, paths }) => /\b(mobile|codespaces|git push|push route)\b|スマホ|プッシュ経路/i.test(text)
      || paths.some(path => /check-push-route|mobile-hybrid/i.test(path)),
    docs: ['docs/MOBILE_HYBRID_DEVELOPMENT.md'],
  },
  {
    test: ({ text, paths }) => /\b(monorepo|workspace|package boundary|shared package)\b|モノレポ|共有package/i.test(text)
      || paths.some(path => /^(package(?:-lock)?\.json|apps\/[^/]+\/package\.json|packages\/[^/]+\/package\.json)$/.test(path)),
    docs: ['docs/MONOREPO.md'],
  },
  {
    test: ({ text, paths }) => /\b(refactor|code health|structural debt|complexity)\b|リファクタ|可読性|構造的負債/i.test(text)
      || paths.some(path => /code-health/i.test(path)),
    docs: ['docs/CODE_HEALTH.md'],
  },
  {
    test: ({ text, paths }) => /\b(gameplay|webgl|renderer|platform|three\.js)\b|ゲームプレイ|描画|レンダリング/i.test(text)
      || paths.some(path => /^apps\/(rinne|village|demon)\//.test(path)),
    docs: ['docs/PLATFORMS.md'],
  },
];

function unique(items) {
  return [...new Set(items)];
}

function parseArgs(argv) {
  const result = { task: '', paths: [], base: 'origin/develop', head: 'HEAD', json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--task') result.task = argv[++index] || '';
    else if (arg === '--path') result.paths.push(argv[++index] || '');
    else if (arg === '--paths') result.paths.push(...(argv[++index] || '').split(',').map(value => value.trim()));
    else if (arg === '--base') result.base = argv[++index] || result.base;
    else if (arg === '--head') result.head = argv[++index] || result.head;
    else if (arg === '--json') result.json = true;
    else if (arg === '--help' || arg === '-h') result.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  result.paths = result.paths.filter(Boolean);
  return result;
}

function git(root, args, fallback = null) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return fallback;
  }
}

function changedPaths(root, base, head) {
  const output = git(root, ['diff', '--no-renames', '--name-only', '-z', base, head], '');
  return output ? output.split('\0').filter(Boolean) : [];
}

export function selectContextDocs({ task = '', paths = [], root = process.cwd() } = {}) {
  const context = { text: task, paths: unique(paths.filter(Boolean)) };
  const docs = [...ALWAYS];
  for (const route of ROUTES) {
    if (route.test(context)) docs.push(...route.docs);
  }
  return unique(docs)
    .filter(path => path === 'AGENTS.md' || existsSync(`${root}/${path}`))
    .slice(0, MAX_DOCS);
}

export function buildContextPlan({ task = '', paths = [], base = 'origin/develop', head = 'HEAD', root = process.cwd() } = {}) {
  const explicitPaths = unique(paths.filter(Boolean));
  const inferredPaths = explicitPaths.length > 0 ? explicitPaths : changedPaths(root, base, head);
  const branch = git(root, ['branch', '--show-current'], null);
  const headSha = git(root, ['rev-parse', head], null);
  const baseSha = git(root, ['rev-parse', base], null);
  return {
    sourceOfTruth: 'latest develop + current GitHub branch/commit/PR state',
    task: task || null,
    git: { branch, head: headSha, base: baseSha },
    changedPaths: inferredPaths,
    read: selectContextDocs({ task, paths: inferredPaths, root }),
    retrieval: [
      'Read only the listed docs that are necessary for the decision.',
      'Search/narrow first; fetch full files, PR patches, or CI logs only when needed.',
      'Reuse already-known exact-head metadata until there is a reason it may have changed.',
    ],
    avoidPreload: ['past chat history', 'closed/merged PR bodies and diffs', 'all docs', 'all workflow logs', 'binary/base64 artifacts'],
    boundary: 'This plan reduces repository/GitHub retrieval only; product-injected system/Project/memory context is outside repository control.',
  };
}

function printHelp() {
  console.log(`Usage: npm run context:plan -- [options]\n\nOptions:\n  --task <text>       Short task summary used to select relevant docs\n  --path <path>       Add a relevant/changed path (repeatable)\n  --paths <a,b>       Add comma-separated paths\n  --base <ref>        Diff base when no path is supplied (default: origin/develop)\n  --head <ref>        Diff head (default: HEAD)\n  --json              Print JSON instead of compact text\n`);
}

function printCompact(plan) {
  console.log('LEAN_CONTEXT_PLAN');
  if (plan.task) console.log(`task: ${plan.task}`);
  if (plan.git.branch || plan.git.head) console.log(`git: ${plan.git.branch || 'detached'} @ ${plan.git.head || 'unknown'}`);
  console.log('read:');
  for (const path of plan.read) console.log(`- ${path}`);
  if (plan.changedPaths.length > 0) {
    console.log('changed paths:');
    for (const path of plan.changedPaths.slice(0, 20)) console.log(`- ${path}`);
    if (plan.changedPaths.length > 20) console.log(`- ... +${plan.changedPaths.length - 20} more (do not preload contents)`);
  }
  console.log('rule: narrow/search first; do not preload old chats, all docs, whole diffs, or all CI logs');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) printHelp();
    else {
      const plan = buildContextPlan(options);
      if (options.json) console.log(JSON.stringify(plan, null, 2));
      else printCompact(plan);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
