import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const text=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Workers DEV is the only automatic develop publication path and includes both independent developer tools',()=>{
  const workflow=text('.github/workflows/dev-app-publish.yml');
  assert.match(workflow,/push:\n\s+branches: \[develop\]/);
  assert.match(workflow,/options: \[rinne, village, demon, review, character-studio\]/);
  assert.match(workflow,/group: per-app-dev-\$\{\{ matrix\.app \}\}/);
  assert.match(workflow,/cancel-in-progress: true/);
  assert.match(workflow,/distribution:build -- --app "\$APP" --target web-dev/);
  assert.match(workflow,/wrangler@4 deploy --config "wrangler\.dev\.\$APP\.jsonc"/);
  assert.doesNotMatch(workflow,/Focused app validation diagnostic/);
  assert.match(workflow,/npm ci --ignore-scripts --no-audit --no-fund/);
  assert.match(workflow,/Diagnose public app source[\s\S]*continue-on-error: true[\s\S]*verify-published-app\.mjs "\$APP" "\$SOURCE_SHA" web-dev/);
  assert.match(workflow,/notify-fast-dev\.mjs/);
  assert.doesNotMatch(workflow,/ops-board\.yml|PULSE/);
  assert.doesNotMatch(workflow,/branches: \[main\]/);
});

test('all five app-scoped DEV workers serve only their own build directory',()=>{
  for(const app of ['rinne','village','demon','review','character-studio']){
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
  assert.doesNotMatch(workflow,/integration-rescue|rescue_mode/);
  assert.match(workflow,/Preserve blocking Production browser verification/);
  assert.match(workflow,/verify-browser\.mjs/);

});

test('GitHub Actions surface is limited to Fast DEV, Production and explicit distribution',()=>{
  const workflows=readdirSync('.github/workflows').filter(name=>/\.ya?ml$/.test(name)).sort();
  assert.deepEqual(workflows,[
    'astra-work-validation.yml',
    'ci.yml',
    'deploy.yml',
    'dev-app-publish.yml',
    'distribution-artifact.yml',
  ]);
  const deploy=text('.github/workflows/deploy.yml');
  assert.doesNotMatch(deploy,/DEV Publisher Coalescer|integration-rescue/);
});
