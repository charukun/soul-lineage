/** Only a successfully played, same-origin local audio range may be aborted by
 * the media demuxer. HTTP failures, model blobs and unproven audio still fail.
 */
export function isVerifiedAudioRangeAbort(record, playedSources, pageOrigin) {
  if (!record || record.method !== 'GET' || record.resourceType !== 'media' ||
      record.errorText !== 'net::ERR_ABORTED' || record.status !== 206 ||
      typeof record.contentType !== 'string' || !/^audio\//i.test(record.contentType) ||
      !(playedSources instanceof Set) || !playedSources.has(record.url)) return false;
  try {
    const url = new URL(record.url);
    return url.protocol === 'blob:' && url.origin !== 'null' && url.origin === pageOrigin;
  } catch { return false; }
}

/** Snapshot before asserting, so unexpected failures remain in the artifact. */
export async function describeFailedRequest(request) {
  const response = await request.response();
  return { url: request.url(), method: request.method(), resourceType: request.resourceType(),
    errorText: request.failure()?.errorText ?? 'unknown', status: response?.status() ?? null,
    contentType: response?.headers()['content-type'] ?? null };
}
