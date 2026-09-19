import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root=process.cwd();
const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
if(!/^[a-f0-9]{40}$/.test(commit))throw new Error('PULSE build requires an exact source SHA');
const builtAt=new Date().toISOString();
writeFileSync(resolve(root,'ops-board/build-info.mjs'),`export const OPS_BUILD_SHA = '${commit}';\n`);
writeFileSync(resolve(root,'ops-board/public/version.json'),JSON.stringify({app:'pulse',name:'PULSE',environment:'dev',commit,builtAt},null,2)+'\n');
console.log(`PULSE_BUILD_READY commit=${commit}`);
