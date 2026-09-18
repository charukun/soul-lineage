/** Pause only this same-origin solo iframe; preserve the native control's prior state. */
export function acquireSoloPause(frame) {
  if (!frame) return () => {};
  let held = false, released = false, button = null, childDocument = null;
  const isPaused = () => button?.getAttribute('aria-label') === '再開';
  const take = () => {
    if (released || held || !frame.isConnected) return;
    try {
      if(frame.contentWindow?.__RINNE_GAME_PORT__?.session?.().mode==='shared')return;
      childDocument = frame.contentDocument;
      if (!childDocument?.querySelector('#boot')?.hidden) return;
      button = childDocument.getElementById('pauseBtn');
      if (button && !isPaused()) { button.click(); held = isPaused(); }
    } catch { /* A foreign frame is never controlled. */ }
  };
  const ready = event => {
    if (event.source === frame.contentWindow && event.origin === window.location.origin &&
        event.data?.channel === 'rinne-title-v1' && event.data.type === 'ready') take();
  };
  frame.addEventListener('load', take);
  window.addEventListener('message', ready);
  take();
  return () => {
    if (released) return;
    released = true;
    frame.removeEventListener('load', take);
    window.removeEventListener('message', ready);
    const restore = () => {
      if (childDocument?.hidden) return;
      childDocument?.removeEventListener('visibilitychange', restore);
      if (held && frame.isConnected && button?.isConnected && isPaused()) button.click();
      held = false;
    };
    if (held && childDocument?.hidden) childDocument.addEventListener('visibilitychange', restore);
    else restore();
  };
}
