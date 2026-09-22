// Explicit manual observation lane; not an automatic CI gate.
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';
import {chromium} from 'playwright';
const root=process.cwd(),generate=process.argv.includes('--generate'),mode=generate?'generate':'observe';
const output=path.join(root,'.deploy-state/kaykit-library',mode);await fs.mkdir(output,{recursive:true});
const git=args=>execFileSync('git',args,{encoding:'utf8'}).trim(),head=git(['rev-parse','HEAD']);
if(git(['status','--porcelain','--untracked-files=no']))throw new Error('Observation requires a committed candidate');
const catalogPath=path.join(root,'packages/characters/generated/kaykit-current.json'),catalog=JSON.parse(await fs.readFile(catalogPath));
const lib=path.join(root,'apps/review/public/library'),origin='https://soul-lineage-review-dev.c-okamoto.workers.dev/library/';
const manifestPath=path.join(lib,'manifest.json'),manifest=JSON.parse(await fs.readFile(manifestPath));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const blob=b=>crypto.createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');
const assert=(value,message)=>{if(!value)throw new Error(message);};
const receipt={schema:1,head,mode,status:'running',transport:'Project Asset Origin URLs served from exact-head local materialized bytes; not a live DEV publication claim',models:[],ui:[],errors:[],requests:[]};
let vite,browser,context,page;const servers=[];let viteOutput='';
const mime=file=>({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.wasm':'application/wasm','.woff2':'font/woff2','.txt':'text/plain'}[path.extname(file)]||'application/octet-stream');
async function serve(app,port){
 const dir=path.join(root,'dist',app);const server=http.createServer(async(req,res)=>{try{
  let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname==='/')pathname='/index.html';if(pathname==='/review-motion')pathname='/review/motion/index.html';
  const file=path.resolve(dir,'.'+pathname);if(!file.startsWith(dir+path.sep))throw Error('unsafe path');
  const body=await fs.readFile(file);res.writeHead(200,{'content-type':mime(file)});res.end(body);
 }catch{res.writeHead(404);res.end('not found');}});await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));servers.push(server);return 'http://127.0.0.1:'+port;
}
async function sheet(items,name,title){
 const p=await context.newPage();await p.setContent('<!doctype html><meta charset="utf-8"><style>body{background:#101715;color:#eee;margin:16px;font:14px sans-serif}main{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}figure{margin:0}img{width:100%;display:block}figcaption{overflow-wrap:anywhere}h1{font-size:18px}</style><h1></h1><main></main>');
 await p.evaluate(({items,title})=>{document.querySelector('h1').textContent=title;for(const item of items){const f=document.createElement('figure'),img=new Image(),cap=document.createElement('figcaption');img.src=item.image;cap.textContent=item.label;f.append(img,cap);document.querySelector('main').append(f);}},{items,title});
 await p.evaluate(()=>Promise.all([...document.images].map(x=>x.decode())));await p.screenshot({path:path.join(output,name),fullPage:true});await p.close();
}
try{
 execFileSync('npm',['run','predev','--workspace','@soul/rinne'],{env:{...process.env,APP_ENV:'dev'},stdio:'inherit'});
 assert(!git(['status','--porcelain','--untracked-files=no']),'Preparation changed source');
 vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--config','apps/rinne/vite.config.js','--host','127.0.0.1','--port','5173','--strictPort'],{env:{...process.env,APP_ENV:'dev'},stdio:['ignore','pipe','pipe']});
 vite.stdout.on('data',x=>viteOutput+=x);vite.stderr.on('data',x=>viteOutput+=x);
 for(let i=0;i<120;i++){try{if((await fetch('http://127.0.0.1:5173')).ok)break;}catch{}if(i===119)throw Error('Vite did not start: '+viteOutput);await new Promise(r=>setTimeout(r,250));}
 browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
 context=await browser.newContext({viewport:{width:1280,height:960},deviceScaleFactor:1});
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.href.startsWith(origin)){
   const rel=decodeURIComponent(url.pathname.slice(new URL(origin).pathname.length)),file=path.resolve(lib,rel);
   try{assert(file.startsWith(lib+path.sep),'unsafe origin path');const body=await fs.readFile(file);receipt.requests.push({path:rel,bytes:body.length});await route.fulfill({status:200,body,headers:{'content-type':mime(file),'access-control-allow-origin':'*','content-length':String(body.length)}});}catch{receipt.errors.push('Missing origin file: '+rel);await route.fulfill({status:404,body:'not materialized'});}return;
  }
  if(['raw.githubusercontent.com','cdn.jsdelivr.net','codeberg.org'].includes(url.hostname)){receipt.errors.push('Third-party runtime request: '+url.href);await route.abort();return;}
  if(url.pathname==='/__kaykit-probe'){await route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><script type="module" src="/@fs/'+root+'/scripts/browser/kaykit-library-probe.js"></script>'});return;}
  await route.continue();
 });
 page=await context.newPage();page.on('pageerror',e=>receipt.errors.push(e.stack||e.message));page.on('response',r=>{if(r.status()>=400)receipt.errors.push(`HTTP ${r.status()} ${r.url()}`);});page.on('console',m=>{if(m.type()==='error')receipt.errors.push(m.text());});
 await page.goto('http://127.0.0.1:5173/__kaykit-probe');await page.waitForFunction(()=>!!window.kaykitLibraryProbe,null,{timeout:60000});
 const contact=[],poses=[];
 for(const model of catalog.models){
  const row=await page.evaluate(id=>window.kaykitLibraryProbe.verify(id),model.id);
  contact.push({label:model.label,image:row.thumbnail});poses.push(...row.poses);
  if(generate){
   const bytes=Buffer.from(row.thumbnail.split(',')[1],'base64'),rel='thumbnail/kaykit-current-20260922/'+model.id+'/'+blob(bytes)+'.webp';
   const file=path.join(lib,rel);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,bytes);
   model.thumbnailPath=rel;model.compatibility={...model.compatibility,status:'review-verified',evidenceHead:head,clips:row.clips};
   const entry={path:rel,bytes:bytes.length,sha256:hash(bytes),gitBlobSha:blob(bytes)};
   if(!manifest.files.some(x=>x.path===rel))manifest.files.push(entry);
  }
  delete row.thumbnail;delete row.poses;receipt.models.push(row);console.log('Verified '+model.name+' / '+row.clips.length+' clips');
 }
 await sheet(contact,'current-characters.png','KayKit current original characters — '+head);
 await sheet(poses,'motion-compatibility.png','Existing KayKit motion / current character deformation — '+head);
 await page.evaluate(()=>window.kaykitLibraryProbe.close());
 if(generate){
  await fs.writeFile(catalogPath,JSON.stringify(catalog,null,2)+'\n');manifest.files.sort((a,b)=>a.path.localeCompare(b.path));
  await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
 }else{
  const rinne=await serve('rinne',4183),studio=await serve('character-studio',4184);
  for(const [app,url] of [['rinne',rinne],['character-studio',studio]]){const version=await (await fetch(url+'/version.json')).json();assert(version.commit===head,'Built '+app+' commit mismatch');}
  let start=receipt.requests.length;
  await page.goto(rinne+'/review-motion');await page.waitForFunction(()=>document.querySelector('#motion-stage')?.dataset.motionModel,null,{timeout:60000});
  assert(!receipt.requests.slice(start).some(r=>catalog.models.some(m=>r.path===m.runtime.assetPath)),'Unselected character payloads eagerly loaded');
  assert(await page.locator('#motion-model-grid [data-motion-model]').count()===16,'Motion model enumeration mismatch');
  await page.locator('.motion-models summary').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('#motion-model-grid img')].every(x=>x.complete&&x.naturalWidth>0));
  for(const model of catalog.models){
   const button=page.locator('[data-motion-model="'+model.id+'"]');await button.click();
   await page.waitForFunction(id=>{const stage=document.querySelector('#motion-stage');return stage?.dataset.motionModel===id&&stage.dataset.motionCompatibility==='PLAYABLE';},model.id,{timeout:60000});
   receipt.ui.push({route:'/review-motion',model:model.id,status:'passed'});
  }
  await page.locator('[data-motion-model="kaykit.ranger.v2"]').click();
  await page.waitForFunction(()=>document.querySelector('#motion-stage')?.dataset.motionModel==='kaykit.ranger.v2'&&document.querySelector('#motion-stage')?.dataset.motionCompatibility==='PLAYABLE');
  for(const name of ['Idle_A','Walking_A','Running_A','Melee_1H_Attack_Chop','Hit_A','Death_A']){
   const match=page.locator('#motion-grid button[data-motion-identity$=":'+name+'"]');await match.first().scrollIntoViewIfNeeded();await match.first().click();
   await page.waitForFunction(name=>{const x=document.querySelector('#motion-stage');return x?.dataset.motionUpstreamName===name&&x.dataset.motionCompatibility==='PLAYABLE';},name,{timeout:30000});
  }
  await page.locator('#motion-stage').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'motion-review-desktop.png')});
  await page.setViewportSize({width:390,height:844});await page.locator('#motion-model-grid').scrollIntoViewIfNeeded();
  const columns=await page.locator('#motion-model-grid').evaluate(x=>getComputedStyle(x).gridTemplateColumns.split(/\s+/).length);assert(columns===5,'Motion mobile grid is not five columns');
  await page.screenshot({path:path.join(output,'motion-review-mobile.png')});await page.setViewportSize({width:1280,height:960});
  start=receipt.requests.length;await page.goto(studio+'/');
  await page.waitForFunction(()=>window.characterStudio?.review?.ready&&window.characterStudio.review.displayModelId&&window.characterStudio.review.audit?.modelId===window.characterStudio.review.displayModelId&&document.querySelectorAll('.character-model-card').length>=17,null,{timeout:60000});
  assert(!receipt.requests.slice(start).some(r=>catalog.models.some(m=>r.path===m.runtime.assetPath)),'Studio eagerly loads current models');
  for(const model of catalog.models){
   const button=page.locator('.character-model-card[data-model-key="'+model.id+'"]');await button.click();
   await page.waitForFunction(id=>window.characterStudio?.review?.ready&&window.characterStudio.review.displayModelId===id&&window.characterStudio.review.audit?.modelId===id,model.id,{timeout:60000});
   const audit=await page.evaluate(()=>({audit:window.characterStudio.review.audit,errors:window.characterStudio.review.errors}));assert(audit.errors.length===0,'Studio model errors');
   receipt.ui.push({route:'character-studio /',model:model.id,status:'passed'});
  }
  for(const id of ['kaykit.mage.v2','kaykit.rogue.v2']){
   await page.locator('.character-model-card[data-model-key="'+id+'"]').click();await page.waitForFunction(id=>window.characterStudio?.review?.ready&&window.characterStudio.review.audit?.modelId===id,id);
   for(const preset of ['front','side','back','face']){
    await page.locator('.character-review-camera-dock [data-camera="'+preset+'"]').click();await page.locator('#stage').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(output,id+'-'+preset+'.png')});
   }
  }
  await page.setViewportSize({width:390,height:844});await page.locator('.character-model-grid').scrollIntoViewIfNeeded();
  const mobile=await page.locator('.character-model-grid').evaluate(x=>({columns:getComputedStyle(x).gridTemplateColumns.split(/\s+/).length,width:x.clientWidth,scrollWidth:x.scrollWidth}));assert(mobile.columns===5&&mobile.scrollWidth<=mobile.width+1,'Studio mobile grid overflow');
  await page.screenshot({path:path.join(output,'studio-mobile.png')});receipt.ui.push({route:'character-studio /',mobile,status:'passed'});
 }
 assert(receipt.errors.length===0,receipt.errors.join('\n'));receipt.status='passed';
}catch(error){receipt.status='failed';receipt.errors.push(error.stack||String(error));process.exitCode=1;try{await page?.screenshot({path:path.join(output,'failure.png')});}catch{}}
finally{
 receipt.finishedAt=new Date().toISOString();await fs.writeFile(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');await fs.writeFile(path.join(output,'vite.log'),viteOutput);
 console.log(JSON.stringify({head,status:receipt.status,models:receipt.models.length,ui:receipt.ui.length,errors:receipt.errors.slice(0,5)}));
 await context?.close();await browser?.close();vite?.kill('SIGTERM');for(const server of servers)server.close();
}
