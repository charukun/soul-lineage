#!/usr/bin/env node
// Explicit specialist execution; never part of routine Fast DEV or app startup.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {chromium,expect} from '@playwright/test';
const root=fileURLToPath(new URL('../../',import.meta.url));process.chdir(root);
const generate=process.argv.includes('--generate');
const library=path.join(root,'apps/review/public/library');
const ledgerPath=path.join(library,'provenance/quaternius-characters-20260922.json');
const generatedPath=path.join(root,'packages/assets/generated/quaternius-characters.json');
const manifestPath=path.join(library,'manifest.json');
const ledger=JSON.parse(await fs.readFile(ledgerPath,'utf8'));
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
const origin=new URL(manifest.origin);
const evidenceAssetOrigin=generate?null:new URL(process.env.CHARACTER_ASSET_ORIGIN_URL||'');
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const assert=(value,message)=>{if(!value)throw new Error(message);};
assert(/^[a-f0-9]{40}$/.test(head),'Exact checkout required');
if(!generate){
  assert(/^https:\/\/soul-lineage-review-evidence-[0-9]+\.c-okamoto\.workers\.dev\/?$/.test(evidenceAssetOrigin.href),'Run-scoped self-owned Asset Origin is required');
  const assetVersionResponse=await fetch(new URL('version.json',evidenceAssetOrigin),{redirect:'error'});
  assert(assetVersionResponse.ok,'Evidence Asset Origin version.json unavailable');
  const assetVersion=await assetVersionResponse.json();
  assert(assetVersion.commit===head,'Evidence Asset Origin source mismatch');
}
assert(!execFileSync('git',['diff','--name-only','HEAD'],{encoding:'utf8'}).trim(),'Source must be committed before rendering');
const output=path.join(root,'.deploy-state/quaternius-character-evidence');await fs.mkdir(output,{recursive:true});
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const blob=data=>crypto.createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');
const local='http://127.0.0.1:5173';
const target=generate?local:process.env.CHARACTER_REVIEW_URL;
if(!generate)assert(/^https:\/\/[0-9a-f]{8}-soul-lineage-rinne-dev\.c-okamoto\.workers\.dev\/?$/.test(target||''),'An immutable RINNE Worker version preview is required, never latest DEV');
const receipt={schema:1,head,status:'running',mode:generate?'thumbnail-generation':'immutable-browser-validation',target,assetOrigin:generate?origin.href:evidenceAssetOrigin.href,
  transport:generate?'Exact-head local materialized files served at project-origin URLs for prepublication generation; NOT live-origin verification':'Runtime canonical Asset Origin request names are bridged to a run-scoped self-owned Cloudflare evidence Worker built from the same exact head; payload/status/headers are real Cloudflare responses and model SHA-256 is verified',
  assets:[],ui:[],comparisons:[],requests:[],errors:[],warnings:[],mobile:null,realDevice:false};
let vite,viteLog='',browser,context,page,tracing=false;
const addedFiles=[];
async function ready(url){for(let i=0;i<120;i++){if(vite.exitCode!==null)throw new Error('Vite exited: '+viteLog);try{if((await fetch(url)).ok)return;}catch{}await new Promise(resolve=>setTimeout(resolve,250));}throw new Error('Exact-head Vite did not start: '+viteLog);}
async function openControls(){
  const toggle=page.getByRole('button',{name:'表示・再生コントロール',exact:true});
  if(await toggle.isVisible()&&await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
}
async function usable(locator){if(!await locator.isVisible())await openControls();await expect(locator).toBeVisible();return locator;}
async function closeControls(){
  const toggle=page.getByRole('button',{name:'表示・再生コントロール',exact:true});
  if(await toggle.isVisible()&&await toggle.getAttribute('aria-expanded')==='true')await toggle.click();
  if(await page.getByRole('dialog',{name:'表示・再生コントロール',exact:true}).isVisible())await page.keyboard.press('Escape');
}
async function chooseClip(pattern){
  const selector=await usable(page.locator('#object-clip'));
  const options=await selector.locator('option').evaluateAll(nodes=>nodes.map(node=>({value:node.value,name:node.textContent})));
  const option=options.find(row=>pattern.test(row.name));assert(option,'Required native motion missing: '+pattern);
  await selector.selectOption(option.value);await expect(page.locator('#object-stage')).toHaveAttribute('data-native-clip',option.name);await closeControls();return option.name;
}
async function snapshot(){return page.locator('#object-stage').evaluate(node=>node.characterReviewSnapshot());}
const compact=s=>({...s,objects:s.objects.map(({bones,...row})=>row)});
async function motionEvidence(pattern){
  const name=await chooseClip(pattern),before=await snapshot();await page.waitForTimeout(360);const after=await snapshot();
  assert(after.objects[0]?.bones.length>0,'Bound skeleton missing');assert(after.objects[0].bones.every(Number.isFinite),'Invalid animated bone palette');
  assert(after.objects[0].bones.some((value,index)=>Math.abs(value-before.objects[0].bones[index])>1e-6),'Native motion is not advancing: '+name);
  return {name,moved:true,snapshot:compact(after)};
}
async function view(name,file){
  const button=await usable(page.locator(`[data-object-camera="${name}"]`));await button.click();await closeControls();await page.waitForTimeout(100);
  await page.locator('#object-stage').scrollIntoViewIfNeeded();await page.locator('#object-stage').screenshot({path:path.join(output,file)});
}
async function webpFromPng(png){
  const data=await page.evaluate(async encoded=>{
    const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));const image=await createImageBitmap(new Blob([bytes],{type:'image/png'}));
    const canvas=document.createElement('canvas');canvas.width=384;canvas.height=384;const ctx=canvas.getContext('2d');ctx.fillStyle='#111716';ctx.fillRect(0,0,384,384);
    const scale=Math.min(384/image.width,384/image.height),w=image.width*scale,h=image.height*scale;ctx.drawImage(image,(384-w)/2,(384-h)/2,w,h);image.close();return canvas.toDataURL('image/webp',.92).split(',')[1];
  },png.toString('base64'));return Buffer.from(data,'base64');
}
try{
  execFileSync('npm',['run','predev','--workspace','@soul/rinne'],{cwd:root,env:{...process.env,APP_ENV:'dev'},stdio:'inherit'});
  assert(!execFileSync('git',['diff','--name-only','HEAD'],{encoding:'utf8'}).trim(),'Preparation changed tracked source');
  vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--config','apps/rinne/vite.config.js','--host','127.0.0.1','--port','5173','--strictPort'],{cwd:root,env:{...process.env,APP_ENV:'dev'},stdio:['ignore','pipe','pipe']});
  vite.stdout.on('data',data=>viteLog+=data);vite.stderr.on('data',data=>viteLog+=data);await ready(local);
  browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  context=await browser.newContext({viewport:{width:1280,height:900},deviceScaleFactor:1,recordVideo:generate?undefined:{dir:path.join(output,'video'),size:{width:1280,height:900}}});
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(['raw.githubusercontent.com','cdn.jsdelivr.net','codeberg.org','drive.google.com'].includes(url.hostname)){
      receipt.errors.push('Third-party runtime request: '+url.href);await route.abort('accessdenied');return;
    }
    if(!generate&&url.origin===origin.origin&&url.pathname.startsWith(origin.pathname)){
      const evidence=new URL(url.pathname.slice(1)+url.search,evidenceAssetOrigin);
      const response=await route.fetch({url:evidence.href});
      const headers=response.headers(),body=await response.body();
      receipt.requests.push({url:evidence.href,status:response.status(),cors:headers['access-control-allow-origin']||null,byteLength:body.length,transport:'live-cloudflare-evidence'});
      await route.fulfill({status:response.status(),body,headers});
      return;
    }
    if(generate&&url.origin===origin.origin&&url.pathname.startsWith(origin.pathname)){
      const relative=decodeURIComponent(url.pathname.slice(origin.pathname.length)),filename=path.resolve(library,relative);
      if(!filename.startsWith(library+path.sep)){await route.abort('accessdenied');return;}
      try{const body=await fs.readFile(filename);receipt.requests.push({url:url.href,status:200,byteLength:body.length,transport:'exact-head-local'});
        const mime={'.glb':'model/gltf-binary','.webp':'image/webp','.png':'image/png','.json':'application/json','.txt':'text/plain'}[path.extname(filename)]||'application/octet-stream';
        await route.fulfill({status:200,body,headers:{'content-type':mime,'access-control-allow-origin':'*'}});
      }catch(error){receipt.errors.push('Missing project asset: '+relative);await route.fulfill({status:404,body:'Not materialized'});}return;
    }
    if(url.origin===local&&url.pathname==='/__quaternius-native-probe'){
      await route.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><script type="module" src="/@fs/${root}scripts/browser/curated-asset-probe-runtime.js"></script>`});return;
    }
    await route.continue();
  });
  page=await context.newPage();
  page.on('pageerror',error=>receipt.errors.push(error.message));page.on('console',message=>{if(message.type()==='error')receipt.errors.push(message.text());if(message.type()==='warning')receipt.warnings.push(message.text());});
  if(!generate)page.on('response',response=>{if(response.status()>=400)receipt.errors.push(`HTTP ${response.status()}: ${response.url()}`);});
  await page.goto(local+'/__quaternius-native-probe');await page.waitForFunction(()=>!!window.curatedAssetProbe,{},{timeout:60000});
  receipt.browser=await page.evaluate(()=>window.curatedAssetProbe.versions());assert(receipt.browser.webgl2,'WebGL2 unavailable');
  // Reuse the existing skin/clip/clone verifier; humanoids require the same
  // strict native-skeleton checks as the existing animated creatures.
  for(const asset of ledger.files){
    const result=await page.evaluate(asset=>window.curatedAssetProbe.verify({...asset,kind:'creature'}),asset);
    delete result.thumbnail;receipt.assets.push(result);console.log(JSON.stringify({native:asset.id,clips:result.animations.length,status:result.status}));
  }
  await page.evaluate(()=>window.curatedAssetProbe.close());
  if(!generate){
    const response=await context.request.get(new URL('version.json',target).href);assert(response.ok(),'Immutable version.json not available');
    receipt.version=await response.json();assert(receipt.version.commit===head,'Immutable preview SHA differs from checkout');
  }
  await context.tracing.start({screenshots:true,snapshots:true,sources:false});tracing=true;
  const url=new URL('/review/objects/',target);url.searchParams.set('category','characters');url.searchParams.set('asset',ledger.files[0].id);
  await page.goto(url.href,{waitUntil:'domcontentloaded'});await expect(page.locator('#object-stage')).toHaveAttribute('data-loaded-asset',ledger.files[0].id,{timeout:60000});
  await expect(page.locator('#object-options button')).toHaveCount(ledger.files.length);
  const contact=[];
  for(const asset of ledger.files){
    const choice=await usable(page.locator(`[data-object="${asset.id}"]`));await choice.click();await closeControls();
    await expect(page.locator('#object-stage')).toHaveAttribute('data-loaded-asset',asset.id,{timeout:60000});
    const views=[];await chooseClip(/idle/i);
    for(const angle of ['front','side','back']){const file=`${asset.id}-${angle}.png`;await view(angle,file);views.push(file);}
    const front=await fs.readFile(path.join(output,views[0]));contact.push({label:asset.label,id:asset.id,image:'data:image/png;base64,'+front.toString('base64')});
    if(generate){
      const bytes=await webpFromPng(front),relative=`thumbnail/quaternius-characters-20260922/${asset.id}/${blob(bytes)}.webp`;
      await fs.mkdir(path.dirname(path.join(library,relative)),{recursive:true});await fs.writeFile(path.join(library,relative),bytes);
      asset.thumbnailPath=relative;asset.thumbnailSha256=hash(bytes);asset.thumbnailSource={head,assetSha256:asset.sha256,render:'canonical review-objects native idle front'};
      if(!manifest.files.some(row=>row.path===relative))manifest.files.push({path:relative,bytes:bytes.length,gitBlobSha:blob(bytes),sha256:hash(bytes)});addedFiles.push('apps/review/public/library/'+relative);
    }
    const walk=await motionEvidence(/walk|run/i);await view('front',`${asset.id}-locomotion.png`);
    const combat=await motionEvidence(/attack|slash|punch|spell|kick/i);await view('three-quarter',`${asset.id}-combat.png`);
    await chooseClip(/idle/i);
    const state=compact(await snapshot());assert(state.modelId===asset.modelId,'Canonical model ID mismatch');assert(state.objects.length===1,'Unexpected comparison state');
    await expect(page.locator('#object-provenance')).toContainText(asset.sha256);await expect(page.locator('#object-provenance')).toContainText(asset.modelId);
    receipt.ui.push({id:asset.id,modelId:asset.modelId,views,locomotion:walk,combat,state,status:'passed'});
  }
  for(const asset of ledger.files.filter(row=>row.modelName==='Medieval'||row.modelName==='Witch'||row.modelName==='Warrior')){
    await (await usable(page.locator(`[data-object="${asset.id}"]`))).click();await expect(page.locator('#object-stage')).toHaveAttribute('data-loaded-asset',asset.id,{timeout:60000});
    await (await usable(page.locator('#object-comparison'))).selectOption('both');await expect(page.locator('#object-stage')).toHaveAttribute('data-comparison-ready','both',{timeout:60000});await closeControls();
    const state=compact(await snapshot());assert(state.objects.length===3,'Both KayKit references must be visible');assert(state.heightStandard===1.7,'Comparison height mismatch');
    for(const angle of ['front','side','back'])await view(angle,`${asset.id}-kaykit-${angle}.png`);
    receipt.comparisons.push({id:asset.id,...state});await (await usable(page.locator('#object-comparison'))).selectOption('none');await expect(page.locator('#object-stage')).toHaveAttribute('data-comparison-ready','none');
  }
  const woman=ledger.files.find(row=>row.modelName==='Medieval');await (await usable(page.locator(`[data-object="${woman.id}"]`))).click();
  await expect(page.locator('#object-stage')).toHaveAttribute('data-loaded-asset',woman.id,{timeout:60000});await page.setViewportSize({width:390,height:844});await closeControls();
  await view('front','female-medieval-mobile.png');await page.waitForTimeout(1200);
  const grid=await page.locator('#object-options').evaluate(node=>({columns:getComputedStyle(node).gridTemplateColumns.split(/\s+/).length,clientWidth:node.clientWidth,scrollWidth:node.scrollWidth}));
  assert(grid.columns===5&&grid.scrollWidth<=grid.clientWidth+1,'Mobile library grid overflow or noncanonical column count');
  receipt.mobile={viewport:{width:390,height:844},emulated:true,realDevice:false,softwareRenderer:true,grid,performance:compact(await snapshot())};
  await page.screenshot({path:path.join(output,'library-mobile.png'),fullPage:true});await page.setViewportSize({width:1280,height:900});
  await (await usable(page.locator('#object-options'))).screenshot({path:path.join(output,'library-all-nine.png')});
  const sheet=await context.newPage();await sheet.setContent('<!doctype html><html><meta charset="utf-8"><style>body{background:#111716;color:#eee;font:16px sans-serif;margin:20px}main{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}figure{margin:0}img{width:100%;height:320px;object-fit:contain}figcaption{overflow-wrap:anywhere}h1{font-size:20px}</style><h1>Quaternius · 9 native characters</h1><main></main></html>');
  await sheet.evaluate(rows=>{for(const row of rows){const figure=document.createElement('figure'),img=new Image(),caption=document.createElement('figcaption');img.src=row.image;caption.textContent=row.label;figure.append(img,caption);document.querySelector('main').append(figure);}},contact);
  await sheet.evaluate(()=>Promise.all(Array.from(document.images,image=>image.decode())));await sheet.screenshot({path:path.join(output,'all-nine-contact-sheet.png'),fullPage:true});await sheet.close();
  await context.tracing.stop({path:path.join(output,'trace.zip')});tracing=false;
  assert(receipt.assets.length===9&&receipt.assets.every(row=>row.status==='passed'),'Every native asset must pass');
  assert(receipt.errors.length===0,receipt.errors.join('\n'));
  if(generate){
    manifest.files.sort((a,b)=>a.path.localeCompare(b.path));await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
    await fs.writeFile(ledgerPath,JSON.stringify(ledger,null,2)+'\n');await fs.writeFile(generatedPath,JSON.stringify(ledger.files,null,2)+'\n');
    addedFiles.push('apps/review/public/library/manifest.json','apps/review/public/library/provenance/quaternius-characters-20260922.json','packages/assets/generated/quaternius-characters.json');
    await fs.writeFile(path.join(output,'generated-files.json'),JSON.stringify(addedFiles,null,2));
  }else{
    for(const asset of ledger.files)assert(receipt.requests.some(row=>row.url.endsWith(asset.runtimePath)&&row.status===200&&row.transport==='live-cloudflare-evidence'),'No self-owned Cloudflare evidence response for '+asset.id);
    assert(!execFileSync('git',['diff','--name-only','HEAD'],{encoding:'utf8'}).trim(),'Browser validation changed tracked source');
  }
  receipt.status='passed';
}catch(error){receipt.status='failed';receipt.errors.push(error.stack||error.message);process.exitCode=1;
  if(page&&!page.isClosed())try{receipt.failurePage=await page.evaluate(()=>({url:location.href,status:document.querySelector('#object-status')?.textContent,selection:document.querySelector('#object-stage')?.dataset.loadedAsset}));await page.screenshot({path:path.join(output,'failure.png'),fullPage:true});}catch{}
}finally{
  if(tracing)try{await context.tracing.stop({path:path.join(output,'trace.zip')});}catch{}
  receipt.finishedAt=new Date().toISOString();await fs.writeFile(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');await fs.writeFile(path.join(output,'vite.log'),viteLog);
  console.log(JSON.stringify({head,status:receipt.status,models:receipt.assets.length,clips:receipt.assets.reduce((n,row)=>n+row.animations.length,0),errors:receipt.errors.slice(0,10)}));
  await context?.close();await browser?.close();vite?.kill('SIGTERM');
}
