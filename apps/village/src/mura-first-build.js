import {defs} from './game/core.js';
import {findPlacementSite,commitPlacement} from './game/placement-guidance.js';

const village=window.village;
if(!village)throw new Error('First-build guidance requires the existing village');
const {world,view,ui}=village, $=id=>document.getElementById(id);
const panel=$('placement'),done=$('cancelPlace'),label=$('placementText');
const find=document.createElement('button');find.id='muraFindPlacement';find.type='button';find.textContent='置ける場所を探す';
find.setAttribute('aria-describedby','placementText');done.before(find);
const css=document.createElement('style');css.textContent=`
#placement{box-sizing:border-box;width:min(320px,calc(100vw - 24px))!important;max-height:calc(100dvh - 160px);overflow:auto}
#placement>.actions{display:flex!important;gap:8px!important;flex-wrap:wrap}
#placement>.actions #cancelPlace,#muraFindPlacement,#muraCancelPlacement{min-height:44px!important;padding:8px 12px!important;font-size:11px!important}
#placement>.actions #cancelPlace:disabled{opacity:.5;cursor:not-allowed}
#muraSettingsButton{min-width:44px!important;width:44px!important;height:44px!important;min-height:44px!important;padding:10px!important}
#muraSettingsButton svg{width:18px!important;height:18px!important}
#placement #muraRotateRange{height:44px!important}
`;
document.head.append(css);
let busy=false,timer;
function notice(text){$('toastText').textContent=text;$('toast').hidden=false;clearTimeout(timer);timer=setTimeout(()=>$('toast').hidden=true,5000);}
function refresh(){
 const p=ui.pending;
 if(!p){done.disabled=false;find.disabled=false;return;}
 const error=world.canPlace(p.kind,p.x,p.z,p.rot,p.roomId,p.moveId);
 p.error=error;
 done.disabled=busy||!!error;find.disabled=busy;
 const title=p.moveId?'ここへ移す':p.roomId?'ここに置く':'ここに建てる';
 if(done.textContent!==title){done.textContent=title;done.dataset.muraIcon='native';}
 done.setAttribute('aria-describedby','placementText');
}
find.onclick=()=>{
 const p=ui.pending;if(!p||busy)return;
 const site=findPlacementSite(world,p);
 if(!site){notice(p.error||'近くに置ける場所がありません。場所や部屋を変えてください');return;}
 p.x=site.x;p.z=site.z;p.error=null;
 view.setGhost(p.kind,p.x,p.z,p.rot,true,p.material);
 panel.classList.remove('invalid');
 label.textContent=`${defs[p.kind].label} · ここに置けます。確定ボタンで決める`;
 if(!p.roomId){view.followId=null;view.focus(p.x,p.z,Math.max(24,view.distance||30));}
 refresh();
};
done.onclick=async()=>{
 const p=ui.pending;if(!p||busy)return;
 const result=commitPlacement(world,p);
 if(result.error){notice(result.error);refresh();return;}
 busy=true;const room=p.roomId;
 village.cancelPlacement();
 if(result.object?.id)village.selection(result.object.id,room);
 world.notify(result.message,'life');
 try{
  await village.save();
  notice(village.storageOK?result.message:`${result.message}。保存できません。設定から書き出してください`);
 }catch(error){notice(`配置しましたが保存できません：${error.message}`);}
 finally{busy=false;refresh();}
};
const observer=new MutationObserver(refresh);
observer.observe(panel,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class']});
refresh();
window.addEventListener('pagehide',()=>{observer.disconnect();clearTimeout(timer);},{once:true});
