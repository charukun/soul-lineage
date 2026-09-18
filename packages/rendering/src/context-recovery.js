/**
 * Keeps simulation/save state outside the renderer recovery path. Three.js
 * recreates its internal GL state after `webglcontextrestored`; the caller is
 * responsible only for resize/shadow/warmup hooks for app-owned presentation.
 */
export function installWebGLContextRecovery({
  canvas,
  renderer,
  onLost = () => {},
  onRestore = async () => {},
  maxRecoveries = 4,
} = {}) {
  if (!canvas?.addEventListener || !renderer) throw new Error('Context recovery requires canvas and renderer');
  if (!Number.isInteger(maxRecoveries) || maxRecoveries < 1) throw new Error('Invalid context recovery limit');
  let state = 'ready', losses = 0, restores = 0, recovering = null, lastError = null, disposed = false;

  const lost = event => {
    event.preventDefault?.();
    losses++;
    state = losses > maxRecoveries ? 'exhausted' : 'lost';
    canvas.dataset.contextRecovery = state;
    try { onLost({ losses, state }); } catch (error) { lastError = String(error?.message || error); }
  };
  const restored = () => {
    if (disposed || state === 'exhausted') return;
    state = 'restoring'; canvas.dataset.contextRecovery = state;
    recovering = Promise.resolve()
      .then(() => onRestore({ losses, restores }))
      .then(() => {
        restores++;
        state = 'ready';
        lastError = null;
        canvas.dataset.contextRecovery = state;
        renderer.shadowMap && (renderer.shadowMap.needsUpdate = true);
      })
      .catch(error => {
        lastError = String(error?.message || error);
        state = 'failed';
        canvas.dataset.contextRecovery = state;
      })
      .finally(() => { recovering = null; });
  };
  canvas.addEventListener('webglcontextlost', lost, false);
  canvas.addEventListener('webglcontextrestored', restored, false);
  canvas.dataset.contextRecovery = state;

  return {
    snapshot() { return Object.freeze({ state, losses, restores, maxRecoveries, recovering: Boolean(recovering), lastError }); },
    async settled() { if (recovering) await recovering; return this.snapshot(); },
    dispose() {
      disposed = true;
      canvas.removeEventListener('webglcontextlost', lost, false);
      canvas.removeEventListener('webglcontextrestored', restored, false);
      delete canvas.dataset.contextRecovery;
    },
  };
}
