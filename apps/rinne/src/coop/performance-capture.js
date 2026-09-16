import { createCoopPerformanceProbe } from './performance.js';

const safeClone=value=>value==null?null:structuredClone(value);
const captureMeta=(session,buildInfo)=>({
  schema:'rrp-raw-peer-capture',
  version:1,
  role:session?.role||null,
  worldId:session?.worldId||null,
  buildRevision:String(buildInfo?.commit||'UNBUILT'),
  environment:String(buildInfo?.environment||'local'),
  capturedAt:new Date().toISOString(),
});

export function installRrpPerformanceCapture({
  getSession,
  buildInfo=null,
  now=()=>performance.now(),
  intervalMs=250,
  setIntervalFn=setInterval,
  clearIntervalFn=clearInterval,
  windowRef=globalThis.window,
  documentRef=globalThis.document,
}={}){
  if(typeof getSession!=='function')throw Error('RRP capture requires getSession');
  if(!Number.isFinite(intervalMs)||intervalMs<100||intervalMs>1000)throw Error('Invalid RRP capture interval');
  let disposed=false,lastRaw=null,lastMeta=null;
  const panel=documentRef?.createElement?.('section')||null;
  const status=documentRef?.createElement?.('p')||null;
  const copyButton=documentRef?.createElement?.('button')||null;
  if(panel&&status&&copyButton){
    panel.id='rrp-performance-capture';panel.dataset.rrpCapture='true';panel.setAttribute('aria-label','RRP performance capture');
    Object.assign(panel.style,{position:'fixed',right:'12px',top:'12px',zIndex:'2147483647',padding:'10px 12px',maxWidth:'min(360px,calc(100vw - 24px))',background:'rgba(8,10,13,.9)',color:'#f4f1e8',font:'12px/1.45 system-ui,sans-serif',border:'1px solid rgba(255,255,255,.18)',borderRadius:'8px'});
    const title=documentRef.createElement('strong');title.textContent='RRP physical capture';
    status.textContent='co-op session待機中';status.style.margin='6px 0';
    copyButton.type='button';copyButton.textContent='raw JSONをコピー';copyButton.disabled=true;
    panel.append(title,status,copyButton);documentRef.body?.append(panel);
  }
  function mountPanel(){
    if(!panel||!documentRef?.body)return;const dialog=documentRef.getElementById?.('village-dialog');const target=dialog?.open?dialog:documentRef.body;if(panel.parentNode!==target)target.append(panel);
  }
  function performanceProbeFactory(role){return createCoopPerformanceProbe({role,now});}
  function sample(){
    if(disposed)return null;mountPanel();
    const session=getSession();const raw=session?.performance?.();
    if(raw){lastRaw=safeClone(raw);lastMeta=captureMeta(session,buildInfo);const gaps=Number(raw.bandwidthSkippedBuckets||0);if(status)status.textContent=`${session.role} · ${Math.round((raw.durationMinutes||0)*60)}秒 · ACK ${raw.inputToAuthoritativeAckMs?.length||0} · display ${raw.inputToDisplayMs?.length||0}${gaps?` · gap ${gaps}`:''}`;if(copyButton)copyButton.disabled=false;}
    else if(status){status.textContent=session?'performance probeなし':'co-op session待機中';if(copyButton)copyButton.disabled=true;}
    return raw?safeClone(raw):null;
  }
  function raw(){sample();return lastRaw?Object.freeze({...safeClone(lastRaw),_capture:safeClone(lastMeta)}):null;}
  function json(){const value=raw();return value?JSON.stringify(value,null,2):'';}
  async function copy(){const text=json();if(!text)return false;const clipboard=windowRef?.navigator?.clipboard||globalThis.navigator?.clipboard;if(!clipboard?.writeText)return false;await clipboard.writeText(text);if(status)status.textContent='raw JSONをコピーしました';return true;}
  if(copyButton)copyButton.addEventListener('click',()=>{void copy().catch(error=>{if(status)status.textContent=`copy失敗: ${error.message}`;});});
  const timer=setIntervalFn(sample,intervalMs);sample();
  const api=Object.freeze({performanceProbeFactory,sample,raw,json,copy,dispose(){if(disposed)return;disposed=true;clearIntervalFn(timer);panel?.remove();if(windowRef?.__RRP_CAPTURE__===api)delete windowRef.__RRP_CAPTURE__;}});
  if(windowRef)windowRef.__RRP_CAPTURE__=api;
  return api;
}
