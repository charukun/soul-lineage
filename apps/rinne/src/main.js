import {sharedEmblemUrl} from '@soul/assets';
import { createWebPlatform } from '@soul/platform-web';
import { createApp } from './app.js';
import { installVillageHostRehearsal } from './village-link.js';
import { installOnlinePlayer } from './online.js';
import { mountTitle } from './title/controller.js';
import {installMusicLibrary} from '@soul/shared-ui/music';

// Build information is injected by the existing monorepo Vite plugin. A standalone
// preview must never claim to be a deployed commit.
const info = typeof __BUILD_INFO__ !== 'undefined' ? __BUILD_INFO__ : {
  name:'輪廻転焦',app:'rinne',environment:'local',commit:'UNBUILT',inputHash:null,
};
const dialog = document.getElementById('village-dialog');
installOnlinePlayer(document.getElementById('village-panel'));
document.getElementById('open-village').addEventListener('click', () => dialog.showModal());
const dispose = mountTitle(info,{emblemURL:sharedEmblemUrl});
// Preserve the existing opt-in host migration rehearsal alongside the title.
let lab, clock;
if (new URLSearchParams(location.search).has('villageHostLab')) {
  const app = createApp(createWebPlatform({gameId:'rinne', environment:info.environment}));
  const canvas = document.getElementById('game');
  let worldTimeMs = 0, last = performance.now();
  const tick = now => { if (!window.__VILLAGE_WORLD_PAUSED__) worldTimeMs += Math.max(0,now-last); last=now; canvas.dataset.worldTimeMs=String(Math.round(worldTimeMs)); clock=requestAnimationFrame(tick); };
  clock=requestAnimationFrame(tick);
  lab=installVillageHostRehearsal({capture:()=>({worldTimeMs:Math.round(worldTimeMs),world:app.world,characters:[],npcs:[],randomState:null}),apply:checkpoint=>{worldTimeMs=checkpoint.worldTimeMs;canvas.dataset.worldRevision=String(checkpoint.world?.revision??'');}});
}
if (import.meta.hot) import.meta.hot.dispose(()=>{cancelAnimationFrame(clock);lab?.then(link=>link.dispose());});
if (import.meta.hot) import.meta.hot.dispose(dispose);

const disposeMusic=installMusicLibrary({game:'rinne',environment:info.environment,defaultTrack:'r01',autoStart:true});
if(import.meta.hot)import.meta.hot.dispose(disposeMusic);
