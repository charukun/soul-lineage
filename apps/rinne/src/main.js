if(new URL(location.href).searchParams.has('villageHostLab'))location.replace(new URL('./village-rehearsal.html'+location.search,location.href));
import {sharedEmblemUrl} from '@soul/assets';
import { mountTitle } from './title/controller.js';
// Build information is injected by the existing monorepo Vite plugin. A standalone
// preview must never claim to be a deployed commit.
const info = typeof __BUILD_INFO__ !== 'undefined' ? __BUILD_INFO__ : {
  name:'輪廻転焦',app:'rinne',environment:'local',commit:'UNBUILT',inputHash:null,
};
const dispose = mountTitle(info,{emblemURL:sharedEmblemUrl});
if (import.meta.hot) import.meta.hot.dispose(dispose);

import {installOnlinePlayer} from './online.js';
const onlineDialog=document.querySelector('#online-dialog');
let disposeOnline;
document.querySelector('#open-online').addEventListener('click',()=>{
 if(!disposeOnline)disposeOnline=installOnlinePlayer({mount:document.querySelector('#online-mount'),environment:info.environment});
 onlineDialog.showModal();
});
if(import.meta.hot)import.meta.hot.dispose(()=>disposeOnline?.());

import {installMusicLibrary} from '@soul/shared-ui/music';
const disposeMusic=installMusicLibrary({game:'rinne',environment:__BUILD_INFO__.environment});
if(import.meta.hot)import.meta.hot.dispose(disposeMusic);
