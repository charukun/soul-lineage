import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('Visual Review publication verifies the focus flow, real models and VFX on desktop and mobile',async()=>{
  const [workflow,opsBoard,smoke,collector,browserCheck,reviewCss]=await Promise.all([
    read('.github/workflows/review-preview.yml'),
    read('.github/workflows/ops-board.yml'),
    read('scripts/browser/visual-review-smoke.mjs'),
    read('ops-board/collector.mjs'),
    read('ops-board/browser-check.mjs'),
    read('apps/rinne/src/develop-review.css'),
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
  assert.match(smoke,/version\.commit,expectedSha|version\.commit, expectedSha/);
  assert.match(smoke,/page\.goto\(entry\.toString\(\),/);
  assert.match(smoke,/name:\s*'desktop'[\s\S]*width:\s*1280[\s\S]*height:\s*900/);
  assert.match(smoke,/name:\s*'mobile'[\s\S]*width:\s*390[\s\S]*height:\s*844[\s\S]*isMobile:\s*true[\s\S]*hasTouch:\s*true/);
  assert.match(smoke,/profile\.hasTouch\?locator\.tap\(\):locator\.click\(\)|profile\.hasTouch \? locator\.tap\(\) : locator\.click\(\)/);
  assert.match(smoke,/document\.documentElement\.scrollWidth<=innerWidth\+1|document\.documentElement\.scrollWidth <= innerWidth \+ 1/);
  assert.match(smoke,/public-\$\{profile\.name\}\.png/);
  assert.match(smoke,/profiles:results|profiles: results/);

  // The landing surface stays simple; choosing one target consumes the viewport until Back.
  assert.match(smoke,/\.review-launcher \[data-view\]/);
  assert.match(smoke,/data-review-mode/);
  assert.match(smoke,/data-review-target/);
  assert.match(smoke,/#review-home/);
  assert.match(smoke,/#focus-shell/);
  assert.match(smoke,/#focus-back/);
  assert.match(smoke,/focusHeight/);
  assert.match(smoke,/profile\.viewport\.height\*\.72/);
  assert.match(smoke,/data-app-context.*village/);

  // Existing real tools remain reachable from the focused flow.
  assert.match(smoke,/data-view.*motion/);
  assert.match(smoke,/characters\.html\?review=motion/);
  assert.match(smoke,/data-view.*effects/);
  assert.match(smoke,/review-effects\.html/);
  assert.match(smoke,/fx-status/);
  assert.match(smoke,/原本再生可能/);
  assert.match(smoke,/effects-\$\{profile\.name\}\.png/);

  // Battle must expose actual runtime model geometry and model switching, not circle proxies.
  assert.match(smoke,/battleGeometry.*runtime-models/);
  assert.match(smoke,/battleModels.*ready/);
  assert.match(smoke,/battle-hero-model/);
  assert.match(smoke,/battle-enemy-model/);
  assert.match(smoke,/kaykit\.mage\.v1/);
  assert.match(smoke,/kaykit\.barbarian\.v1/);
  assert.match(smoke,/battle-toggle/);
  assert.match(smoke,/battle-restart/);
  assert.match(smoke,/battle-time/);
  assert.match(smoke,/pageerror/);
  assert.match(smoke,/requestfailed/);

  assert.match(reviewCss,/\.focus-shell\{[^}]*position:fixed[^}]*inset:0/);
  assert.match(reviewCss,/\.focus-shell\[hidden\]\{display:none\}/);
  assert.match(reviewCss,/\.framed iframe\{[^}]*width:100%[^}]*height:100%/);
  assert.match(reviewCss,/@media\(max-width:760px\)\{[\s\S]*\.focus-shell\{grid-template-rows:48px minmax\(0,1fr\)/);
  assert.doesNotMatch(reviewCss,/\.review-nav\{/);

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

test('Review page lazy-loads focused embedded tools and does not preload hidden surfaces',async()=>{
  const review=await read('apps/rinne/src/develop-review.js');
  assert.match(review,/getAttribute\('src'\)/);
  assert.match(review,/setAttribute\('src',frame\.dataset\.src\)/);
  assert.match(review,/function enterFocus\(name\)/);
  assert.match(review,/if\(name==='battle'\)void ensureBattleStage\(\)/);
});
