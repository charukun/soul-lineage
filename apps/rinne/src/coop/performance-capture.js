import { createCoopPerformanceProbe } from './performance.js';

const safeClone=value=>value==null?null:structuredClone(value);
const captureMeta=(session,buildInfo,{expectedPeers,windowArmed})=>({
  schema:'rrp-raw-peer-capture',
  version:1,
  role:session?.role||null,
  worldId:session?.worldId||null,
  peerId:session?.selfId||null,
  buildRevision:String(buildInfo?.commit||'UNBUILT'),
  environment:String(buildInfo?.environment||'local'),
  expectedPeers,
  windowArmed:Boolean(windowArmed),
  capturedAt:new Date().toISOString(),
});

export function installRrpPerformanceCapture({
  getSession,
  buildInfo=null,
  now=()=>performance.now(),
  intervalMs=250,
  expectedPeers=null,
  setIntervalFn=setInterval,
  clearIntervalFn=clearInterval,
  windowRef=globalThis.window,
  documentRef=globalThis.document,
}={}){
  if(typeof getSession!=='function')throw Error('RRP capture requires getSession');
  if(!Number.isFinite(intervalMs)||intervalMs<100||intervalMs>1000)throw Error('Invalid RRP capture interval');
  const urlPeers=Number(new URLSearchParams(windowRef?.location?.search||'').get('rrpPeers')),peerTarget=Number.isInteger(expectedPeers)?expectedPeers:Number.isInteger(urlPeers)&&urlPeers>0?urlPeers:2;
  if(!Number.isInteger(peerTarget)||peerTarget<2||peerTarget>30)throw Error('RRP capture expected peers must be 2-30');
  let disposed=false,lastRaw=null,lastMeta=null,activeProbe=null,activeSession=null,windowArmed=false;
  const panel=documentRef?.createElement?.('section')||null;
  const status=documentRef?.createElement?.('p')||null;
  const copyButton=documentRef?.createElement?.('button')||null;
  const resetButton=documentRef?.createElement?.('button')||null;
  if(panel&&status&&copyButton&&resetButton){
    panel.id='rrp-performance-capture';panel.dataset.rrpCapture='true';panel.setAttribute('aria-label','RRP performance capture');
    Object.assign(panel.style,{position:'fixed',right:'12px',top:'12px',zIndex:'2147483647',padding:'10px 12px',maxWidth:'min(360px,calc(100vw - 24px))',background:'rgba(8,10,13,.9)',color:'#f4f1e8',font:'12px/1.45 system-ui,sans-serif',border:'1px solid rgba(255,255,255,.18)',borderRadius:'8px'});
    const title=documentRef.createElement('strong');title.textContent=`RRP physical capture · ${peerTarget} peers`;
    status.textContent='co-op session待機中';status.style.margin='6px 0';
    resetButton.type='button';resetButton.textContent='計測区間を再開始';resetButton.disabled=true;
    copyButton.type='button';copyButton.textContent='raw JSONをコピー';copyButton.disabled=true;
    panel.append(title,status,resetButton,copyButton);documentRef.body?.append(panel);
  }
  function mountPanel(){
    if(!panel||!documentRef?.body)return;const dialog=documentRef.getElementById?.('village-dialog');const target=dialog?.open?dialog:documentRef.body;if(panel.parentNode!==target)target.append(panel);
  }
  function performanceProbeFactory(role){activeProbe=createCoopPerformanceProbe({role,now});activeSession=null;windowArmed=false;return activeProbe;}
  function readyToArm(session){const snapshot=session?.snapshot?.();return snapshot?.phase==='open'&&Number(snapshot?.view?.connected||0)>=peerTarget;}
  function armWindow(session){if(!activeProbe||windowArmed||!readyToArm(session))return false;activeProbe.resetWindow({keepConnections:true});windowArmed=true;lastRaw=null;lastMeta=null;return true;}
  function sample(){
    if(disposed)return null;mountPanel();const session=getSession();
    if(session!==activeSession){activeSession=session;if(session){windowArmed=false;lastRaw=null;lastMeta=null;}else windowArmed=false;}
    armWindow(session);const raw=session?.performance?.();const connected=Number(session?.snapshot?.()?.view?.connected||0);
    if(raw){lastRaw=safeClone(raw);lastMeta=captureMeta(session,buildInfo,{expectedPeers:peerTarget,windowArmed});const gaps=Number(raw.bandwidthSkippedBuckets||0);if(status)status.textContent=windowArmed?`${session.role} · ${Math.round((raw.durationMinutes||0)*60)}秒 · ACK ${raw.inputToAuthoritativeAckMs?.length||0} · display ${raw.inputToDisplayMs?.length||0}${gaps?` · gap ${gaps}`:''}`:`${session.role} · 接続 ${connected}/${peerTarget} · 計測開始待ち`;if(copyButton)copyButton.disabled=!windowArmed;if(resetButton)resetButton.disabled=!windowArmed;}
    else if(status){status.textContent=session?'performance probeなし':lastRaw?'session終了 · 最終capture保持':'co-op session待機中';if(copyButton)copyButton.disabled=!lastRaw;if(resetButton)resetButton.disabled=true;}
    return raw?safeClone(raw):null;
  }
  function reset(){if(!activeProbe||!readyToArm(activeSession))return false;activeProbe.resetWindow({keepConnections:true});windowArmed=true;lastRaw=null;lastMeta=null;sample();return true;}
  function raw(){sample();return lastRaw?Object.freeze({...safeClone(lastRaw),_capture:safeClone(lastMeta)}):null;}
  function json(){const value=raw();return value?JSON.stringify(value,null,2):'';}
  async function copy(){const text=json();if(!text)return false;const clipboard=windowRef?.navigator?.clipboard||globalThis.navigator?.clipboard;if(!clipboard?.writeText)return false;await clipboard.writeText(text);if(status)status.textContent='raw JSONをコピーしました';return true;}
  if(resetButton)resetButton.addEventListener('click',()=>{reset();});
  if(copyButton)copyButton.addEventListener('click',()=>{void copy().catch(error=>{if(status)status.textContent=`copy失敗: ${error.message}`;});});
  const timer=setIntervalFn(sample,intervalMs);sample();
  const api=Object.freeze({performanceProbeFactory,sample,reset,raw,json,copy,armed:()=>windowArmed,expectedPeers:peerTarget,dispose(){if(disposed)return;disposed=true;clearIntervalFn(timer);panel?.remove();if(windowRef?.__RRP_CAPTURE__===api)delete windowRef.__RRP_CAPTURE__;}});
  if(windowRef)windowRef.__RRP_CAPTURE__=api;
  return api;
}
