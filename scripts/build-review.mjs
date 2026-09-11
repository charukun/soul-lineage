import { copyFileSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { prepareReviewAssets } from './prepare-review-assets.mjs';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
execFileSync(process.execPath,['--test','tests/review-asset-inputs.test.mjs','apps/rinne/tests/review-playback.test.mjs','packages/rendering/tests/quaternius-retarget.test.mjs'],{stdio:'inherit'});
execFileSync(process.execPath,['scripts/check.mjs','rinne'],{stdio:'inherit'});
const assets = await prepareReviewAssets();
try {
  execFileSync(npm,['run','build:rinne'],{stdio:'inherit',env:{...process.env,APP_ENV:'dev'}});
  const out = resolve('dist','rinne');
  const appIndex = resolve(out,'index.html'), review = resolve(out,'review.html'), backup = resolve(out,'game.html');
  mkdirSync(out,{recursive:true});
  copyFileSync(appIndex,backup);
  copyFileSync(review, appIndex);
  rmSync(review);
  cpSync(assets.root,resolve(out,'asset-review'),{recursive:true});
  console.log('Visual Review Lab built with verified real assets. Run test:review-browser before deployment; visual approval remains pending.');
} finally {rmSync(assets.root,{recursive:true,force:true});}
