import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describeFailedRequest, isVerifiedAudioRangeAbort} from './media-request-contract.mjs';

const root=resolve(new URL('../..',import.meta.url).pathname);
async function capturePerformanceSnapshot(page){
  const result=await page.evaluate(()=>{
    const app=document.querySelector('#game')?.dataset.app||null;
    const source=window.__VILLAGE_ADAPTIVE_QUALITY__||window.__DEMON_ADAPTIVE_QUALITY__;
    const resilience=window.__VILLAGE_RUNTIME_RESILIENCE__||window.__DEMON_RUNTIME_RESILIENCE__;
    const worldScale=window.__VILLAGE_WORLD_SCALE__||window.__DEMON_WORLD_SCALE__;
    const simulation=window.__VILLAGE_SIMULATION_SCALE__||window.__DEMON_CPU_SCALE__;
    const network=window.__VILLAGE_NETWORK_SCALE__||window.__DEMON_NETWORK_SCALE__;
    const audioWorklet=window.__DEMON_AUDIO_WORKLET__;
    const save=window.village?.save&&window.village?.sim?window.village?.storeDiagnostics?.()||null:null;
    return source?.snapshot?{app,snapshot:source.snapshot(),resilience:resilience?.snapshot?.()||null,worldScale:worldScale?.snapshot?.()||null,simulation:simulation?.snapshot?.()||null,network:network?.snapshot?.()||null,audioWorklet:audioWorklet?.snapshot?.()||null,save}:null;
  }).catch(()=>null);
  if(!result?.app||!result.snapshot?.performance?.samples)return;
  const dir=resolve(root,'test-results/pr-browser');mkdirSync(dir,{recursive:true});
  writeFileSync(resolve(dir,`${result.app}-performance.json`),JSON.stringify({app:result.app,capturedAt:new Date().toISOString(),...result.snapshot,resilience:result.resilience,worldScale:result.worldScale,simulation:result.simulation,network:result.network,audioWorklet:result.audioWorklet,save:result.save},null,2));
  if(result.resilience?.leak?.pass===false)throw new Error(`Renderer resource leak gate failed for ${result.app}: ${JSON.stringify(result.resilience.leak.errors||[])}`);
  if(result.resilience?.context?.state&&['failed','exhausted'].includes(result.resilience.context.state))throw new Error(`WebGL context recovery unhealthy for ${result.app}: ${result.resilience.context.state}`);
  if(result.resilience?.shader?.lastError)throw new Error(`Shader warmup failed for ${result.app}: ${result.resilience.shader.lastError}`);
  if((result.simulation?.profiler?.errors||result.simulation?.errors||0)>0)throw new Error(`Runtime profiler recorded errors for ${result.app}`);
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
