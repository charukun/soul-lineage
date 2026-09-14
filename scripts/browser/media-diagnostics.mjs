import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describeFailedRequest, isVerifiedAudioRangeAbort} from './media-request-contract.mjs';

const root=resolve(new URL('../..',import.meta.url).pathname);
async function capturePerformanceSnapshot(page){
  const result=await page.evaluate(()=>{
    const app=document.querySelector('#game')?.dataset.app||null;
    const source=window.__VILLAGE_ADAPTIVE_QUALITY__||window.__DEMON_ADAPTIVE_QUALITY__;
    return source?.snapshot?{app,snapshot:source.snapshot()}:null;
  }).catch(()=>null);
  if(!result?.app||!result.snapshot?.performance?.samples)return;
  const dir=resolve(root,'test-results/pr-browser');mkdirSync(dir,{recursive:true});
  writeFileSync(resolve(dir,`${result.app}-performance.json`),JSON.stringify({app:result.app,capturedAt:new Date().toISOString(),...result.snapshot},null,2));
}

export async function capturePlayedAudio(page, playedSources) {
  const players = await page.locator('audio').evaluateAll(nodes => nodes.map(p => ({src:p.currentSrc,time:p.currentTime,ready:p.readyState,error:p.error?.code??null})));
  for (const p of players) if (p.src && p.time>0 && p.ready>=2 && p.error===null) playedSources.add(p.src);
  await capturePerformanceSnapshot(page);
}

export async function mediaDiagnostics(requests, playedSources, origin) {
  const requestFailures = await Promise.all(requests.map(describeFailedRequest));
  const expectedMediaAborts = requestFailures.filter(r=>isVerifiedAudioRangeAbort(r,playedSources,origin));
  const failedRequests = requestFailures.filter(r=>!isVerifiedAudioRangeAbort(r,playedSources,origin));
  return {requestFailures,failedRequests,expectedMediaAborts,verifiedAudioSources:[...playedSources]};
}
