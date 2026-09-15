/** Browser preparation for internal Lab review; never changes sandbox policy. */
import {existsSync} from 'node:fs';
import {mkdir,readFile,writeFile,chmod} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {brotliDecompressSync} from 'node:zlib';
import {chromium} from '@playwright/test';

const cache=resolve('node_modules/.cache/rinne-review-browser');
const executable=join(cache,'chromium');
if(existsSync(chromium.executablePath())||existsSync(executable)){
  console.log('Local review browser is already available. Run npm run review:local.');
}else{
  await mkdir(cache,{recursive:true});
  let installed=false;
  if(!process.argv.includes('--bundled')){
    try{
      execFileSync(process.execPath,['node_modules/playwright/cli.js','install','chromium'],{stdio:'inherit',timeout:95000});
      installed=existsSync(chromium.executablePath());
    }catch{console.log('Standard browser preparation failed; trying the npm-distributed Linux Chromium bundle.');}
  }
  if(!installed){
    if(process.platform!=='linux'||process.arch!=='x64')throw Error('Bundled fallback supports Linux x64; install the compatible Playwright browser on this platform.');
    // Pinned browser bundle, no runtime dependency or binary committed to Git.
    const packages=join(cache,'packages');
    execFileSync('npm',['install','--prefix',packages,'--no-save','--no-package-lock','@sparticuz/chromium@153.0.0'],{stdio:'inherit',timeout:120000});
    const bin=join(packages,'node_modules/@sparticuz/chromium/bin');
    for(const name of ['chromium','swiftshader.tar'])await writeFile(join(cache,name),brotliDecompressSync(await readFile(join(bin,name+'.br'))));
    // Preserve file data, not archive ownership, in restricted containers.
    execFileSync('tar',['--no-same-owner','-xf',join(cache,'swiftshader.tar'),'-C',cache]);
    await chmod(executable,0o755);
    console.log('Prepared npm Chromium/SwiftShader. Run npm run review:local.');
  }
}
