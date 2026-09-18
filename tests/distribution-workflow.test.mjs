import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('per-app DEV workflow isolates concurrency and verifies exact public source',()=>{
  const workflow=text('.github/workflows/dev-app-publish.yml');
  assert.match(workflow,/push:\n\s+branches: \[develop\]/);
  assert.match(workflow,/group: per-app-dev-\$\{\{ matrix\.app \}\}/);
  assert.match(workflow,/cancel-in-progress: true/);
  assert.match(workflow,/distribution:build -- --app "\$APP" --target web-dev/);
  assert.match(workflow,/wrangler@4 deploy --config "wrangler\.dev\.\$APP\.jsonc"/);
  assert.match(workflow,/verify-published-app\.mjs "\$APP" "\$SOURCE_SHA" web-dev/);
  assert.match(workflow,/notify-fast-dev\.mjs/);
  assert.doesNotMatch(workflow,/branches: \[main\]/);
});

test('per-app DEV workers serve only their own build directory',()=>{
  for(const app of ['rinne','village','demon']){
    const config=text(`wrangler.dev.${app}.jsonc`);
    assert.match(config,new RegExp(`"name": "soul-lineage-${app}-dev"`));
    assert.match(config,new RegExp(`"directory": "\\./dist/${app}"`));
    assert.match(config,/"workers_dev": true/);
  }
});

test('legacy Pages remains compatibility publication while artifacts are retained',()=>{
  const workflow=text('.github/workflows/deploy.yml');
  assert.match(workflow,/actions\/deploy-pages@v4/);
  assert.match(workflow,/distribution-artifacts-\$\{\{ github\.sha \}\}/);
  const deploy=text('scripts/deploy.mjs');
  assert.match(deploy,/materializeStaticArtifact/);
  assert.match(deploy,/installStaticArtifact/);
  assert.match(deploy,/webTargetForEnvironment/);
});
