import {copyFileSync, cpSync, rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {prepareReviewAssets} from './prepare-review-assets.mjs';

const npm=process.platform==='win32'?'npm.cmd':'npm';
execFileSync(npm,['run','build:rinne'],{stdio:'inherit',env:{...process.env,APP_ENV:'dev'}});

const prepared=await prepareReviewAssets();
try {
  const out=resolve('dist','rinne');
  const appIndex=resolve(out,'index.html');
  const reviewIndex=resolve(out,'review.html');
  const gameBackup=resolve(out,'game.html');
  const reviewAssets=resolve(out,'asset-review');
  rmSync(reviewAssets,{recursive:true,force:true});
  cpSync(prepared.root,reviewAssets,{recursive:true});
  copyFileSync(appIndex,gameBackup);
  copyFileSync(reviewIndex,appIndex);
  rmSync(reviewIndex);
  console.log(`Develop-backed Visual Review bundle ready with ${prepared.manifest.models.length} review models and ${prepared.manifest.equipment.length} review equipment options.`);
} finally {
  rmSync(prepared.root,{recursive:true,force:true});
}
