import { chromium } from '@playwright/test';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { benchmarkVerdict, performancePreset } from '../performance-presets.mjs';

function option(name, fallback = null) {
  const index=process.argv.indexOf(`--${name}`);
  return index>=0&&process.argv[index+1]&&!process.argv[index+1].startsWith('--')?process.argv[index+1]:fallback;
}

const root=resolve(new URL('../..',import.meta.url).pathname),app=process.argv[2]||'village',preset=performancePreset(option('preset','quick'));
const ports={village:5274,demon:5275};if(!ports[app])throw new Error('Performance Lab currently supports village or demon');
const port=ports[app],viteBin=resolve(root,'node_modules/vite/bin/vite.js'),output=resolve(root,'test-results/performance');mkdirSync(output,{recursive:true});
execFileSync('npm',['run','build','--workspace',`@soul/${app}`],{cwd:root,stdio:'inherit',env:{...process.env,APP_ENV:'dev',APP_BRANCH:process.env.GITHUB_HEAD_REF||'perf-lab'}});
const preview=spawn(process.execPath,[viteBin,'preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:resolve(root,'apps',app),stdio:['ignore','pipe','pipe'],env:{...process.env,APP_ENV:'dev'}});
async function waitFor(url){for(let i=0;i<80;i++){if(preview.exitCode!==null)throw new Error('preview exited');try{const r=await fetch(url,{signal:AbortSignal.timeout(1200)});if(r.ok)return;}catch{}await delay(250);}throw new Error('preview timeout');}
async function stop(){if(preview.exitCode!==null)return;preview.kill('SIGTERM');for(let i=0;i<20&&preview.exitCode===null;i++)await delay(50);if(preview.exitCode===null)preview.kill('SIGKILL');}
let browser;
try{
 const url=`http://127.0.0.1:${port}/`;await waitFor(url);browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:preset.viewport}),page=await context.newPage();await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>document.querySelector('#game')?.dataset.renderer==='ready',null,{timeout:45000});
 if(app==='demon'){await page.locator('#begin').click();await page.locator('[data-village]').first().click();await page.locator('#hud').waitFor({state:'visible',timeout:30000});}
 const globalName=app==='village'?'__VILLAGE_ADAPTIVE_QUALITY__':'__DEMON_ADAPTIVE_QUALITY__';
 await page.waitForFunction(({name,minSamples})=>window[name]?.snapshot?.().performance?.samples>=minSamples,{name:globalName,minSamples:preset.minSamples},{timeout:45000});
 const snapshot=await page.evaluate(name=>window[name].snapshot(),globalName);const verdict=benchmarkVerdict(snapshot,preset);const report={app,preset,viewport:preset.viewport,capturedAt:new Date().toISOString(),benchmark:verdict,...snapshot};
 const suffix=preset.id==='quick'?'':`.${preset.id}`;writeFileSync(resolve(output,`${app}${suffix}.json`),JSON.stringify(report,null,2));console.log('PERFORMANCE LAB CAPTURED',JSON.stringify({app,preset:preset.id,samples:report.performance.samples,frameP95:report.performance.frame.p95Ms,gpuP95:report.performance.gpu.p95Ms,drawCalls:report.performance.drawCalls.p95,transparentDrawCalls:report.performance.transparency?.drawCalls?.p95,meetsFrameTarget:verdict.meetsFrameTarget}));
 await context.close();
}finally{if(browser)await browser.close().catch(()=>{});await stop();}
