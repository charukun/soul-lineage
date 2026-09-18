const SESSION_KEY = 'soul:demon:title-cinematic-seen:v1';
const MOTION_KEY = 'soul:demon:title-motion:v1';

export function titleCinematicPolicy({allowIntro=true,reducedMotion=false,effectsEnabled=true,introSeen=false}={}) {
  return {
    playIntro: Boolean(allowIntro && !reducedMotion && effectsEnabled && !introSeen),
    playLiving: Boolean(!reducedMotion && effectsEnabled)
  };
}

function readFlag(storage,key) {
  try { return storage?.getItem(key) === '1'; } catch { return false; }
}
function writeFlag(storage,key,value) {
  try { storage?.setItem(key,value ? '1' : '0'); } catch {}
}

export function createTitleCinematic({root,title}) {
  const intro = root.querySelector('#title-intro-video');
  const living = root.querySelector('#title-living-video');
  const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  let stage = 'idle';
  let titleTimer = 0;
  let livingRestartTimer = 0;
  let introSafetyTimer = 0;
  let generation = 0;
  let mediaReadyPromise = null;
  const blobUrls = [];

  const ensureMediaSources = async () => {
    if (intro.src && living.src) return true;
    if (!mediaReadyPromise) mediaReadyPromise = (async () => {
      const response = await fetch('./assets/title/jinkai-cinematic-carrier.png',{cache:'force-cache'});
      if (!response.ok) throw new Error(`cinematic carrier ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const view = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
      const chunks = new Map();
      let offset = 8;
      while (offset + 12 <= bytes.length) {
        const length = view.getUint32(offset);
        const type = String.fromCharCode(...bytes.subarray(offset + 4,offset + 8));
        const start = offset + 8, end = start + length;
        if (end + 4 > bytes.length) break;
        if (type === 'jiIN' || type === 'jiLV') chunks.set(type,bytes.slice(start,end));
        offset = end + 4;
      }
      if (!chunks.has('jiIN') || !chunks.has('jiLV')) throw new Error('cinematic media chunks missing');
      const introUrl = URL.createObjectURL(new Blob([chunks.get('jiIN')],{type:'video/mp4'}));
      const livingUrl = URL.createObjectURL(new Blob([chunks.get('jiLV')],{type:'video/mp4'}));
      blobUrls.push(introUrl,livingUrl); intro.src=introUrl; living.src=livingUrl; intro.load(); living.load();
      return true;
    })().catch(error => { console.warn('[尽喰廻遊 cinematic]',error); return false; });
    return mediaReadyPromise;
  };
  addEventListener('pagehide',()=>{for(const url of blobUrls)URL.revokeObjectURL(url);blobUrls.length=0;},{once:true});

  const introSeen = () => readFlag(globalThis.sessionStorage,SESSION_KEY);
  const effectsEnabled = () => {
    try { return globalThis.localStorage?.getItem(MOTION_KEY) !== 'off'; }
    catch { return true; }
  };
  const setEffectsEnabled = enabled => {
    try { globalThis.localStorage?.setItem(MOTION_KEY,enabled ? 'on' : 'off'); } catch {}
    if (stage !== 'game') void enter({allowIntro:false});
    return effectsEnabled();
  };
  const clearTimers = () => {
    clearTimeout(titleTimer); clearTimeout(livingRestartTimer); clearTimeout(introSafetyTimer);
  };
  const pauseMedia = () => {
    intro.pause(); living.pause();
    intro.onended = null; living.onended = null;
  };
  const revealTitle = animated => {
    title.hidden = false;
    title.dataset.stage = animated ? 'logo' : 'menu';
    if (!animated) return;
    titleTimer = setTimeout(() => { if (!title.hidden) title.dataset.stage = 'menu'; }, 820);
  };
  const playLiving = async token => {
    if (token !== generation) return;
    const policy = titleCinematicPolicy({allowIntro:false,reducedMotion:!!reduced?.matches,effectsEnabled:effectsEnabled(),introSeen:true});
    if (!policy.playLiving) { root.dataset.state = 'poster'; return; }
    if (!await ensureMediaSources()) { root.dataset.state = 'poster'; return; }
    root.dataset.state = 'living';
    living.currentTime = 0;
    living.onended = () => {
      if (token !== generation || stage === 'game') return;
      root.dataset.state = 'poster';
      // Hold the exact poster for a different span each time, so the living still
      // never advertises a clockwork loop cadence.
      const delay = 1800 + Math.round(Math.random() * 2600);
      livingRestartTimer = setTimeout(() => { void playLiving(token); },delay);
    };
    try { await living.play(); }
    catch { root.dataset.state = 'poster'; }
  };
  const settle = ({animated=true}={}) => {
    clearTimeout(introSafetyTimer);
    stage = 'living';
    root.dataset.state = 'poster';
    const token = generation;
    revealTitle(animated && !reduced?.matches);
    void playLiving(token);
  };
  const fallback = () => {
    if (stage === 'game') return;
    pauseMedia(); root.dataset.state = 'poster'; settle({animated:false});
  };

  intro.addEventListener('error',fallback);
  living.addEventListener('error',() => { if (stage !== 'game') root.dataset.state = 'poster'; });
  reduced?.addEventListener?.('change',() => { if (stage !== 'game') void enter({allowIntro:false}); });

  async function enter({allowIntro=true}={}) {
    const token = ++generation;
    clearTimers(); pauseMedia();
    stage = 'entering';
    document.body.dataset.titleSurface = 'true';
    root.hidden = false; root.dataset.state = 'poster';
    title.hidden = true; title.dataset.stage = 'hidden';
    const policy = titleCinematicPolicy({allowIntro,reducedMotion:!!reduced?.matches,effectsEnabled:effectsEnabled(),introSeen:introSeen()});
    if (!policy.playIntro) { settle({animated:true}); return; }
    writeFlag(globalThis.sessionStorage,SESSION_KEY,true);
    stage = 'intro'; root.dataset.state = 'intro';
    if (!await ensureMediaSources()) { if (token === generation) fallback(); return; }
    intro.currentTime = 0;
    intro.onended = () => { if (token === generation) settle({animated:true}); };
    // A decode stall must never strand the player behind an invisible title.
    introSafetyTimer = setTimeout(() => { if (token === generation && stage === 'intro') fallback(); },15500);
    try { await intro.play(); }
    catch { if (token === generation) fallback(); }
  }

  function leaveForGame() {
    generation++; clearTimers(); pauseMedia();
    stage = 'game'; root.hidden = true; title.hidden = true;
    delete document.body.dataset.titleSurface;
  }

  return {
    enter, leaveForGame, effectsEnabled, setEffectsEnabled,
    toggleEffects: () => setEffectsEnabled(!effectsEnabled()),
    snapshot: () => ({stage,rootState:root.dataset.state,titleStage:title.dataset.stage,introSeen:introSeen(),effectsEnabled:effectsEnabled(),reducedMotion:!!reduced?.matches,introTime:intro.currentTime,livingTime:living.currentTime})
  };
}

export function installTitleCinematic() {
  const root=document.getElementById('title-cinematic');
  const title=document.getElementById('title');
  const hud=document.getElementById('hud');
  const sheet=document.getElementById('sheet');
  if(!root||!title||!hud||!sheet)return null;
  const controller=createTitleCinematic({root,title});
  let syncQueued=false;
  const syncSheet=()=>{
    syncQueued=false;
    const onTitle=!root.hidden&&hud.hidden;
    sheet.dataset.surface=onTitle?'title':'hunt';
    if(onTitle&&!sheet.hidden&&sheet.dataset.kind==='settings'){
      let toggle=document.getElementById('title-motion-toggle');
      if(!toggle){
        toggle=document.createElement('button');
        toggle.className='inline-action'; toggle.id='title-motion-toggle';
        sheet.querySelector('#sheet-body')?.append(toggle);
        toggle.onclick=()=>{controller.toggleEffects(); toggle.textContent=`背景演出：${controller.effectsEnabled()?'入':'切'}`;};
      }
      toggle.textContent=`背景演出：${controller.effectsEnabled()?'入':'切'}`;
    }
  };
  const queueSync=()=>{if(!syncQueued){syncQueued=true;queueMicrotask(syncSheet);}};
  const titleObserver=new MutationObserver(()=>{
    const state=controller.snapshot().stage;
    if(!title.hidden&&hud.hidden&&state==='game')void controller.enter({allowIntro:false});
    else if(title.hidden&&!hud.hidden&&state!=='game')controller.leaveForGame();
    queueSync();
  });
  titleObserver.observe(title,{attributes:true,attributeFilter:['hidden','data-stage']});
  titleObserver.observe(hud,{attributes:true,attributeFilter:['hidden']});
  const sheetObserver=new MutationObserver(queueSync);
  sheetObserver.observe(sheet,{attributes:true,attributeFilter:['hidden','data-kind'],subtree:true,childList:true});
  window.__TITLE_CINEMATIC__={...controller,showTitle:()=>controller.enter({allowIntro:false})};
  void controller.enter({allowIntro:true});
  queueSync();
  return controller;
}
