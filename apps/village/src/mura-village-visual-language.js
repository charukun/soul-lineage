import './mura-village-visual-language.css';
import {VILLAGE_VISUAL_PRESETS} from '@soul/rendering';
const preset=VILLAGE_VISUAL_PRESETS.villageDay;
document.documentElement.style.setProperty('--village-visual-exposure',String(preset.exposure));
function relabelFriendInvite(){const button=document.getElementById('onlineOpen');if(button&&button.textContent!=='友人を村へ招待')button.textContent='友人を村へ招待';}
relabelFriendInvite();
const observer=new MutationObserver(relabelFriendInvite);observer.observe(document.body,{subtree:true,childList:true});
if(import.meta.hot)import.meta.hot.dispose(()=>observer.disconnect());
