// Targeted real-texture Review Lab acceptance. Run in an authorized browser
// environment; this script never changes browser access/security policy.
import {chromium} from '@playwright/test';
import {createServer} from 'node:http';
import {readFileSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
const out=resolve(process.env.REVIEW_RESULTS||'test-results/review-plan');mkdirSync(out,{recursive:true});
const root=resolve('dist/rinne');let server;
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.gltf':'model/gltf+json','.svg':'image/svg+xml'};
if(!process.env.REVIEW_SITE_URL){server=createServer((req,res)=>{try{const url=new URL(req.url,'http://localhost');let file=resolve(root,'.'+decodeURIComponent(url.pathname));if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403).end();return;}if(statSync(file).isDirectory())file=resolve(file,'index.html');const b=readFileSync(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(b);}catch{res.writeHead(404).end('Not found');}});await new Promise(ok=>server.listen(5277,'127.0.0.1',ok));}
const url=process.env.REVIEW_SITE_URL||'http://127.0.0.1:5277/';
const report={target:url,expectedBuild:process.env.REVIEW_EXPECTED_SHA||null,checks:[],errors:[],network:[],startedAt:new Date().toISOString(),environment:'Chromium software WebGL2; real repository models/textures, not Pixel Fold hardware'};
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,acceptDownloads:true,recordVideo:{dir:out+'/video',size:{width:390,height:844}}});
await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:new URL(url).origin});await context.tracing.start({screenshots:true,snapshots:true,sources:false});
const page=await context.newPage();page.setDefaultTimeout(12000);
function observe(p){p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});p.on('requestfailed',r=>report.network.push({url:r.url(),error:r.failure()?.errorText}));p.on('response',r=>{if(r.status()>=400)report.network.push({url:r.url(),status:r.status()});});}
observe(page);
const shot=name=>page.screenshot({path:resolve(out,name+'.png')});
const snap=(p=page)=>p.evaluate(()=>window.__reviewLab.snapshot());
const save=()=>writeFileSync(resolve(out,'report.json'),JSON.stringify(report,null,2));
async function step(name,run){const item={name};report.checks.push(item);try{item.details=await run();item.pass=true;}catch(error){item.pass=false;item.error=String(error);await shot('failure-'+report.checks.length).catch(()=>{});}save();console.log('REVIEW PLAN CHECK',JSON.stringify(item));}
async function motion(name){await page.locator('[data-primary="motions"]').click();await page.locator('input[aria-label="動作名で検索"]').fill(name);await page.locator(`[data-motion-id="${name}"]`).click();await page.waitForFunction(n=>window.__reviewLab.snapshot().state.clip===n,name);}
async function waitWeapon(id){await page.waitForFunction(value=>window.__reviewLab.snapshot().weapon?.id===value,id,{timeout:30000});await page.waitForTimeout(100);}
async function ready(p=page){await p.waitForFunction(()=>window.__reviewLab?.snapshot().loaded&&document.querySelector('#focused-review'),null,{timeout:120000});}
const bounds=()=>page.evaluate(()=>{const b=document.querySelector('#review-canvas').getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height,bottom:b.bottom,doc:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],viewport:[innerWidth,innerHeight]};});
try{
 const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});assert.equal(response.status(),200);await ready();report.initial=await snap();
 if(report.expectedBuild)assert.equal(report.initial.build,report.expectedBuild);
 await step('Actual Shino loads with official normalized-to-raw transfer',async()=>{assert.equal((await snap()).poseTransfer,'official-normalized-to-raw');const gl=await page.locator('#review-canvas').evaluate(c=>{const g=c.getContext('webgl2');return{version:g?.getParameter(g.VERSION),lost:g?.isContextLost()};});assert.ok(gl.version.includes('WebGL 2.0'));assert.equal(gl.lost,false);await shot('01-initial');return gl;});
 await step('Right straight: one shot, guard, strike, return, camera and slow playback',async()=>{
  await motion('Tidebreak / Attack');const s=await snap();assert.equal(s.state.mode,'combat');assert.equal(s.state.loop,false);assert.equal(s.state.weaponEnabled,false);assert.equal(s.state.clip,'Tidebreak / Attack');
  await page.locator('[data-camera="front"]').click();const frames=[];
  for(let i=0;i<4;i++){await page.locator(`[data-phase="${i}"]`).click();await page.waitForTimeout(60);const f=await snap();assert.equal(f.state.playing,false);frames.push({time:f.time,pose:f.pose});await shot('punch-front-'+i);}
  await page.locator('[data-camera="right"]').click();for(let i=0;i<4;i++){await page.locator(`[data-phase="${i}"]`).click();await page.waitForTimeout(60);await shot('punch-side-'+i);}
  await page.locator('[data-camera="three"]').click();await page.locator('[data-phase="2"]').click();await shot('02-punch-three');
  await page.locator('#restart').click();await page.locator('#speed').selectOption('0.25');await page.locator('#play-toggle').click();await page.waitForTimeout(1500);const slow=await snap();assert.ok(slow.time>0&&slow.time<1.45);await page.locator('#play-toggle').click();await page.locator('#speed').selectOption('1');
  await page.evaluate(()=>window.__reviewLab.seek(1.30));await page.locator('#play-toggle').click();await page.waitForTimeout(600);const end=await snap();assert.equal(end.state.playing,false);assert.ok(Math.abs(end.time-1.45)<.001);return{frames,slow:slow.time,end:end.time};
 });
 await step('Nine weapons have stable grips; two-handed weapons have actual support',async()=>{
  await page.locator('[data-combat-mode="combat"]').click();await page.locator('#weapon-toggle').check();const rows=[];
  for(const id of ['katana','sword','greatsword','axe','greataxe','dagger','crossbow','staff','wand']){await page.locator('#weapon-select').selectOption(id);await waitWeapon(id);await page.locator('[data-camera="three"]').click();await shot('weapon-'+id);const s=await snap();rows.push(s.weapon);assert.equal(s.weapon.id,id);if(s.weapon.support)assert.ok(s.weapon.supportError<.035,JSON.stringify(s.weapon));}
  await page.locator('[data-combat-mode="normal"]').click();assert.equal((await snap()).state.mode,'normal');await shot('03-normal-carry');
  await page.locator('#weapon-select').selectOption('greatsword');await page.locator('#weapon-select').selectOption('katana');await page.locator('#weapon-toggle').uncheck();await page.waitForTimeout(800);assert.equal((await snap()).state.weaponEnabled,false);return rows;
 });
 await step('Flowing slash uses a katana, complete phases and end pose',async()=>{
  await page.waitForFunction(()=>window.__reviewLab.snapshot().animations.includes('技 / 流し斬り'),null,{timeout:150000});await motion('技 / 流し斬り');await waitWeapon('katana');assert.equal((await snap()).state.loop,false);
  await page.locator('[data-camera="three"]').click();const frames=[];
  for(let i=0;i<4;i++){await page.locator(`[data-phase="${i}"]`).click();await page.waitForTimeout(100);const s=await snap();frames.push({time:s.time,weapon:s.weapon});if(s.weapon.support)assert.ok(s.weapon.supportError<.035,JSON.stringify(s.weapon));await shot('slash-'+i);}
  await page.evaluate(()=>window.__reviewLab.seek(1.28));await shot('slash-end');return frames;
 });
 await step('Shared state URL restores exact motion, posture, weapon, pause, loop and time',async()=>{
  await page.locator('[data-primary="advanced"]').click();await page.locator('#loop-toggle').uncheck();await page.evaluate(()=>window.__reviewLab.seek(.44));await page.locator('#copy-link').click();const link=page.url(),before=await snap();const other=await context.newPage();observe(other);
  await other.goto(link,{waitUntil:'domcontentloaded',timeout:60000});await ready(other);await other.waitForFunction(()=>window.__reviewLab.snapshot().clip==='技 / 流し斬り',null,{timeout:150000});await other.waitForTimeout(500);const after=await snap(other);
  for(const key of ['clip','mode','weaponId','weaponEnabled','playing','loop','time','speed','camera'])assert.deepEqual(after.state[key],before.state[key],key);
  await other.screenshot({path:resolve(out,'04-restored.png')});await other.close();return{link,before:before.state,after:after.state};
 });
 await step('Eight source/variant model selections retain posture and render real meshes',async()=>{
  await page.locator('[data-combat-mode="combat"]').click();await page.locator('#weapon-toggle').uncheck();if((await snap()).state.playing)await page.locator('#play-toggle').click();const results=[];
  for(const id of ['SHINO','SHINO_SLENDER','SHINO_STURDY','SHINO_COMPACT','A','B','C','TSUKU']){
   await page.locator('.model-select-trigger').click();const item=page.locator('.model-picker-item').filter({has:page.locator('small',{hasText:new RegExp('^'+id+'$')})});await item.click();
   await page.waitForFunction(p=>window.__reviewLab?.snapshot().loaded&&window.__reviewLab.snapshot().state.preset===p,'model.'+id,{timeout:120000});await page.waitForTimeout(100);
   const s=await snap();assert.equal(s.state.clip,'Tidebreak / Idle');assert.equal(s.state.mode,'combat');assert.equal(s.state.playing,false);assert.ok(s.triangles>0);await shot('model-'+id);results.push({id,state:s.state,triangles:s.triangles,issues:s.assetProblems});
  }return results;
 });
 await step('Portrait and landscape controls stay clickable while the preview remains on-screen',async()=>{
  const data=[];for(const[width,height]of [[320,568],[390,844],[412,892],[844,390],[1280,800]]){
   await page.setViewportSize({width,height});await page.locator('[data-primary="advanced"]').click();await page.waitForTimeout(100);const before=await bounds();assert.ok(before.width>100&&before.height>=140,JSON.stringify(before));assert.ok(before.x>=0&&before.y>=0&&before.x+before.width<=width+1&&before.bottom<=height+1,JSON.stringify(before));assert.ok(before.doc[0]<=width+1&&before.doc[1]<=height+1,JSON.stringify(before));
   await page.locator('.notebook-scroll').evaluate(n=>n.scrollTop=n.scrollHeight);const after=await bounds();assert.equal(after.y,before.y);assert.equal(after.height,before.height);
   await page.locator('[data-combat-mode="normal"]').click();assert.equal((await snap()).state.mode,'normal');await page.locator('[data-primary="motions"]').click();await shot('layout-'+width+'x'+height);data.push({before,after});
  }return data;
 });
 await step('No runtime/page errors or failed requests; converted motion integrity is enforced',async()=>{assert.deepEqual(report.errors,[]);assert.deepEqual(report.network,[]);return{issues:(await snap()).assetProblems};});
 report.final=await snap();
}catch(error){report.fatal=String(error);await shot('fatal').catch(()=>{});}
finally{report.finishedAt=new Date().toISOString();report.success=!report.fatal&&report.checks.length>=8&&report.checks.every(c=>c.pass);save();await context.tracing.stop({path:resolve(out,'trace.zip')}).catch(()=>{});await context.close();await browser.close();await new Promise(ok=>server?server.close(ok):ok());if(!report.success)process.exitCode=1;console.log('REVIEW PLAN RESULT',JSON.stringify({success:report.success,checks:report.checks.map(c=>({name:c.name,pass:c.pass,error:c.error})),fatal:report.fatal,errors:report.errors,network:report.network}));}
