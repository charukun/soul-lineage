import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('Visual Review publication follows exact develop delivery and requires desktop plus mobile browser verification',async()=>{
  const [workflow,opsBoard,smoke,collector,browserCheck]=await Promise.all([
    read('.github/workflows/review-preview.yml'),
    read('.github/workflows/ops-board.yml'),
    read('scripts/browser/visual-review-smoke.mjs'),
    read('ops-board/collector.mjs'),
    read('ops-board/browser-check.mjs'),
  ]);
  assert.match(workflow,/workflow_call:/);
  assert.match(workflow,/source_sha:[\s\S]*required: true/);
  assert.match(workflow,/ref: \$\{\{ inputs\.source_sha \}\}/);
  assert.match(workflow,/REVIEW_PREVIEW_ENABLED != 'false'/);
  assert.match(workflow,/repos\.getBranch\(\{ \.\.\.context\.repo, branch: 'develop' \}\)/);
  assert.match(workflow,/npm run build:review/);
  assert.match(workflow,/wrangler@4 deploy --config wrangler\.review\.jsonc/);
  assert.match(workflow,/playwright install --with-deps chromium/);
  assert.match(workflow,/visual-review-smoke\.mjs/);
  assert.match(workflow,/visual-review-\$\{\{ inputs\.source_sha \}\}/);
  assert.match(workflow,/DEPLOY_OUTCOME: \$\{\{ steps\.deploy\.outcome \}\}/);
  assert.match(workflow,/PUBLIC_OUTCOME: \$\{\{ steps\.public\.outcome \}\}/);
  assert.match(workflow,/visual-review\/public/);
  assert.match(workflow,/browser-verified/);
  assert.doesNotMatch(workflow,/workflow_run:/);
  assert.doesNotMatch(workflow,/work\/visual-review-lab-v2/);

  assert.match(smoke,/version\.json/);
  assert.match(smoke,/version\.commit, expectedSha/);
  assert.match(smoke,/page\.goto\(entry\.toString\(\),/);
  assert.doesNotMatch(smoke,/page\.goto\(entry,\s*\{/);
  assert.match(smoke,/name: 'desktop'[\s\S]*width: 1280[\s\S]*height: 900/);
  assert.match(smoke,/name: 'mobile'[\s\S]*width: 390[\s\S]*height: 844[\s\S]*isMobile: true[\s\S]*hasTouch: true/);
  assert.match(smoke,/profile\.hasTouch \? locator\.tap\(\) : locator\.click\(\)/);
  assert.match(smoke,/document\.documentElement\.scrollWidth <= innerWidth \+ 1/);
  assert.match(smoke,/public-\$\{profile\.name\}\.png/);
  assert.match(smoke,/profiles: results/);
  assert.match(smoke,/\[data-view=\\?"motion/);
  assert.match(smoke,/characters\.html\?review=motion/);
  assert.match(smoke,/battle-time/);
  assert.match(smoke,/pageerror/);
  assert.match(smoke,/requestfailed/);

  assert.match(opsBoard,/visual-review:[\s\S]*uses: \.\/\.github\/workflows\/review-preview\.yml/);
  assert.match(opsBoard,/source_sha: \$\{\{ inputs\.source_sha \|\| github\.sha \}\}/);
  assert.match(opsBoard,/secrets: inherit/);

  assert.match(collector,/\/commits\/\$\{developSha\}\/status/);
  assert.match(collector,/status\.context === 'visual-review\/public'/);
  assert.match(collector,/VISUAL_REVIEW_PUBLIC_URL/);
  assert.match(collector,/deployedCommit: selected\.state === 'success' \? developSha/);

  assert.match(browserCheck,/page\.locator\('#app-dialog \.app-dialog-close'\)\.click\(\)/);
  assert.doesNotMatch(browserCheck,/page\.locator\('\.app-dialog-close'\)\.click\(\)/);
});

test('Review build promotes review.html only inside the dedicated Review bundle',async()=>{
  const build=await read('scripts/build-review.mjs');
  assert.match(build,/npm.*build:rinne/s);
  assert.match(build,/review\.html/);
  assert.match(build,/game\.html/);
  assert.match(build,/copyFileSync\(reviewIndex,appIndex\)/);
});

test('Review page loads lazy embedded tools from an explicit src attribute',async()=>{
  const review=await read('apps/rinne/src/develop-review.js');
  assert.match(review,/getAttribute\('src'\)/);
  assert.match(review,/setAttribute\('src',frame\.dataset\.src\)/);
});

test('Review Worker keeps the established fixed deployment name',async()=>{
  const config=await read('wrangler.review.jsonc');
  assert.match(config,/"name": "rinne-visual-review"/);
  assert.match(config,/"directory": "\.\/dist\/rinne"/);
});
