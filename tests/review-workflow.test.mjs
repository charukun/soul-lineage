import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('Visual Review publication follows develop delivery rather than a long-lived Lab branch',async()=>{
  const workflow=await read('.github/workflows/review-preview.yml');
  assert.match(workflow,/workflow_run:/);
  assert.match(workflow,/workflows: \["Deploy DEV and PROD"\]/);
  assert.match(workflow,/branches: \[develop\]/);
  assert.match(workflow,/ref: develop/);
  assert.match(workflow,/git rev-parse HEAD/);
  assert.match(workflow,/branches\/develop/);
  assert.match(workflow,/npm run build:review/);
  assert.match(workflow,/wrangler@4 deploy --config wrangler\.review\.jsonc/);
  assert.match(workflow,/visual-review\/public/);
  assert.doesNotMatch(workflow,/work\/visual-review-lab-v2/);
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
