import {mkdir,writeFile,rm} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {spawn,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';

const root=process.cwd(),temporary='apps/review/public/sprite-set-source-tmp',output='apps/review/public/sprite-sets/kaykit-knight',evidence='.deploy-state/sprite-set-bake';
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
await mkdir(temporary,{recursive:true});await mkdir(output,{recursive:true});await mkdir(evidence,{recursive:true});
const source='https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/672074b73ba276876a19e8816ecdc5241817ab47/addons/kaykit_character_pack_adventures/Characters/gltf/';
for(const [file,expected] of [['Knight.glb','717b56ca2b5ff5392679774725201ba03a3eefab'],['knight_texture.png','a56eae7514f908862e304620b89dc2d0cb9f362f']]){
  const response=await fetch(source+file,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw new Error(`Pinned source HTTP ${response.status}`);
  const bytes=Buffer.from(await response.arrayBuffer()),hash=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  if(hash!==expected)throw new Error('Pinned asset identity mismatch: '+file);await writeFile(temporary+'/'+file,bytes);
}
const log=createWriteStream(evidence+'/server.log'),server=spawn('npm',['run','dev','--workspace','@soul/review'],{cwd:root,env:{...process.env,APP_ENV:'dev'},detached:true,stdio:['ignore','pipe','pipe']});server.stdout.pipe(log);server.stderr.pipe(log);
let browser;
try{
  let ready=false;for(let i=0;i<120;i++){try{const response=await fetch('http://127.0.0.1:5176/review-hybrid-25d');if(response.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}if(!ready)throw new Error('Review server did not start');
  browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1280,height:1000}});page.setDefaultTimeout(180000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto('http://127.0.0.1:5176/review-hybrid-25d',{waitUntil:'networkidle'});
  const bundle=await page.evaluate(async()=>{const {bakeKnightSpriteSet}=await import('/src/tools/sprite-set-baker.js');return bakeKnightSpriteSet('http://127.0.0.1:5176/sprite-set-source-tmp/Knight.glb');});
  bundle.manifest.provenance.bakerSourceCommit=sha;
  for(const [id,asset] of Object.entries(bundle.manifest.assets)){
    const bytes=Buffer.from(bundle.images[id].slice(22),'base64');
    if(bytes.length!==asset.byteLength||createHash('sha256').update(bytes).digest('hex')!==asset.sha256)throw new Error('Baked PNG integrity mismatch');
    await writeFile(output+'/'+asset.file,bytes);
  }
  await writeFile(output+'/manifest.json',JSON.stringify(bundle.manifest,null,2)+'\n');
  await page.locator('[data-sprite-sample]').click();
  await page.waitForFunction(()=>document.querySelector('.sprite-set-playground')?.dataset.spriteReady==='true');
  await page.locator('.sprite-set-stage').screenshot({path:evidence+'/sample-front.png'});
  await page.locator('[data-sprite-direction]').selectOption('back');await page.waitForTimeout(250);await page.locator('.sprite-set-stage').screenshot({path:evidence+'/sample-back.png'});
  await page.locator('[data-sprite-direction]').selectOption('frontRight');await page.locator('[data-sprite-action="attack"]').click();await page.waitForTimeout(400);await page.locator('.sprite-set-stage').screenshot({path:evidence+'/sample-attack.png'});
  const state=await page.locator('.sprite-set-stage canvas').evaluate(c=>c.spriteSetSnapshot());
  await writeFile(evidence+'/receipt.json',JSON.stringify({schema:'rinne.sprite-set-bake-evidence/v1',sourceSha:sha,modelGitBlob:bundle.manifest.provenance.sourceGitBlob,originalSourceSha256:bundle.manifest.provenance.originalSourceSha256,actions:Object.keys(bundle.manifest.actions),images:Object.fromEntries(Object.entries(bundle.manifest.assets).map(([id,a])=>[id,{sha256:a.sha256,width:a.width,height:a.height,processing:a.provenance.processing}])),state,errors},null,2));
  if(errors.length)throw new Error('Baker/preview console errors: '+errors.join('\n'));
  console.log('SPRITE_SET_BAKE_OK '+JSON.stringify({sourceSha:sha,actions:13,images:13,output}));
}finally{
  await browser?.close();try{process.kill(-server.pid,'SIGTERM');}catch{}log.end();await rm(temporary,{recursive:true,force:true});
}
