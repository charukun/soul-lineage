import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {KAYKIT_MODEL_BY_KEY} from '@soul/characters';

export const REBUILT_MODEL_ID='reconstructed-wayfarer.reference.v1';
const SOURCE_PROFILE={version:1,face:'classic',hair:'original',body:'balanced',outfit:'uniform',accessory:'none'};
const CAMERA_PRESETS=['front','side','back'];

const cell=(row,label)=>`<figure><img src="data:image/png;base64,${row.buffer.toString('base64')}" alt="${label}"><figcaption>${label}</figcaption></figure>`;

export async function captureRebuildThreeView(browser,url,output){
  const source=KAYKIT_MODEL_BY_KEY.knight;
  assert.equal(source.runtime.url,'./simulator/assets/kaykit/Knight.glb');
  assert.equal(source.license,'CC0-1.0');
  const evidenceDir=join(output,'three-view');await mkdir(evidenceDir,{recursive:true});
  const context=await browser.newContext({viewport:{width:1280,height:940},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];
  page.setDefaultTimeout(60000);
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  try{
    const reviewURL=new URL('./characters.html',url).href;
    const response=await page.goto(reviewURL,{waitUntil:'domcontentloaded'});
    assert.ok(response?.ok(),'character review must answer successfully');
    await page.waitForFunction(()=>window.characterStudio?.review?.ready===true&&window.characterStudio?.workspace,null,{timeout:90000});
    await page.evaluate(()=>window.characterStudio.workspace.configure({view:'single',motion:'rest',rotate:false,paused:true}));
    const canvas=page.locator('#stage');await canvas.waitFor({state:'visible'});
    const captures=[];
    const take=async(kind,preset)=>{
      await page.evaluate(({kind,preset,profile,modelId})=>{
        const {workspace,review}=window.characterStudio;
        workspace.configure({view:'single',motion:'rest',rotate:false,paused:true});
        if(kind==='source'){
          workspace.selectModel(null);
          const actor=review.actors[review.settings.selected];
          actor.appearanceController?.setIdentity(null);
          actor.appearanceController?.setProfile(profile);
        }else workspace.selectModel(modelId);
        review.aim(preset);
      },{kind,preset,profile:SOURCE_PROFILE,modelId:REBUILT_MODEL_ID});
      if(kind==='rebuilt')await page.waitForFunction(id=>window.characterStudio?.workspace?.modelId===id,REBUILT_MODEL_ID);
      else await page.waitForFunction(()=>window.characterStudio?.workspace?.modelId===null);
      await page.waitForTimeout(220);
      const buffer=await canvas.screenshot({type:'png'});
      captures.push({kind,preset,buffer});
      await canvas.screenshot({path:join(evidenceDir,`${kind}-${preset}.png`)});
    };
    for(const preset of CAMERA_PRESETS)await take('source',preset);
    for(const preset of CAMERA_PRESETS)await take('rebuilt',preset);
    assert.deepEqual(errors,[]);

    const labels={front:'正面',side:'横',back:'背面'};
    const sourceCells=captures.slice(0,3).map(row=>cell(row,labels[row.preset])).join('');
    const rebuiltCells=captures.slice(3).map(row=>cell(row,labels[row.preset])).join('');
    const sheet=await context.newPage();
    await sheet.setContent(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>
      *{box-sizing:border-box}body{margin:0;background:#10191b;color:#f2eadb;font-family:sans-serif;padding:36px}h1{font-size:28px;margin:0 0 8px}p{margin:4px 0 24px;color:#b8c5c2}.meta{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:24px}.meta section{border:1px solid #51615e;padding:16px;background:#172427}.meta strong{display:block;font-size:18px;margin-bottom:8px}.meta small{display:block;line-height:1.55;color:#c8d1cf}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.row-title{grid-column:1/-1;font-size:20px;font-weight:700;margin-top:6px}.grid figure{margin:0;border:1px solid #51615e;background:#1d2c2f;padding:10px}.grid img{display:block;width:100%;aspect-ratio:1/1;object-fit:cover;background:#1e3036}.grid figcaption{text-align:center;padding:9px 0 2px;font-weight:700}.foot{margin-top:18px;font-size:12px;color:#8fa09d}
    </style></head><body><h1>Source → AI Rebuild / Three-view Evidence</h1><p>同一Visual Review・同一camera preset・同一neutral stageで、元モデルと再構築モデルを正面 / 横 / 背面から実描画。</p><div class="meta"><section><strong>元モデル: KayKit Knight</strong><small>ID: ${source.id}<br>File: Knight.glb<br>Revision: ${source.source.revision}<br>Blob: ${source.source.gitBlobSha}<br>License: ${source.license}</small></section><section><strong>再構築: Wayfarer</strong><small>ID: ${REBUILT_MODEL_ID}<br>Geometry: runtime procedural rebuild<br>Source geometry / texture: reused = false<br>Style: armored knight → itinerant wayfarer</small></section></div><div class="grid"><div class="row-title">元モデル / KayKit Knight.glb</div>${sourceCells}<div class="row-title">再構築モデル / Wayfarer</div>${rebuiltCells}</div><div class="foot">Generated from the PR-head browser render. Not a concept mockup.</div></body></html>`);
    await sheet.screenshot({path:join(output,'00-source-vs-wayfarer-three-view.png'),fullPage:true});
  }finally{await context.close();}
}
