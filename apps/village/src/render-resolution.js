/** Keep the actual drawing buffer, not a retired render target, in sync with quality. */
export function syncVillageRenderResolution(view, devicePixelRatio = globalThis.devicePixelRatio) {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? Math.min(devicePixelRatio, 1.5) : 1;
  const scale = Number.isFinite(view.renderScale) && view.renderScale > 0 ? view.renderScale : 1;
  const ratio = dpr * scale;
  // setPixelRatio reallocates buffers; unchanged resize/quality checks must not do so.
  if (Math.abs(view.renderer.getPixelRatio() - ratio) > 1e-6) view.renderer.setPixelRatio(ratio);
  return ratio;
}
