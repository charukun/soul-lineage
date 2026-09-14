import test from 'node:test';
import assert from 'node:assert/strict';
import { isVerifiedAudioRangeAbort, isVerifiedLifecycleAssetAbort, describeFailedRequest } from '../scripts/browser/media-request-contract.mjs';
const origin = 'https://charukun.github.io';
const url = `blob:${origin}/verified-audio`;
const played = new Set([url]);
const record = { url, method: 'GET', resourceType: 'media', errorText: 'net::ERR_ABORTED', status: 206, contentType: 'audio/ogg' };

test('proven same-origin audio range cancellation is classified without dropping its record', () => {
  const before = structuredClone(record);
  assert.equal(isVerifiedAudioRangeAbort(record, played, origin), true);
  assert.deepEqual(record, before);
});
test('actual network, decode, HTTP and model-blob failures remain failures', () => {
  for (const patch of [
    { errorText: 'net::ERR_FAILED' }, { errorText: 'net::ERR_FILE_NOT_FOUND' },
    { resourceType: 'fetch' }, { resourceType: 'image' }, { method: 'POST' },
    { status: null }, { status: 404 }, { status: 500 }, { status: 200 },
    { contentType: null }, { contentType: 'image/png' }, { contentType: 'application/octet-stream' },
    { url: `${origin}/r01.ogg` }, { url: `blob:${origin}/unverified` },
    { url: 'blob:https://other.invalid/verified-audio' }, { url: 'blob:null/verified-audio' }, { url: 'bad-url' }
  ]) assert.equal(isVerifiedAudioRangeAbort({ ...record, ...patch }, played, origin), false, JSON.stringify(patch));
});
test('only explicit successful same-origin model teardown aborts are classified', () => {
  const asset = {url:`${origin}/soul-lineage/dev/rinne/simulator/assets/SHINO_review.vrm`, method:'GET', resourceType:'fetch',
    errorText:'net::ERR_ABORTED', status:200, contentType:'application/octet-stream'};
  assert.equal(isVerifiedLifecycleAssetAbort(asset, origin, true), true);
  assert.equal(isVerifiedLifecycleAssetAbort({...asset,url:`${origin}/asset.glb`,contentType:'model/gltf-binary'}, origin, true), true);
  assert.equal(isVerifiedLifecycleAssetAbort({...asset,url:`${origin}/motion.vrma`,status:206}, origin, true), true);
  for (const [patch, enabled=true, pageOrigin=origin] of [
    [{}, false], [{status:null}], [{status:404}], [{status:500}], [{errorText:'net::ERR_FAILED'}],
    [{method:'POST'}], [{resourceType:'media'}], [{contentType:'text/html'}], [{url:`${origin}/asset.png`}],
    [{url:'https://other.invalid/asset.glb'}], [{url:'bad-url'}]
  ]) assert.equal(isVerifiedLifecycleAssetAbort({...asset,...patch}, pageOrigin, enabled), false, JSON.stringify(patch));
});
test('a URL alone is not playback or origin evidence', () => {
  assert.equal(isVerifiedAudioRangeAbort(record, new Set(), origin), false);
  assert.equal(isVerifiedAudioRangeAbort(record, [url], origin), false);
  assert.equal(isVerifiedAudioRangeAbort(record, played, 'https://other.invalid'), false);
  assert.equal(isVerifiedAudioRangeAbort(null, played, origin), false);
});
test('failed request diagnostics retain response and cancellation details', async () => {
  const request = {
    url: () => url, method: () => 'GET', resourceType: () => 'media', failure: () => ({ errorText: 'net::ERR_ABORTED' }),
    response: async () => ({ status: () => 206, headers: () => ({ 'content-type': 'audio/ogg' }) })
  };
  assert.deepEqual(await describeFailedRequest(request), record);
  assert.deepEqual(await describeFailedRequest({ ...request, response: async () => null }), { ...record, status: null, contentType: null });
});
