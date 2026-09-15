/* Browser adapter only: boot reporting and bounded asset reads, no game-rule changes. */
(()=>{'use strict';
 const config=window.__RINNE_EMBED__||{},token=config.token||window.__RINNE_EMBED_TOKEN__||new URL(location.href).searchParams.get('titleToken');
 const embedded=Boolean(token&&parent!==window),target=/^https?:\/\//.test(config.hostOrigin||'')?config.hostOrigin:/^https?:$/.test(location.protocol)?location.origin:'*';
 const observationURL=new URL('./observation.js',document.currentScript?.src||location.href);
 let ready=false,failed=false,timer=0,serial=0;const pending=new Map();
 const send=(type,extra={})=>{if(embedded)parent.postMessage({channel:'rinne-title-v1',token,type,...extra},target);};
 const progress=data=>{if(!ready&&!failed)send('progress',{progress:data});};
 const fail=(error,code='GAME_BOOT_ERROR')=>{
  if(failed)return;failed=true;clearInterval(timer);
  const detail=String(error?.message||error||'起動処理に失敗しました').slice(0,1400);
  window.__RINNE_BOOT_ERROR__={code,detail};
  send('error',{message:'ゲームを起動できませんでした。詳細を確認して、もう一度お試しください。',code,detail});
 };
 const markReady=()=>{if(ready||failed)return;ready=true;clearInterval(timer);if(config.offline){send('ready');return;}import(observationURL.href).then(({installObservation})=>{installObservation();send('ready');}).catch(error=>fail(error,'PRESENTATION_BOOT_ERROR'));};
 const yieldUI=()=>new Promise(resolve=>setTimeout(resolve,0));
 const step=async data=>{progress(data);await yieldUI();};
 const readAsset=async(id,url,onProgress)=>{
  if(window.assetBuffer)return window.assetBuffer(id,onProgress);
  const response=await fetch(url);if(!response.ok)throw Error(`HTTP ${response.status}: ${url}`);
  const total=Number(response.headers.get('content-length'))||0,parts=[];let size=0;
  if(!response.body){const buffer=await response.arrayBuffer();onProgress?.({loaded:buffer.byteLength,total:buffer.byteLength});return buffer;}
  const reader=response.body.getReader();try{for(;;){const {done,value}=await reader.read();if(done)break;parts.push(value);size+=value.byteLength;onProgress?.({loaded:size,total,unit:'bytes'});}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}onProgress?.({loaded:size,total:size,unit:'bytes'});return bytes.buffer;
 };
 window.__RINNE_BOOT__={progress,step,fail,ready:markReady,readAsset};
 // Offline assets live in the host. Read only the selected model and requested clips.
 if(config.offline){
  window.assetBuffer=(id,onProgress)=>new Promise((resolve,reject)=>{
   const requestId=`asset-${++serial}`;
   const entry={resolve,reject,onProgress,timer:setTimeout(()=>{pending.delete(requestId);reject(Error('同梱データの読み込みがタイムアウトしました: '+id));},90000)};
   pending.set(requestId,entry);send('asset-request',{id,requestId});
  });
  window.addEventListener('message',event=>{
   const d=event.data;
   if(event.source!==parent||!d||d.channel!=='rinne-assets-v2'||d.token!==token)return;
   if(target!=='*'&&event.origin!==target)return;
   if(target==='*'&&event.origin!=='null'&&event.origin!==config.hostOrigin)return;
   const entry=pending.get(d.requestId);if(!entry)return;
   if(d.type==='asset-progress'){clearTimeout(entry.timer);entry.timer=setTimeout(()=>{pending.delete(d.requestId);entry.reject(Error('同梱データの読み込みが停止しました'));},90000);entry.onProgress?.(d.progress);return;}
   if(d.type==='asset-data'&&d.buffer instanceof ArrayBuffer){clearTimeout(entry.timer);pending.delete(d.requestId);entry.resolve(d.buffer);}
   else if(d.type==='asset-error'){clearTimeout(entry.timer);pending.delete(d.requestId);entry.reject(Error(d.message||'同梱データを開けませんでした'));}
  });
 }
 window.addEventListener('error',e=>{
  if(e.target?.tagName==='SCRIPT')fail(Error('ゲームのプログラムを読み込めませんでした: '+(e.target.src||'inline')),'SCRIPT_LOAD_FAILED');
  else if(e.message||e.error)fail(e.error||e.message,'JAVASCRIPT_ERROR');
 },true);
 window.addEventListener('unhandledrejection',e=>fail(e.reason,'PROMISE_ERROR'));
 document.addEventListener('webglcontextlost',()=>fail(Error('WebGLの描画接続が失われました。不要なタブを閉じて再試行してください。'),'WEBGL_CONTEXT_LOST'),true);
 if(embedded)timer=setInterval(()=>{if(window.__ATELIER__?.snapshot?.().ready)markReady();},250);
 window.addEventListener('pagehide',()=>{clearInterval(timer);for(const e of pending.values())clearTimeout(e.timer);pending.clear();},{once:true});
 progress({stage:'engine',message:'描画プログラムを読み込んでいます'});
})();
