import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('Visual Review publication follows exact develop delivery rather than a default-branch event',async()=>{
  const [workflow,opsBoard]=await Promise.all([
    read('.github/workflows/review-preview.yml'),
    read('.github/workflows/ops-board.yml'),
  ]);
  assert.match(workflow,/workflow_call:/);
  assert.match(workflow,/source_sha:[\s\S]*required: true/);
  assert.match(workflow,/ref: \$\{\{ inputs\.source_sha \}\}/);
  assert.match(workflow,/REVIEW_PREVIEW_ENABLED != 'false'/);
  assert.match(workflow,/repos\.getBranch\(\{ \.\.\.context\.repo, branch: 'develop' \}\)/);
  assert.match(workflow,/npm run build:review/);
  assert.match(workflow,/wrangler@4 deploy --config wrangler\.review\.jsonc/);
  assert.match(workflow,/curl -fsS[\s\S]*rinne-visual-review\.c-okamoto\.workers\.dev/);
  assert.match(workflow,/DEPLOY_OUTCOME: \$\{\{ steps\.deploy\.outcome \}\}/);
  assert.match(workflow,/PUBLIC_OUTCOME: \$\{\{ steps\.public\.outcome \}\}/);
  assert.match(workflow,/visual-review\/public/);
  assert.doesNotMatch(workflow,/workflow_run:/);
  assert.doesNotMatch(workflow,/work\/visual-review-lab-v2/);

  assert.match(opsBoard,/visual-review:[\s\S]*uses: \.\/\.github\/workflows\/review-preview\.yml/);
  assert.match(opsBoard,/source_sha: \$\{\{ inputs\.source_sha \|\| github\.sha \}\}/);
  assert.match(opsBoard,/secrets: inherit/);
});

test('Review build promotes review.html only inside the dedicated Review bundle',async()=>{
  const build=await read('scripts/build-review.mjs');
  assert.match(build,/npm.*build:rinne/s);
  assert.match(build,/review\.html/);
  assert.match(build,/game\.html/);
  assert.match(build,/copyFileSync\(reviewIndex,appIndex\)/);
});

test('Review Worker keeps the established fixed deployment name',async()=>{
  const config=await read('wrangler.review.jsonc');
  assert.match(config,/"name": "rinne-visual-review"/);
  assert.match(config,/"directory": "\.\/dist\/rinne"/);
});
