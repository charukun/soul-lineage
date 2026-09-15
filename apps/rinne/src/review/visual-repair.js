import { buildVisualRepairPrompt, buildVisualJudgePrompt, parseVisualJudgeResult, VISUAL_REPAIR_RUBRIC } from './visual-repair-contract.js';
import './visual-repair.css';

const q=selector=>document.querySelector(selector);
const make=(tag,className='',text='')=>{const node=document.createElement(tag);if(className)node.className=className;if(text)node.textContent=text;return node;};
const DB_NAME='rinne-visual-repair';
const DB_VERSION=1;
const TARGET_STORE='targets';
const MAX_IMAGE_BYTES=12*1024*1024;
let targetBlob=null;
let targetName='';
let targetURL='';
let currentBlob=null;
let currentURL='';
let compareBlob=null;
let compareURL='';
let activeModelKey='';

function setStatus(message,kind=''){
  const node=q('#visual-repair-status');
  if(!node)return;
  node.textContent=message;
  node.dataset.kind=kind;
}
function modelKey(){return q('#preset')?.value||q('.model-chip.active')?.dataset.model||'current-model';}
function reviewContext(){
  const snapshot=window.__reviewLab?.snapshot?.();
  const selected=q('#preset')?.selectedOptions?.[0]?.textContent||q('.model-chip.active')?.textContent||q('#source-label')?.textContent||modelKey();
  return {
    model:selected,
    motion:snapshot?.sequence?.length?snapshot.sequence.join(' → '):snapshot?.clip||q('#motion-name')?.textContent||'静止比較',
    view:snapshot?.state?.camera||'current',
    build:q('#build-label')?.textContent||snapshot?.build||'',
    note:q('#review-note')?.value||''
  };
}
function openDB(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(TARGET_STORE))request.result.createObjectStore(TARGET_STORE,{keyPath:'key'});};
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error('端末保存領域を開けませんでした。'));
  });
}
async function withStore(mode,operation){
  const db=await openDB();
  try{return await new Promise((resolve,reject)=>{const tx=db.transaction(TARGET_STORE,mode);const store=tx.objectStore(TARGET_STORE);let request;try{request=operation(store);}catch(error){reject(error);return;}request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}finally{db.close();}
}
const savedTarget=key=>withStore('readonly',store=>store.get(key));
const saveTarget=(key,blob,name)=>withStore('readwrite',store=>store.put({key,blob,name,updatedAt:new Date().toISOString()}));
const removeTarget=key=>withStore('readwrite',store=>store.delete(key));
function revoke(url){if(url)URL.revokeObjectURL(url);}
function setPreview(selector,blob,which){
  const image=q(selector);if(!image)return;
  const old=which==='target'?targetURL:which==='current'?currentURL:compareURL;revoke(old);
  const next=blob?URL.createObjectURL(blob):'';
  if(which==='target')targetURL=next;else if(which==='current')currentURL=next;else compareURL=next;
  image.src=next;image.hidden=!next;image.closest('.visual-repair-image-frame')?.classList.toggle('has-image',Boolean(next));
}
function clearCurrent(){currentBlob=null;compareBlob=null;setPreview('#visual-repair-current',null,'current');setPreview('#visual-repair-compare',null,'compare');}
async function loadTargetForModel(){
  const key=modelKey();if(key===activeModelKey&&targetBlob)return;activeModelKey=key;clearCurrent();
  try{
    const row=await savedTarget(key);targetBlob=row?.blob||null;targetName=row?.name||'';setPreview('#visual-repair-target',targetBlob,'target');
    q('#visual-repair-target-name').textContent=targetBlob?`${targetName||'理想画像'} / この端末に保存済み`:'まだ理想画像がありません';
    setStatus(targetBlob?'このモデルの理想画像を端末から読み込みました。':'このモデルの理想画像を選んでください。');
  }catch(error){targetBlob=null;targetName='';setPreview('#visual-repair-target',null,'target');setStatus(error.message,'error');}
}
async function chooseTarget(file){
  if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('PNG / JPEG / WebP の画像を選んでください。');if(file.size>MAX_IMAGE_BYTES)throw new Error('理想画像は12 MiB以下にしてください。');
  targetBlob=file;targetName=file.name;activeModelKey=modelKey();await saveTarget(activeModelKey,file,file.name);setPreview('#visual-repair-target',targetBlob,'target');q('#visual-repair-target-name').textContent=`${file.name} / この端末に保存済み`;clearCurrent();setStatus('理想画像をこの端末だけに保存しました。まだ外部送信していません。','success');
}
async function deleteTarget(){
  const key=modelKey();await removeTarget(key);targetBlob=null;targetName='';activeModelKey=key;setPreview('#visual-repair-target',null,'target');clearCurrent();q('#visual-repair-target-name').textContent='まだ理想画像がありません';setStatus('このモデルの理想画像を端末から削除しました。');
}
function activeCanvas(){
  const stage=q('#performance-stage');
  if(stage&&!stage.hidden&&stage.getClientRects().length){try{const nested=stage.contentDocument?.querySelector('canvas');if(nested?.width&&nested?.height)return nested;}catch{}}
  const canvas=q('#review-canvas');if(!canvas?.width||!canvas?.height)throw new Error('現在の3D表示を取得できません。モデルを表示してから再試行してください。');return canvas;
}
function canvasBlob(canvas){
  return new Promise((resolve,reject)=>{try{canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('現在画像の取得に失敗しました。')),'image/png');}catch(error){reject(new Error(error?.name==='SecurityError'?'外部URL素材がCORS制約で画像化できません。リポジトリ素材で確認してください。':error.message));}});
}
async function captureCurrent(){
  currentBlob=await canvasBlob(activeCanvas());setPreview('#visual-repair-current',currentBlob,'current');compareBlob=null;setPreview('#visual-repair-compare',null,'compare');setStatus('現在の実レンダーを端末内で取得しました。','success');return currentBlob;
}
async function loadBitmap(blob){
  if(typeof createImageBitmap==='function')return createImageBitmap(blob);
  return new Promise((resolve,reject)=>{const image=new Image();const url=URL.createObjectURL(blob);image.onload=()=>{URL.revokeObjectURL(url);resolve(image);};image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('比較画像を読み込めません。'));};image.src=url;});
}
function drawContain(ctx,image,x,y,width,height){const sourceWidth=image.width||image.naturalWidth,sourceHeight=image.height||image.naturalHeight;const scale=Math.min(width/sourceWidth,height/sourceHeight),drawWidth=sourceWidth*scale,drawHeight=sourceHeight*scale;ctx.drawImage(image,x+(width-drawWidth)/2,y+(height-drawHeight)/2,drawWidth,drawHeight);}
async function composeComparison(){
  if(!targetBlob)throw new Error('先に理想画像を選んでください。');if(!currentBlob)await captureCurrent();const[target,current]=await Promise.all([loadBitmap(targetBlob),loadBitmap(currentBlob)]);
  const canvas=document.createElement('canvas');canvas.width=1800;canvas.height=1040;const ctx=canvas.getContext('2d');ctx.fillStyle='#101217';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#f4f1e7';ctx.font='700 34px system-ui, sans-serif';ctx.fillText('TARGET',42,58);ctx.fillText('CURRENT',922,58);ctx.strokeStyle='#69727f';ctx.lineWidth=2;ctx.strokeRect(32,82,846,846);ctx.strokeRect(912,82,846,846);drawContain(ctx,target,34,84,842,842);drawContain(ctx,current,914,84,842,842);
  const context=reviewContext();ctx.fillStyle='#b8c0ca';ctx.font='22px system-ui, sans-serif';ctx.fillText([context.model,context.motion,context.view,context.build].filter(Boolean).join(' · ').slice(0,135)||'輪廻転焦 Visual Review Lab',42,988);target.close?.();current.close?.();compareBlob=await canvasBlob(canvas);setPreview('#visual-repair-compare',compareBlob,'compare');setStatus('比較シートを端末内で生成しました。共有するまで送信されません。','success');return compareBlob;
}
function comparisonFile(blob){return new File([blob],`rinne-visual-compare-${modelKey().replace(/[^a-z0-9._-]+/gi,'-')}-${Date.now()}.png`,{type:'image/png'});}
async function copyText(text){
  if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return true;}
  const area=document.createElement('textarea');area.value=text;area.style.position='fixed';area.style.opacity='0';document.body.append(area);area.select();const copied=document.execCommand('copy');area.remove();return copied;
}
function downloadBlob(blob,name){const link=document.createElement('a');const url=URL.createObjectURL(blob);link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function shareComparison(kind){
  const blob=await composeComparison(),context=reviewContext(),prompt=kind==='judge'?buildVisualJudgePrompt(context):buildVisualRepairPrompt(context),file=comparisonFile(blob);try{await copyText(prompt);}catch{}
  const shareData={title:kind==='judge'?'輪廻転焦 Visual Judge':'輪廻転焦 Visual Repair',text:prompt,files:[file]};
  if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
    try{await navigator.share(shareData);setStatus(kind==='judge'?'比較画像と判定指示を共有しました。指示文はクリップボードにもあります。':'比較画像と修正指示を共有しました。ChatGPTでAstraを選び、そのまま実装WORKとして渡してください。','success');return;}catch(error){if(error?.name==='AbortError'){setStatus('共有をキャンセルしました。');return;}}
  }
  downloadBlob(blob,file.name);setStatus('共有APIを使えないため比較PNGを保存し、指示文をコピーしました。ChatGPTへ画像を添付して貼り付けてください。','success');
}
function renderJudgeResult(result){
  const root=q('#visual-repair-result');root.replaceChildren();root.hidden=false;const head=make('div','visual-repair-score-head');head.append(make('strong','',`${result.total.toFixed(2).replace(/\.00$/,'')}/10`),make('span','',result.summary||'AI比較結果'));const grid=make('div','visual-repair-score-grid');
  for(const row of VISUAL_REPAIR_RUBRIC){const item=make('div','visual-repair-score-item');item.append(make('span','',row.label),make('strong','',`${result.scores[row.id]}/${row.max}`));grid.append(item);}const section=(title,rows)=>{if(!rows.length)return null;const node=make('section','visual-repair-result-section');node.append(make('h4','',title));const list=make('ul');for(const value of rows)list.append(make('li','',value));node.append(list);return node;};root.append(head,grid);for(const node of [section('優先修正',result.blockers),section('次にやること',result.nextActions),section('維持する部分',result.preserve)])if(node)root.append(node);try{localStorage.setItem(`rinne.visualRepair.result.${modelKey()}`,JSON.stringify(result));}catch{}
}
function restoreJudgeResult(){const root=q('#visual-repair-result');root.replaceChildren();root.hidden=true;try{const value=localStorage.getItem(`rinne.visualRepair.result.${modelKey()}`);if(value)renderJudgeResult(JSON.parse(value));}catch{}}
function createDialog(){
  const dialog=make('dialog','visual-repair-dialog');dialog.id='visual-repair-dialog';dialog.setAttribute('aria-labelledby','visual-repair-title');const header=make('header','visual-repair-header'),title=make('div');const heading=make('h2','','理想画像から直す');heading.id='visual-repair-title';title.append(heading,make('p','','TARGETと現在モデルを並べてAstraへ修正依頼'));const close=make('button','visual-repair-close','閉じる');close.type='button';header.append(title,close);
  const privacy=make('p','visual-repair-privacy','理想画像はこの端末のIndexedDBだけに保存します。共有ボタンを押すまでAIや外部APIへ送信しません。Fal / 外部画像生成APIは使用しません。');const compare=make('div','visual-repair-pair');
  const card=(label,id,placeholder)=>{const node=make('section','visual-repair-card');node.append(make('strong','',label));const frame=make('div','visual-repair-image-frame'),image=document.createElement('img');image.id=id;image.alt=label;image.hidden=true;frame.append(image,make('span','visual-repair-placeholder',placeholder));node.append(frame);return node;};compare.append(card('TARGET 理想','visual-repair-target','理想画像を選択'),card('CURRENT 現在','visual-repair-current','現在モデルを取得'));
  const targetTools=make('div','visual-repair-target-tools'),fileLabel=make('label','visual-repair-file','理想画像を選ぶ'),input=document.createElement('input');input.type='file';input.accept='image/png,image/jpeg,image/webp';input.id='visual-repair-file';fileLabel.append(input);const targetNameNode=make('span','visual-repair-target-name','まだ理想画像がありません');targetNameNode.id='visual-repair-target-name';const remove=make('button','visual-repair-secondary','理想画像を消す');remove.type='button';remove.id='visual-repair-remove';targetTools.append(fileLabel,targetNameNode,remove);
  const capture=make('button','visual-repair-secondary','現在を撮る');capture.type='button';capture.id='visual-repair-capture';const actions=make('div','visual-repair-actions'),repair=make('button','visual-repair-primary','Astraへ修正依頼'),judge=make('button','visual-repair-secondary','AI判定へ共有'),save=make('button','visual-repair-secondary','比較PNGを保存');repair.type=judge.type=save.type='button';repair.id='visual-repair-share';judge.id='visual-repair-judge-share';save.id='visual-repair-save';actions.append(repair,judge,save);
  const compareFrame=make('div','visual-repair-compare-frame'),compareImage=document.createElement('img');compareImage.id='visual-repair-compare';compareImage.alt='TARGETとCURRENTの比較シート';compareImage.hidden=true;compareFrame.append(compareImage);const judgeBox=make('details','visual-repair-judge-box');judgeBox.append(make('summary','','AI判定結果をLabへ戻す'),make('p','','「AI判定へ共有」で得たJSONを貼ると、点数と修正優先順位をこの端末に記録します。これは診断用で、人間の承認ではありません。'));const textarea=document.createElement('textarea');textarea.id='visual-repair-judge-json';textarea.placeholder='{"version":1,"scores":{...}}';textarea.spellcheck=false;const apply=make('button','visual-repair-secondary','判定JSONを反映');apply.type='button';apply.id='visual-repair-judge-apply';judgeBox.append(textarea,apply);const result=make('section','visual-repair-result');result.id='visual-repair-result';result.hidden=true;const status=make('p','visual-repair-status','このモデルの理想画像を選んでください。');status.id='visual-repair-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');dialog.append(header,privacy,targetTools,capture,compare,actions,compareFrame,judgeBox,result,status);document.body.append(dialog);
  close.addEventListener('click',()=>dialog.close());input.addEventListener('change',()=>chooseTarget(input.files?.[0]).catch(error=>setStatus(error.message,'error')));remove.addEventListener('click',()=>deleteTarget().catch(error=>setStatus(error.message,'error')));capture.addEventListener('click',()=>captureCurrent().catch(error=>setStatus(error.message,'error')));repair.addEventListener('click',()=>shareComparison('repair').catch(error=>setStatus(error.message,'error')));judge.addEventListener('click',()=>shareComparison('judge').catch(error=>setStatus(error.message,'error')));save.addEventListener('click',async()=>{try{const blob=await composeComparison();downloadBlob(blob,comparisonFile(blob).name);setStatus('比較PNGを保存しました。','success');}catch(error){setStatus(error.message,'error');}});apply.addEventListener('click',()=>{try{const parsed=parseVisualJudgeResult(textarea.value);renderJudgeResult(parsed);setStatus(`AI診断 ${parsed.total}/10 をこの端末に保存しました。人間の承認とは別です。`,'success');}catch(error){setStatus(error.message,'error');}});return dialog;
}
function install(){
  if(q('#visual-repair-toggle'))return;const viewport=q('.viewport');if(!viewport)return;const dialog=createDialog(),button=make('button','visual-repair-toggle','理想比較');button.id='visual-repair-toggle';button.type='button';button.setAttribute('aria-haspopup','dialog');button.addEventListener('click',async()=>{dialog.showModal();await loadTargetForModel();restoreJudgeResult();});const feedback=q('.review-feedback-toggle');if(feedback)feedback.after(button);else viewport.after(button);
  q('#preset')?.addEventListener('change',()=>{activeModelKey='';targetBlob=null;targetName='';clearCurrent();if(dialog.open)loadTargetForModel().then(restoreJudgeResult).catch(error=>setStatus(error.message,'error'));});window.addEventListener('beforeunload',()=>{revoke(targetURL);revoke(currentURL);revoke(compareURL);},{once:true});
}
install();
