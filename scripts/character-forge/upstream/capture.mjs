import {chromium} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,relative,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {startArtifactHost} from './server.mjs';
const digest=b=>createHash('sha256').update(b).digest('hex');
export async function captureFactory({workspace,factory,output,executablePath=process.env.CHROMIUM_PATH,views=['front','side','back','right','left','three-quarter','rear-three-quarter'],mode='clay'}){
 workspace=resolve(workspace);const target=resolve(workspace,output);if(!target.startsWith(workspace+sep))throw new Error('Capture output leaves session');await mkdir(target,{recursive:true});
 const host=await startArtifactHost({workspace,factory});let browser;const errors=[];
 try{
  browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:1000,height:1200}});await context.tracing.start({screenshots:true,snapshots:true});const page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto(host.url,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.forgeReady,null,{timeout:120000});await page.evaluate(m=>window.forge.setMode(m),mode);
  const frames=[];
  for(const view of views){const camera=await page.evaluate(v=>window.forge.setView(v),view);const path=resolve(target,view+'.png');const png=await page.locator('canvas').screenshot({path});frames.push({view,path:relative(workspace,path),sha256:digest(png),camera});}
  const geometry=await page.evaluate(()=>window.forge.geometry()),metrics=await page.evaluate(()=>window.forge.metrics());
  await writeFile(resolve(target,'geometry.json'),JSON.stringify({meshes:geometry}));
  const receipt={schemaVersion:'rinne.img2threejs-capture/v1',factory,factorySha256:digest(await readFile(resolve(workspace,factory))),mode,frames,metrics,errors,realDevice:false};
  await writeFile(resolve(target,'capture.json'),JSON.stringify(receipt,null,2));await context.tracing.stop({path:resolve(target,'trace.zip')});
  if(errors.length)throw new Error('Browser rendering errors: '+errors.join('; '));return receipt;
 }catch(error){await writeFile(resolve(target,'capture-failure.json'),JSON.stringify({status:'failed',factory,errors,message:String(error.stack)},null,2));throw error;}finally{await browser?.close();await host.close();}
}
if(process.argv[1]&&import.meta.url===(await import('node:url')).pathToFileURL(resolve(process.argv[1])).href){
 const [workspace,factory,output,mode]=process.argv.slice(2);if(!workspace||!factory||!output)throw new Error('Usage: capture.mjs <session> <factory> <output> [mode]');
 console.log(JSON.stringify(await captureFactory({workspace,factory,output,mode:mode||'clay'}),null,2));
}
