import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Workers DEV is the only automatic develop publication path and includes the independent Review app',()=>{
  const workflow=text('.github/workflows/dev-app-publish.yml');
  assert.match(workflow,/push:\n\s+branches: \[develop\]/);
  assert.match(workflow,/options: \[rinne, village, demon, review\]/);
  assert.match(workflow,/group: per-app-dev-\$\{\{ matrix\.app \}\}/);
  assert.match(workflow,/cancel-in-progress: true/);
  assert.match(workflow,/distribution:build -- --app "\$APP" --target web-dev/);
  assert.match(workflow,/wrangler@4 deploy --config "wrangler\.dev\.\$APP\.jsonc"/);
  assert.match(workflow,/Focused app validation diagnostic[\s\S]*continue-on-error: true/);
  assert.match(workflow,/Diagnose public app source[\s\S]*continue-on-error: true[\s\S]*verify-published-app\.mjs "\$APP" "\$SOURCE_SHA" web-dev/);
  assert.match(workflow,/notify-fast-dev\.mjs/);
  assert.match(workflow,/uses: \.\/\.github\/workflows\/ops-board\.yml/);
  assert.doesNotMatch(workflow,/branches: \[main\]/);
});

test('all four app-scoped DEV workers serve only their own build directory',()=>{
  for(const app of ['rinne','village','demon','review']){
    const config=text('wrangler.dev.'+app+'.jsonc');
    assert.match(config,new RegExp('"name": "soul-lineage-'+app+'-dev"'));
    assert.match(config,new RegExp('"directory": "\\\./dist/'+app+'"'));
    assert.match(config,/"workers_dev": true/);
  }
});

test('GitHub Pages no longer publishes develop while Production verification remains blocking',()=>{
  const workflow=text('.github/workflows/deploy.yml');
  assert.match(workflow,/branches: \[main\]/);
  assert.doesNotMatch(workflow,/branches: \[develop/);
  assert.doesNotMatch(workflow,/dev\/delivery/);
  assert.match(workflow,/PAGES_DEV_RETIRED: 'true'/);
  assert.match(workflow,/uses: \.\/\.github\/workflows\/integration-rescue\.yml/);
  assert.match(workflow,/Preserve blocking Production browser verification/);
  assert.match(workflow,/verify-browser\.mjs/);

  const retire=text('.github/workflows/retire-pages-dev.yml');
  assert.match(retire,/branches: \[develop\]/);
  assert.match(retire,/RETIRE_PAGES_DEV_ONLY: 'true'/);
  assert.match(retire,/test ! -e _site\/dev/);
  assert.match(retire,/existing non-DEV bytes/);
});

test('the obsolete shared DEV publisher coalescer is removed from the repository contract',()=>{
  const deploy=text('.github/workflows/deploy.yml');
  assert.doesNotMatch(deploy,/DEV Publisher Coalescer/);
});
