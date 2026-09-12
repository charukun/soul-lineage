import {defs} from './game/core.js';

const village=window.village;
if(!village)throw new Error('MURAAAAAAA UX polish 4b requires a booted village');
const {world,view}=village;
const $=id=>document.getElementById(id);

// `clanOnly` is also the legacy room-editor capability flag. Facilities have no
// housing capacity, so enabling it here makes their interiors editable by the
// mayor without allowing NPC residence.
for(const d of Object.values(defs))if(d?.building&&!d.capacity)d.clanOnly=true;

function syncFacilityMode(){
 const host=view.roomId&&world.object(view.roomId);if(!host)return;
 const d=defs[host.kind];if(!d?.building||d.capacity)return;
 const title=$('housingModeTitle'),text=$('housingModeText'),build=$('build');
 if(title)title.textContent='施設内装';
 if(text)text.textContent='村長が整えられます';
 if(build)build.hidden=false;
 for(const card of document.querySelectorAll('#catalog .card')){const kind=card.dataset.kind;if(defs[kind]?.furniture)card.hidden=false;}
}
setInterval(syncFacilityMode,120);
window.__MURA_UX_POLISH_4B__={version:1};
