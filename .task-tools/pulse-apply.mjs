import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

const patch = (path, before, after, expected = 1) => {
  const text = readFileSync(path, 'utf8');
  assert.equal(text.split(before).length - 1, expected, `Patch context changed: ${path} / ${before.slice(0, 50)}`);
  writeFileSync(path, text.split(before).join(after));
};
const pkgPath = 'apps/demon/package.json';
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
assert.equal(pkg.displayName, '暗い喰らいCry');
pkg.displayName = '尽喰廻遊';
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

patch('ops-board/public/index.html', '<title>輪廻転焦 開発状況ボード</title>', '<title>PULSE</title>');
patch('ops-board/public/index.html', '<p class="eyebrow">輪廻転焦 / 開発運用</p>\n        <h1>開発状況ボード</h1>\n        <p class="muted">Rinne Ops Board</p>', '<p class="eyebrow">DEVELOPMENT / OPERATIONS</p>\n        <h1 class="pulse-wordmark">PULSE</h1>');
patch('ops-board/public/index.html', '各アプリがいま公開されているかを、アイコン付きの3列一覧で確認できます。', '各ゲームの開発・検証・本番を確認できます。未公開の環境も省略せず表示します。');
patch('ops-board/public/index.html', 'まだ公開されていればここでは未公開', 'まだ公開されていなければここでは未公開');
writeFileSync('ops-board/public/app-board.css', readFileSync('ops-board/public/app-board.css', 'utf8') + '\n.pulse-wordmark{letter-spacing:.12em;font-weight:600;line-height:1.1}\n');
patch('ops-board/public/app-board.js', "  unknown: ['確認中', 'info'],", "  missing: ['未公開', 'warning'],\n  unknown: ['確認中', 'info'],");
patch('ops-board/public/app-board.js', "const bad = targets.some(target => target.state === 'failed');", "const bad = targets.some(target => target.state === 'failed' || target.state === 'missing');");
patch('ops-board/public/app-board.js', "const errors = apps.filter(app => (app.targets || []).some(target => target.state === 'failed')).length;", "const errors = apps.filter(app => !(app.targets || []).length || app.targets.some(target => target.state !== 'success')).length;");
patch('ops-board/public/app-board.js', "summary.textContent = `${apps.length}アプリ${errors ? ` / 要確認 ${errors}` : ' / 正常'}`;", "summary.textContent = apps.length ? `${apps.length}アプリ${errors ? ` / 未公開・要確認 ${errors}` : ' / 正常'}` : '公開情報なし';");

patch('ops-board/worker.mjs', "  const name = id === 'dev' ? 'DEV' : 'Production';\n  const branch = id === 'dev' ? 'develop' : 'main';", "  const name = { dev: 'DEV', staging: 'STAGING / 検証', prod: 'Production' }[id];\n  const branch = manifest.environmentSnapshots?.[id]?.branch || (id === 'prod' ? 'main' : 'develop');");
patch('ops-board/worker.mjs', "  let prod = environmentFromManifest('prod', manifest, branches.get('main')?.commit?.sha || null, latestMainRun);", "  let prod = environmentFromManifest('prod', manifest, branches.get('main')?.commit?.sha || null, latestMainRun);\n  let staging = environmentFromManifest('staging', manifest, publishedCommit(manifest, 'staging').commit, null);\n  staging = await withHistory(staging, previousById.get('staging'));\n  staging.source = 'Pinned validation release / published manifest';");
patch('ops-board/worker.mjs', '[dev, prod, ...previews]', '[dev, staging, prod, ...previews]', 2);
patch('ops-board/worker.mjs', "if (context === 'visual-review/public') return 'Visual Review';", "if (context === 'visual-review/public') return 'Visual Review Lab';");

patch('scripts/vite-app.mjs', "import { graph, appNode, inputHash } from './workspaces.mjs';", "import { graph, appNode, inputHash } from './workspaces.mjs';\nimport { GAME_ENVIRONMENTS } from './application-catalog.mjs';");
patch('scripts/vite-app.mjs', "if (!['local', 'dev', 'prod'].includes(environment)) throw new Error('Invalid APP_ENV');", "if (environment !== 'local' && !GAME_ENVIRONMENTS.some(item => item.id === environment)) throw new Error('Invalid APP_ENV');");

patch('.github/workflows/deploy.yml', '      full_verification:', "      refresh_staging:\n        description: 'Refresh the pinned validation environments from the verified develop snapshot (retain Production)'\n        type: boolean\n        required: false\n        default: false\n      full_verification:");
patch('.github/workflows/deploy.yml', "if: always() && (github.ref == 'refs/heads/main' || (needs.integrate.result == 'success' && needs.integrate.outputs.verify == 'true'))", "if: always() && (github.ref == 'refs/heads/main' || (needs.integrate.result == 'success' && (needs.integrate.outputs.verify == 'true' || inputs.refresh_staging == true)))");
patch('.github/workflows/deploy.yml', "          DEPLOY_DEV_ONLY: ${{ github.ref == 'refs/heads/develop' }}", "          DEPLOY_DEV_ONLY: ${{ github.ref == 'refs/heads/develop' }}\n          INITIALIZE_GAME_ENVIRONMENTS: 'true'\n          REFRESH_STAGING: ${{ inputs.refresh_staging == true && github.ref == 'refs/heads/develop' }}");
patch('.github/workflows/ops-board.yml', "      - 'ops-board/**'", "      - 'ops-board/**'\n      - 'scripts/application-catalog.mjs'\n      - 'apps/*/package.json'\n      - 'tests/pulse-*.test.mjs'");
patch('.github/workflows/ops-board.yml', 'node --test tests/ops-board.test.mjs tests/ops-applications.test.mjs', 'node --test tests/ops-board.test.mjs tests/ops-applications.test.mjs tests/pulse-*.test.mjs');

patch('tests/ops-applications.test.mjs', 'assert.equal(rinne.targets.length, 2);', 'assert.equal(rinne.targets.length, 3);\n  assert.equal(rinne.targets[1].state, \'missing\');\n  assert.equal(rinne.targets[1].url, null);');
patch('tests/ops-applications.test.mjs', "assert.equal(rinne.targets[1].url, 'https://charukun.github.io/soul-lineage/prod/');", "assert.equal(rinne.targets[2].url, 'https://charukun.github.io/soul-lineage/prod/');");
patch('tests/ops-applications.test.mjs', "assert.equal(portal.name, 'WAYFINDER（公開リンクギャラリー）');", "assert.equal(portal.name, 'WAYFINDER');\n  assert.equal(visual.name, 'Visual Review Lab');\n  assert.equal(ops.name, 'PULSE');");
for (const path of ['README.md', 'docs/MONOREPO.md']) {
  writeFileSync(path, readFileSync(path, 'utf8').replaceAll('暗い喰らいCry', '尽喰廻遊'));
}
for (const path of ['docs/OPS_BOARD.md', 'ops-board/README.md']) {
  writeFileSync(path, readFileSync(path, 'utf8').replaceAll('Rinne Ops Board', 'PULSE'));
}
writeFileSync('README.md', readFileSync('README.md', 'utf8') + '\n## 開発・検証・本番の整合性\n\n各ゲームの環境構成・初回補完・固定リリースの更新方法は [環境運用](docs/GAME_ENVIRONMENTS.md) を正本とします。従来表の「将来対応」は初回補完前の表記です。公開済み判定は PULSE と公開manifestで確認してください。\n');
writeFileSync('docs/OPS_BOARD.md', readFileSync('docs/OPS_BOARD.md', 'utf8') + '\n## 名称と3環境\n\nゲーム名は各workspaceのdisplayNameを正本とし、古い公開manifestの名前で上書きしません。各ゲームに開発・検証・本番を常に表示し、未登録は「未公開」、情報の重複や不正なパスは「確認中」としてリンクを有効化しません。環境全体が混在SHAでも各アプリの実公開SHAを表示します。検証版は固定リリースであり、DEVの次の更新で自動上書きしません。詳しくは GAME_ENVIRONMENTS.md を参照してください。Worker名rinne-ops、URL、workflow名は互換性のため維持します。\n');
console.log('PULSE_PATCH_APPLIED');
