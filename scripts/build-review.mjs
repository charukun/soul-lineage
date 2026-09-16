import {copyFileSync, rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';

const npm=process.platform==='win32'?'npm.cmd':'npm';
execFileSync(npm,['run','build:rinne'],{stdio:'inherit',env:{...process.env,APP_ENV:'dev'}});

const out=resolve('dist','rinne');
const appIndex=resolve(out,'index.html');
const reviewIndex=resolve(out,'review.html');
const gameBackup=resolve(out,'game.html');
copyFileSync(appIndex,gameBackup);
copyFileSync(reviewIndex,appIndex);
rmSync(reviewIndex);
console.log('Develop-backed Visual Review bundle ready.');
