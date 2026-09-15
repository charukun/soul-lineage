const params = new URLSearchParams(location.search);
if (params.get('embed') === '1') {
  document.documentElement.classList.add('embedded-review');
  const $ = id => document.getElementById(id);
  const parentOrigin = location.origin;
  let lastSent = 0;
  const modeLabels = {posture:'構え・移動',sequence:'30秒演舞',combination:'7連撃',baseline:'技ごと比較',single:'技単体'};

  function snapshot() {
    const play = $('play'), timeline = $('timeline'), compare = $('compare-reference');
    const status = $('motion-status')?.textContent || '';
    return {
      ready: !play?.disabled,
      weapon: $('weapon-kind')?.value || 'sword',
      handDetail: Boolean($('hand-detail')?.checked),
      mode: $('mode')?.value || 'sequence',
      playing: play?.getAttribute('aria-pressed') === 'true',
      speed: Number($('speed')?.value || 1),
      repeat: Boolean($('repeat')?.checked),
      compare: Boolean(compare?.checked),
      canCompare: !compare?.disabled,
      trail: Boolean($('trail')?.checked),
      view: [...document.querySelectorAll('[data-view]')].find(button => button.getAttribute('aria-pressed') === 'true')?.dataset.view || 'three',
      time: Number(timeline?.value || 0),
      duration: Number(timeline?.max || 0),
      label: $('phase-label')?.textContent || modeLabels[$('mode')?.value] || '演舞',
      timeLabel: $('time-label')?.textContent || '',
      status,
      error: /表示できませんでした|中断しました|読み込めません/.test(status)
    };
  }

  function postState(force = false) {
    const now = performance.now();
    if (!force && now - lastSent < 120) return;
    lastSent = now;
    parent.postMessage({type:'visual-review-performance-state', state:snapshot()}, parentOrigin);
  }

  function setMode(value) {
    const select = $('mode');
    if (!select || !['posture','sequence','combination','baseline'].includes(value)) return;
    select.value = value;
    select.onchange?.({target:select});
  }

  function setPlaying(value) {
    const play = $('play');
    const playing = play?.getAttribute('aria-pressed') === 'true';
    if (play && Boolean(value) !== playing) play.click();
  }

  window.addEventListener('message', event => {
    if (event.origin !== parentOrigin || event.source !== parent) return;
    const data = event.data;
    if (data?.type !== 'visual-review-performance-control') return;
    switch (data.command) {
      case 'state': break;
      case 'weapon': {const select=$('weapon-kind');if(select&&!select.disabled&&['sword','great','katana','spear','axe'].includes(data.value)){select.value=data.value;select.onchange?.({target:select});}break;}
      case 'hand-detail': if($('hand-detail')){$('hand-detail').checked=Boolean(data.value);$('hand-detail').onchange?.();}break;
      case 'mode': setMode(data.value); break;
      case 'play-toggle': $('play')?.click(); break;
      case 'play': setPlaying(true); break;
      case 'pause': setPlaying(false); break;
      case 'restart': $('restart')?.click(); break;
      case 'speed': {
        const speed = $('speed');
        if (speed && ['1','0.5','0.25'].includes(String(data.value))) { speed.value = String(data.value); speed.onchange?.({target:speed}); }
        break;
      }
      case 'repeat': if ($('repeat')) $('repeat').checked = Boolean(data.value); break;
      case 'compare': if ($('compare-reference') && !$('compare-reference').disabled) { $('compare-reference').checked = Boolean(data.value); $('compare-reference').onchange?.(); } break;
      case 'trail': if ($('trail')) { $('trail').checked = Boolean(data.value); $('trail').onchange?.(); } break;
      case 'seek': {
        const timeline = $('timeline');
        const value = Number(data.value);
        if (timeline && Number.isFinite(value)) { timeline.value = String(Math.min(Number(timeline.max || value), Math.max(0,value))); timeline.oninput?.({target:timeline}); }
        break;
      }
      case 'step': (Number(data.value) < 0 ? $('previous-frame') : $('next-frame'))?.click(); break;
      case 'view': document.querySelector(`[data-view="${String(data.value)}"]`)?.click(); break;
    }
    postState(true);
  });

  function loop() {
    postState(false);
    requestAnimationFrame(loop);
  }
  window.addEventListener('load', () => postState(true), {once:true});
  requestAnimationFrame(loop);
}
