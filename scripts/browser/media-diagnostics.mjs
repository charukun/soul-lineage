import {describeFailedRequest, isVerifiedAudioRangeAbort} from './media-request-contract.mjs';

export async function capturePlayedAudio(page, playedSources) {
  const players = await page.locator('audio').evaluateAll(nodes => nodes.map(p => ({src:p.currentSrc,time:p.currentTime,ready:p.readyState,error:p.error?.code??null})));
  for (const p of players) if (p.src && p.time>0 && p.ready>=2 && p.error===null) playedSources.add(p.src);
}

export async function mediaDiagnostics(requests, playedSources, origin) {
  const requestFailures = await Promise.all(requests.map(describeFailedRequest));
  const expectedMediaAborts = requestFailures.filter(r=>isVerifiedAudioRangeAbort(r,playedSources,origin));
  const failedRequests = requestFailures.filter(r=>!isVerifiedAudioRangeAbort(r,playedSources,origin));
  return {requestFailures,failedRequests,expectedMediaAborts,verifiedAudioSources:[...playedSources]};
}
