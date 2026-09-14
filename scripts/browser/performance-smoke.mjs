import { chromium } from '@playwright/test';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root=resolve(new URL('../..',import.meta.url).pathname),app=process.argv[2]||'village';
const ports={village:5274,demon:5275};if(!ports[app])throw new Error('Performance Lab currently supports village or demon');
const port=ports[app],viteBin=resolve(root,'node_modules/vite/bin/vite.js'),output=resolve(root,'test-results/performance');mkdirSync(output,{recursive:true});
execFileSync('npm',['run','build','--workspace',`@soul/${app}`],{cwd:root,stdio:'inherit',env:{...process.env,APP_ENV:'dev',APP_BRANCH:process.env.GITHUB_HEAD_REF||'perf-lab'}});
const preview=spawn(process.execPath,[viteBin,'preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:resolve(root,'apps',app),stdio:['ignore','pipe','pipe'],env:{...process.env,APP_ENV:'dev'}});
async function waitFor(url){for(let i=0;i<80;i++){if(preview.exitCode!==null)throw new Error('preview exited');try{const r=await fetch(url,{signal:AbortSignal.timeout(1200)});if(r.ok)return;}catch{}await delay(250);}throw new Error('preview timeout');}
async function stop(){if(preview.exitCode!==null)return;preview.kill('SIGTERM');for(let i=0;i<20&&preview.exitCode===null;i++)await delay(50);if(preview.exitCode===null)preview.kill('SIGKILL');}
let browser;
try {
  const url=`http://127.0.0.1:${port}/`;await waitFor(url);browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>document.querySelector('#game')?.dataset.renderer==='ready',null,{timeout:45000});
  if(app==='demon'){await page.locator('#begin').click();await page.locator('[data-village]').first().click();await page.locator('#hud').waitFor({state:'visible',timeout:30000});}
  const globalName=app==='village'?'__VILLAGE_ADAPTIVE_QUALITY__':'__DEMON_ADAPTIVE_QUALITY__',scaleName=app==='village'?'__VILLAGE_WORLD_SCALE__':'__DEMON_WORLD_SCALE__';
  await page.waitForFunction(name=>window[name]?.snapshot?.().performance?.samples>=90,globalName,{timeout:30000});
  await page.waitForFunction(name=>Boolean(window[name]?.snapshot),scaleName,{timeout:10000}).catch(()=>{});
  const snapshot=await page.evaluate(name=>window[name].snapshot(),globalName);
  const scale=await page.evaluate(async name=>{const api=window[name];return api?.replay?await api.replay():null;},scaleName);
  const report={app,viewport:{width:390,height:844},capturedAt:new Date().toISOString(),...snapshot,worldScale:await page.evaluate(name=>window[name]?.snapshot?.()||null,scaleName)};
  writeFileSync(resolve(output,`${app}.json`),JSON.stringify(report,null,2));if(scale)writeFileSync(resolve(output,`${app}-world-scale.json`),JSON.stringify(scale,null,2));
  console.log('PERFORMANCE LAB CAPTURED',JSON.stringify({app,samples:report.performance.samples,frameP95:report.performance.frame.p95Ms,gpuP95:report.performance.gpu.p95Ms,drawCalls:report.performance.drawCalls.p95,scaleAverageMs:scale?.averageMs??null}));
  await context.close();
} finally { if(browser)await browser.close().catch(()=>{});await stop(); }
