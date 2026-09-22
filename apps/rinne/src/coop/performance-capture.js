import { createCoopPerformanceProbe } from './performance.js';

const safeClone=value=>value==null?null:structuredClone(value);
const ADDITIVE_COUNTERS=new Set(['bandwidthSkippedBuckets','connectionAttempts','connectionSuccesses','turnCandidateClassifiedConnections','turnRelayConnections','durationMinutes']);
const cleanWorkload=value=>String(value||'manual-v1').trim().slice(0,80).replace(/[^a-zA-Z0-9._-]+/g,'-')||'manual-v1';
const mergeSnapshots=(segments,current)=>{
  const rows=[...segments,current].filter(Boolean),merged={};
  for(const row of rows)for(const [key,value]of Object.entries(row)){
    if(Array.isArray(value)){merged[key]??=[];merged[key].push(...value);}
    else if(ADDITIVE_COUNTERS.has(key))merged[key]=Number(merged[key]||0)+Number(value||0);
    else merged[key]=value;
  }
  return merged;
};
const captureMeta=(session,buildInfo,{expectedPeers,windowArmed,workloadId,variant,rpoSeconds,measurementStartedAt,capabilities})=>({
  schema:'rrp-raw-peer-capture',version:1,role:session?.role||null,worldId:session?.worldId||null,peerId:session?.selfId||null,
  buildRevision:String(buildInfo?.commit||'UNBUILT'),environment:String(buildInfo?.environment||'local'),expectedPeers,windowArmed:Boolean(windowArmed),
  workloadId,variant,rpoSeconds,encoding:'json-utf8',compression:'none',measurementStartedAt:measurementStartedAt||null,capturedAt:new Date().toISOString(),capabilities:safeClone(capabilities),
});

export function installRrpPerformanceCapture({getSession,buildInfo=null,now=()=>performance.now(),intervalMs=250,expectedPeers=null,setIntervalFn=setInterval,clearIntervalFn=clearInterval,windowRef=globalThis.window,documentRef=globalThis.document}={}){
  if(typeof getSession!=='function')throw Error('RRP capture requires getSession');if(!Number.isFinite(intervalMs)||intervalMs<100||intervalMs>1000)throw Error('Invalid RRP capture interval');
  const params=new URLSearchParams(windowRef?.location?.search||''),urlPeers=Number(params.get('rrpPeers')),peerTarget=Number.isInteger(expectedPeers)?expectedPeers:Number.isInteger(urlPeers)&&urlPeers>0?urlPeers:2;if(!Number.isInteger(peerTarget)||peerTarget<2||peerTarget>30)throw Error('RRP capture expected peers must be 2-30');
  const workloadId=cleanWorkload(params.get('rrpWorkload')),variant=String(params.get('rrpVariant')||'shadow-only'),rpoSeconds=Number(params.get('rrpRpo')||2);
  const variants=new Set(['shadow-only','all-state-strong','semantic-journal','fair-known-event-sourcing']);if(!variants.has(variant))throw Error('Unknown RRP capture variant');if(!Number.isFinite(rpoSeconds)||rpoSeconds<.5||rpoSeconds>30)throw Error('RRP provisional RPO must be 0.5-30 seconds');
  let disposed=false,lastRaw=null,lastMeta=null,lastDiagnostics=null,activeProbe=null,activeSession=null,activeRole=null,windowArmed=false,measurementStarted=false,measurementStartedAt=null,outageStartedAt=null;
  let segments=[],pendingBootstrapPayload=null,pendingSemanticSamples=[],variantBootstrapped=false,lastProvisionalAt=null,variantSequence=0;const measurementKeys=new Set();
  const variantRaw={variantCommitMs:[],variantCommitBytes:[],variantProtectedCommitMs:[],variantProtectedBytes:[],variantProvisionalWriteMs:[],variantProvisionalBytes:[],variantBootstrapMs:[],variantBootstrapBytes:[],variantErrors:[]};
  const panel=documentRef?.createElement?.('section')||null,status=documentRef?.createElement?.('p')||null,copyButton=documentRef?.createElement?.('button')||null,downloadButton=documentRef?.createElement?.('button')||null,resetButton=documentRef?.createElement?.('button')||null,workloadButton=documentRef?.createElement?.('button')||null;
  if(panel&&status&&copyButton&&downloadButton&&resetButton&&workloadButton){panel.id='rrp-performance-capture';panel.dataset.rrpCapture='true';panel.setAttribute('aria-label','RRP performance capture');Object.assign(panel.style,{position:'fixed',right:'12px',top:'12px',zIndex:'2147483647',padding:'10px 12px',maxWidth:'min(360px,calc(100vw - 24px))',background:'rgba(8,10,13,.9)',color:'#f4f1e8',font:'12px/1.45 system-ui,sans-serif',border:'1px solid rgba(255,255,255,.18)',borderRadius:'8px'});const title=documentRef.createElement('strong');title.textContent=`RRP capture · ${workloadId} · ${variant} · ${peerTarget} peers`;status.textContent='co-op session待機中';status.style.margin='6px 0';resetButton.type='button';resetButton.textContent='計測区間を再開始';resetButton.disabled=true;workloadButton.type='button';workloadButton.textContent='seal→rebirthを実行';workloadButton.disabled=true;copyButton.type='button';copyButton.textContent='raw JSONをコピー';copyButton.disabled=true;downloadButton.type='button';downloadButton.textContent='raw JSONを保存';downloadButton.disabled=true;panel.append(title,status,workloadButton,resetButton,copyButton,downloadButton);documentRef.body?.append(panel);}
  function mountPanel(){if(!panel||!documentRef?.body)return;const dialog=documentRef.getElementById?.('village-dialog'),target=dialog?.open?dialog:documentRef.body;if(panel.parentNode!==target)target.append(panel);}
  const byteLength=text=>new TextEncoder().encode(text).byteLength;
  const pushVariant=(key,value)=>{if(Number.isFinite(value)&&value>=0)variantRaw[key].push(value);};
  const measurementStorage=()=>windowRef?.localStorage||null;
  function clearMeasurementStorage(){const storage=measurementStorage();if(!storage?.removeItem)return;for(const key of measurementKeys)try{storage.removeItem(key);}catch{}measurementKeys.clear();}
  function measuredWrite(kind,text,{protectedCommit=false,append=false}={}){
    if(variant==='shadow-only')return false;const storage=measurementStorage();if(!storage?.setItem){variantRaw.variantErrors.push('localStorage unavailable');return false;}
    const worldId=getSession()?.worldId||'pending',suffix=append?`${kind}:${++variantSequence}`:kind,key=`__rinne_rrp_measure__:${workloadId}:${variant}:${worldId}:${suffix}`,bytes=byteLength(text),start=now();
    try{storage.setItem(key,text);measurementKeys.add(key);const elapsed=Math.max(0,now()-start);
      if(kind==='bootstrap'){pushVariant('variantBootstrapMs',elapsed);pushVariant('variantBootstrapBytes',bytes);}
      else if(kind==='provisional'){pushVariant('variantProvisionalWriteMs',elapsed);pushVariant('variantProvisionalBytes',bytes);}
      else{pushVariant('variantCommitMs',elapsed);pushVariant('variantCommitBytes',bytes);if(protectedCommit){pushVariant('variantProtectedCommitMs',elapsed);pushVariant('variantProtectedBytes',bytes);}}
      return true;
    }catch(error){variantRaw.variantErrors.push(String(error?.message||error).slice(0,180));return false;}
  }
  function runBootstrap(){if(variantBootstrapped||variant==='shadow-only'||!pendingBootstrapPayload)return;const text=JSON.stringify(pendingBootstrapPayload);if(measuredWrite('bootstrap',text)){variantBootstrapped=true;if(variant!=='all-state-strong')lastProvisionalAt=now();}}
  function measureSemanticSample(sample){
    if(!sample||variant==='shadow-only')return false;runBootstrap();const events=Number(sample.eventCount||0),protectedCommit=Number.isSafeInteger(events)&&events>0;
    if(variant==='all-state-strong')measuredWrite('checkpoint',JSON.stringify(sample.checkpointPayload),{protectedCommit});
    else{
      if(protectedCommit)measuredWrite('event',JSON.stringify(sample.journalPayload),{protectedCommit:true,append:true});
      if(lastProvisionalAt==null||now()-lastProvisionalAt>=rpoSeconds*1000){if(measuredWrite('provisional',JSON.stringify(sample.checkpointPayload)))lastProvisionalAt=now();}
    }
    return true;
  }
  function replayPendingSemantic(){if(!measurementStarted||!pendingSemanticSamples.length)return;const rows=pendingSemanticSamples;pendingSemanticSamples=[];for(const sample of rows)measureSemanticSample(sample);}
  function semanticMeasurement(sample){
    if(!sample||typeof sample!=='object')return false;if(sample.warmStart){pendingBootstrapPayload=safeClone(sample.checkpointPayload);if(measurementStarted)runBootstrap();return true;}
    if(!measurementStarted){pendingSemanticSamples.push(safeClone(sample));if(pendingSemanticSamples.length>32)pendingSemanticSamples.splice(0,pendingSemanticSamples.length-32);return true;}
    return measureSemanticSample(sample);
  }
  function stashProbe(){if(activeProbe&&measurementStarted)segments.push(activeProbe.snapshot());}
  function performanceProbeFactory(role){
    if(activeProbe&&role!==activeRole){segments=[];measurementStarted=false;measurementStartedAt=null;outageStartedAt=null;pendingBootstrapPayload=null;pendingSemanticSamples=[];variantBootstrapped=false;lastProvisionalAt=null;variantSequence=0;for(const key of Object.keys(variantRaw))variantRaw[key].length=0;clearMeasurementStorage();}
    else stashProbe();
    activeProbe=createCoopPerformanceProbe({role,now});activeRole=role;activeSession=null;windowArmed=false;lastRaw=null;lastMeta=null;lastDiagnostics=null;return activeProbe;
  }
  function readyToArm(session){const snapshot=session?.snapshot?.();return snapshot?.phase==='open'&&Number(snapshot?.view?.connected||0)>=peerTarget;}
  function resetMeasurement(){activeProbe?.resetWindow({keepConnections:true});segments=[];measurementStarted=false;measurementStartedAt=null;outageStartedAt=null;windowArmed=false;lastRaw=null;lastMeta=null;lastDiagnostics=null;pendingSemanticSamples=[];variantBootstrapped=false;lastProvisionalAt=null;variantSequence=0;for(const key of Object.keys(variantRaw))variantRaw[key].length=0;clearMeasurementStorage();}
  function armWindow(session){
    if(!activeProbe||windowArmed||!readyToArm(session))return false;
    if(!measurementStarted){activeProbe.resetWindow({keepConnections:true});segments=[];measurementStarted=true;measurementStartedAt=new Date().toISOString();runBootstrap();replayPendingSemantic();}
    windowArmed=true;
    if(activeRole==='peer'&&outageStartedAt!=null){activeProbe.recordHostReopen(Math.max(0,now()-outageStartedAt));outageStartedAt=null;}
    return true;
  }
  function combinedRaw(){return activeProbe?mergeSnapshots(segments,activeProbe.snapshot()):segments.length?mergeSnapshots(segments,null):null;}
  function sample(){
    if(disposed)return null;mountPanel();const session=getSession();
    if(session!==activeSession)activeSession=session;
    const ready=readyToArm(session);
    if(windowArmed&&!ready){windowArmed=false;if(measurementStarted&&activeRole==='peer'&&outageStartedAt==null)outageStartedAt=now();}
    armWindow(session);
    const memory=Number(windowRef?.performance?.memory?.usedJSHeapSize);if(measurementStarted&&activeProbe&&Number.isFinite(memory)&&memory>=0)activeProbe.recordMemory(memory/1024/1024);
    const raw=combinedRaw(),connected=Number(session?.snapshot?.()?.view?.connected||0);if(raw)for(const[key,value]of Object.entries(variantRaw))raw[key]=safeClone(value);lastDiagnostics=safeClone(session?.diagnostics?.()??lastDiagnostics);
    if(raw){
      const capabilities={memoryMb:Array.isArray(raw.memoryMb)&&raw.memoryMb.length>0,gpuMs:Array.isArray(raw.gpuMs)&&raw.gpuMs.length>0,batteryPctPerHour:Array.isArray(raw.batteryPctPerHour)&&raw.batteryPctPerHour.length>0,turnCandidateStats:Number(raw.turnCandidateClassifiedConnections||0)>0};
      lastRaw=safeClone(raw);lastMeta=captureMeta(session,buildInfo,{expectedPeers:peerTarget,windowArmed,workloadId,variant,rpoSeconds,measurementStartedAt,capabilities});
      const gaps=Number(raw.bandwidthSkippedBuckets||0);if(status)status.textContent=measurementStarted?`${session?.role||activeRole||'?'} · ${Math.round((raw.durationMinutes||0)*60)}秒 · 接続 ${connected}/${peerTarget} · ACK ${raw.inputToAuthoritativeAckMs?.length||0} · protected ${raw.semanticEventCount?.reduce((a,b)=>a+Number(b||0),0)||0}${windowArmed?'':' · 再接続待ち'}${gaps?` · gap ${gaps}`:''}`:`${session?.role||activeRole||'?'} · 接続 ${connected}/${peerTarget} · 計測開始待ち`;
      if(copyButton)copyButton.disabled=!measurementStarted;if(downloadButton)downloadButton.disabled=!measurementStarted;if(resetButton)resetButton.disabled=!measurementStarted;if(workloadButton)workloadButton.disabled=!(measurementStarted&&windowArmed&&session?.role==='host'&&typeof session?.captureProtectedCycle==='function');
    }else if(status){status.textContent=session?'performance probeなし':'co-op session待機中';if(copyButton)copyButton.disabled=true;if(downloadButton)downloadButton.disabled=true;if(resetButton)resetButton.disabled=true;if(workloadButton)workloadButton.disabled=true;}
    return raw?safeClone(raw):null;
  }
  function reset(){if(!activeProbe||!readyToArm(activeSession))return false;resetMeasurement();return armWindow(activeSession);}
  function raw(){sample();return lastRaw?Object.freeze({...safeClone(lastRaw),_capture:safeClone(lastMeta),_diagnostics:safeClone(lastDiagnostics)}):null;}
  function json(){const value=raw();return value?JSON.stringify(value,null,2):'';}
  async function copy(){const text=json();if(!text)return false;const clipboard=windowRef?.navigator?.clipboard||globalThis.navigator?.clipboard;if(!clipboard?.writeText)return false;await clipboard.writeText(text);if(status)status.textContent='raw JSONをコピーしました';return true;}
  function download(){
    const text=json();if(!text||!documentRef?.createElement||typeof Blob==='undefined'||!windowRef?.URL?.createObjectURL)return false;
    const blob=new Blob([text],{type:'application/json'}),url=windowRef.URL.createObjectURL(blob),anchor=documentRef.createElement('a'),meta=lastMeta||{};
    anchor.href=url;anchor.download=`rinne-${workloadId}-${meta.role||activeRole||'peer'}-${String(meta.peerId||'unknown').replace(/[^a-zA-Z0-9._-]+/g,'-')}.json`;anchor.hidden=true;documentRef.body?.append(anchor);anchor.click();anchor.remove();windowRef.URL.revokeObjectURL(url);if(status)status.textContent='raw JSONを保存しました';return true;
  }
  if(workloadButton)workloadButton.addEventListener('click',()=>{const session=getSession();workloadButton.disabled=true;Promise.resolve(session?.captureProtectedCycle?.()).then(ok=>{if(status)status.textContent=ok?'life seal→rebirthを確定しました':'protected cycleを実行できませんでした';sample();}).catch(error=>{if(status)status.textContent=`protected cycle失敗: ${error.message}`;sample();});});if(resetButton)resetButton.addEventListener('click',()=>{reset();});if(copyButton)copyButton.addEventListener('click',()=>{void copy().catch(error=>{if(status)status.textContent=`copy失敗: ${error.message}`;});});if(downloadButton)downloadButton.addEventListener('click',()=>{try{if(!download()&&status)status.textContent='保存に対応していないブラウザです';}catch(error){if(status)status.textContent=`保存失敗: ${error.message}`;}});
  const timer=setIntervalFn(sample,intervalMs);sample();const api=Object.freeze({performanceProbeFactory,semanticMeasurement,runProtectedCycle:()=>getSession()?.captureProtectedCycle?.()??Promise.resolve(false),sample,reset,raw,json,copy,download,armed:()=>windowArmed,expectedPeers:peerTarget,workloadId,variant,rpoSeconds,dispose(){if(disposed)return;disposed=true;clearIntervalFn(timer);panel?.remove();if(windowRef?.__RRP_CAPTURE__===api)delete windowRef.__RRP_CAPTURE__;}});if(windowRef)windowRef.__RRP_CAPTURE__=api;return api;
}
