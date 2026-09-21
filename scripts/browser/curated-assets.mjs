#!/usr/bin/env node
// Explicit specialist validation only. Not wired into Fast DEV, build, or recurring CI.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
const root=fileURLToPath(new URL('../../',import.meta.url));
process.chdir(root);
const generate=process.argv.includes('--generate');
const uiOnly=process.argv.includes('--ui-only');
const library=path.join(root,'apps/review/public/library');
const ledger=JSON.parse(await fs.readFile(path.join(library,'provenance/curation-20260921.json'),'utf8'));
const manifestPath=path.join(library,'manifest.json');
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
const origin=new URL(manifest.origin);
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(!/^[0-9a-f]{40}$/.test(head))throw new Error('Exact checked-out head required');
const dirty=execFileSync('git',['diff','--name-only','HEAD'],{encoding:'utf8'}).trim();
if(dirty)throw new Error('Commit the tested source before browser validation: '+dirty);
const output=path.join(root,'.deploy-state/asset-curation-evidence');await fs.mkdir(output,{recursive:true});
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const gitBlob=bytes=>crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const assert=(value,message)=>{if(!value)throw new Error(message);};
const receipt={schema:1,head,mode:generate?'generate':uiOnly?'ui-only':'exact-head',status:'running',assetOrigin:origin.href,
  transport:'Project Asset Origin URLs fulfilled from exact-head local materialized files before deployment; not a claim of live DEV publication',assets:[],ui:[],errors:[],requests:[]};
let vite,viteOutput='',browser,context,page,tracing=false;
const local='http://127.0.0.1:5173';
try{
  // Starting Vite directly bypasses npm's predev lifecycle. Preserve the real app
  // preparation path so existing pinned KayKit, Basis and Effekseer payloads exist.
  execFileSync('npm',['run','predev','--workspace','@soul/rinne'],{cwd:root,env:{...process.env,APP_ENV:'dev'},stdio:'inherit'});
  const preparedDirty=execFileSync('git',['diff','--name-only','HEAD'],{encoding:'utf8'}).trim();
  assert(!preparedDirty,'Preparation modified tracked exact-head source: '+preparedDirty);
  receipt.legacyPreparation={command:'npm run predev --workspace @soul/rinne',status:'passed',trackedSourceUnchanged:true};
  vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--config','apps/rinne/vite.config.js','--host','127.0.0.1','--port','5173','--strictPort'],{cwd:root,env:{...process.env,APP_ENV:'dev'},stdio:['ignore','pipe','pipe']});
  vite.stdout.on('data',data=>viteOutput+=data.toString());vite.stderr.on('data',data=>viteOutput+=data.toString());
  for(let attempt=0;attempt<120;attempt++){
    if(vite.exitCode!==null)throw new Error('Vite failed: '+viteOutput);
    try{if((await fetch(local)).ok)break;}catch{}
    if(attempt===119)throw new Error('Vite did not become ready: '+viteOutput);
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
  context=await browser.newContext({viewport:{width:1280,height:900},deviceScaleFactor:1});
  await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin===origin.origin&&url.pathname.startsWith(origin.pathname)){
      const relative=decodeURIComponent(url.pathname.slice(origin.pathname.length));
      const target=path.resolve(library,relative);
      if(!target.startsWith(library+path.sep)){await route.abort('accessdenied');return;}
      try{
        const body=await fs.readFile(target);
        const ext=path.extname(target);const mime={'.glb':'model/gltf-binary','.ogg':'audio/ogg','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.json':'application/json','.wasm':'application/wasm','.js':'text/javascript','.txt':'text/plain'}[ext]||'application/octet-stream';
        receipt.requests.push({url:request.url(),bytes:body.length});
        await route.fulfill({status:200,body,headers:{'content-type':mime,'content-length':String(body.length),'access-control-allow-origin':'*','cache-control':'no-store'}});
      }catch(error){receipt.errors.push('Missing local origin asset: '+relative);await route.fulfill({status:404,body:'Asset not materialized'});}
      return;
    }
    if(['raw.githubusercontent.com','cdn.jsdelivr.net','codeberg.org'].includes(url.hostname)){
      receipt.errors.push('Third-party runtime asset request: '+request.url());await route.abort('accessdenied');return;
    }
    if(url.pathname==='/__curated-probe'){
      await route.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><title>Exact-head asset probe</title><style>body{margin:0;background:#111716}</style><script type="module" src="/@fs/${root}scripts/browser/curated-asset-probe-runtime.js"></script>`});return;
    }
    await route.continue();
  });
  page=await context.newPage();
  page.on('pageerror',error=>receipt.errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')receipt.errors.push(message.text());});
  if(!uiOnly){
    await page.goto(local+'/__curated-probe');await page.waitForFunction(()=>!!window.curatedAssetProbe,{},{timeout:60000});
    receipt.browser=await page.evaluate(()=>window.curatedAssetProbe.versions());assert(receipt.browser.webgl2,'WebGL2 unavailable');
    const contact=[];
    for(const [index,asset] of ledger.files.entries()){
      try{
        const result=await page.evaluate(asset=>window.curatedAssetProbe.verify(asset),asset);
        if(result.thumbnail){
          const data=Buffer.from(result.thumbnail.split(',')[1],'base64');
          if(generate){
            result.thumbnailPath=`thumbnail/curation-20260921/${asset.id}/${gitBlob(data)}.webp`;
            result.thumbnailSha256=hash(data);const target=path.join(library,result.thumbnailPath);
            await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,data);
            const row={path:result.thumbnailPath,bytes:data.length,gitBlobSha:gitBlob(data),sha256:hash(data)};
            const existing=manifest.files.find(item=>item.path===row.path);if(existing)assert(existing.gitBlobSha===row.gitBlobSha,'Thumbnail collision');else manifest.files.push(row);
          }else{
            result.thumbnailPath=asset.thumbnailPath;
            const stored=await fs.readFile(path.join(library,asset.thumbnailPath));result.thumbnailSha256=hash(stored);
          }
          if(asset.kind==='creature'||asset.id.includes('building-blacksmith-blue')||asset.id.includes('building-home-a-blue')||asset.id.includes('building-market-red')||asset.id.includes('trees-a-small')||asset.id.includes('table-long-decorated-a')||asset.id.includes('sword-shield-gold'))contact.push({label:asset.label,id:asset.id,image:result.thumbnail});
          delete result.thumbnail;
        }
        receipt.assets.push(result);
      }catch(error){receipt.assets.push({id:asset.id,sha256:asset.sha256,byteLength:asset.byteLength,status:'failed',error:error.message});receipt.errors.push(asset.id+': '+error.message);}
      if(index%25===0||index===ledger.files.length-1)console.log(JSON.stringify({checked:index+1,total:ledger.files.length,failed:receipt.assets.filter(item=>item.status==='failed').length}));
    }
    await page.evaluate(()=>window.curatedAssetProbe.close());
    const sheet=await context.newPage();
    await sheet.setContent('<!doctype html><html lang="ja"><meta charset="utf-8"><title>Authored asset contact sheet</title><style>body{background:#111716;color:#eee;font:14px sans-serif;margin:20px}main{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}figure{margin:0;min-width:0}img{width:100%;aspect-ratio:1;object-fit:contain}figcaption{overflow-wrap:anywhere}h1{font-size:20px}</style><h1>Authored CC0 assets · exact head '+head+'</h1><main></main></html>');
    await sheet.evaluate(contact=>{for(const item of contact){const figure=document.createElement('figure'),image=new Image(),caption=document.createElement('figcaption');image.src=item.image;caption.textContent=item.label+' · '+item.id;figure.append(image,caption);document.querySelector('main').append(figure);}},contact);
    await sheet.evaluate(()=>Promise.all(Array.from(document.images,image=>image.decode())));
    await sheet.screenshot({path:path.join(output,'authored-contact-sheet.png'),fullPage:true});await sheet.close();
    if(generate){manifest.files.sort((a,b)=>a.path.localeCompare(b.path));await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');}
  }
  if(!generate){
    await context.tracing.start({screenshots:true,snapshots:true,sources:false});tracing=true;
    const {verifyCuratedReview}=await import('./curated-review-smoke.mjs');
    await verifyCuratedReview({page,context,local,output,ledger,receipt});
    await context.tracing.stop({path:path.join(output,'review-trace.zip')});tracing=false;
  }
  assert(receipt.errors.length===0,receipt.errors.join('\n'));
  if(!uiOnly)assert(receipt.assets.length===ledger.files.length&&receipt.assets.every(item=>item.status==='passed'),'All materialized assets must pass');
  receipt.status='passed';
}catch(error){
  receipt.status='failed';receipt.errors.push(error.stack||error.message);process.exitCode=1;
  if(page&&!page.isClosed()){
    try{
      receipt.failurePage=await page.evaluate(()=>({url:location.href,statuses:Object.fromEntries(['motion-status','motion-quality','motion-binding-report','object-status','fx-metrics'].map(id=>[id,document.getElementById(id)?.textContent||null]))}));
      await page.screenshot({path:path.join(output,'failure-page.png'),fullPage:true});
    }catch(diagnosticError){receipt.errors.push('Failure diagnostics: '+diagnosticError.message);}
  }
}
finally{
  if(tracing)try{await context.tracing.stop({path:path.join(output,'review-trace.zip')});}catch(error){receipt.errors.push('Trace capture: '+error.message);receipt.status='failed';process.exitCode=1;}
  receipt.finishedAt=new Date().toISOString();
  await fs.writeFile(path.join(output,generate?'native-receipt.json':uiOnly?'ui-receipt.json':'exact-head-receipt.json'),JSON.stringify(receipt,null,2)+'\n');
  await fs.writeFile(path.join(output,'vite.log'),viteOutput);
  console.log(JSON.stringify({head:receipt.head,status:receipt.status,assets:receipt.assets.length,clips:receipt.assets.reduce((n,row)=>n+(row.animations?.length||0),0),errors:receipt.errors.slice(0,15)}));
  await context?.close();await browser?.close();vite?.kill('SIGTERM');
}
