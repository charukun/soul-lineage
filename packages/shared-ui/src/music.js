import {catalog,selectTracks} from '@soul/audio';
import {audioURLs,licenseURLs} from '@soul/audio/urls';
/** On-demand audio adapter: one player and one current Ogg blob, no ZIP or decoded-track cache. */
export function installMusicLibrary({game,environment,mount=document.body,defaultTrack=null,autoStart=false}){
 if(environment==='prod')return()=>{};
 const abort=new AbortController(),key=`soul.${environment}.${game}.device.music.v1`;
 const fallback=Object.hasOwn(catalog,defaultTrack)&&catalog[defaultTrack].game===game?defaultTrack:null;
 let prefs={volume:.4,favorites:[],track:null},serial=0,autoStarted=false,objectURL=null,disposed=false;
 try{const p=JSON.parse(localStorage.getItem(key));if(p){prefs.volume=Number.isFinite(p.volume)?Math.max(0,Math.min(1,p.volume)):.4;prefs.favorites=Array.isArray(p.favorites)?p.favorites.filter(id=>Object.hasOwn(catalog,id)):[];prefs.track=Object.hasOwn(catalog,p.track)?p.track:null;}}catch{}
 if(!prefs.track&&fallback)prefs.track=fallback;
 const root=document.createElement('div');root.className='soul-music';root.innerHTML=`<button type="button" data-open>音楽室</button><dialog aria-label="三界の調べ"><form method="dialog"><button>閉じる</button></form><h2>三界の調べ</h2><p>150曲から選んで、この世界とともに。</p><label>検索 <input type="search" data-search placeholder="曲名・場面"></label><label>世界 <select data-world><option value="">すべて</option><option value="rinne">輪廻転焦</option><option value="village">星継ぎの庭</option><option value="demon">暗い喰らいCry</option><option value="shared">共通</option></select></label><label><input type="checkbox" data-favorites>お気に入りのみ</label><p data-count></p><div data-tracks></div><p role="status" data-state>${autoStart&&prefs.track?`最初の操作で再生：${catalog[prefs.track].title}`:'曲を選ぶと再生します'}</p><audio controls preload="none"></audio><label>音量 <input type="range" data-volume min="0" max="1" step=".01"></label><button type="button" data-stop>停止</button><details><summary>試聴音源について</summary><p>DEV用の試聴版です。商用公開の権利確認は未完了です。</p></details></dialog>`;
 const style=document.createElement('style');style.textContent='.soul-music{position:fixed;right:14px;bottom:16px;z-index:90;font:14px sans-serif}.soul-music button,.soul-music input,.soul-music select{font:inherit;padding:9px;margin:4px}.soul-music>button{background:#18282d;color:#ffe8b6;border:1px solid #9b8658;border-radius:20px}.soul-music dialog{box-sizing:border-box;width:min(600px,94vw);max-height:86dvh;overflow:auto;background:#142027;color:#f1ead7;border:1px solid #9b8658;border-radius:16px;padding:18px}.soul-music dialog::backdrop{background:#0009}.soul-music label{display:block}.soul-music [data-tracks]{max-height:38dvh;overflow:auto}.soul-music [data-tracks]>div{display:flex;border-bottom:1px solid #647477}.soul-music [data-tracks] button:first-child{flex:1;text-align:left;min-width:0}.soul-music audio{width:100%}.soul-music form{text-align:right}';root.append(style);mount.append(root);
 for(const [name,url] of Object.entries(licenseURLs)){const link=document.createElement('a');link.href=url;link.textContent=name+' ';link.target='_blank';link.rel='noopener';root.querySelector('details').append(link);}
 const $=q=>root.querySelector(q),dialog=$('dialog'),player=$('audio'),status=$('[data-state]');player.volume=prefs.volume;$('[data-volume]').value=prefs.volume;$('[data-world]').value=game;
 const on=(el,type,fn,opts={})=>el.addEventListener(type,fn,{...opts,signal:abort.signal});
 const save=()=>{try{localStorage.setItem(key,JSON.stringify(prefs));}catch{status.textContent='設定を保存できません。この画面では引き続き再生できます。';}};
 async function play(id){
  if(!Object.hasOwn(catalog,id))return;
  const token=++serial;player.pause();prefs.track=id;status.textContent=`読込中：${catalog[id].title}`;save();
  try{
   const response=await fetch(audioURLs[id]);if(!response.ok)throw Error(`HTTP ${response.status}`);const blob=await response.blob();
   if(disposed||token!==serial)return;
   if(objectURL)URL.revokeObjectURL(objectURL);objectURL=URL.createObjectURL(blob);player.src=objectURL;player.loop=catalog[id].loop;
   await player.play();if(token===serial)status.textContent=`再生中：${catalog[id].title}`;
  }catch(e){if(token===serial)status.textContent=`再生できませんでした。曲を押して再試行してください。${e.message}`;}
 }
 function render(){const tracks=selectTracks({game:$('[data-world]').value,query:$('[data-search]').value}).filter(t=>!$('[data-favorites]').checked||prefs.favorites.includes(t.id));$('[data-count]').textContent=`${tracks.length} / 150曲`;$('[data-tracks]').replaceChildren(...tracks.map(t=>{const row=document.createElement('div'),button=document.createElement('button'),fav=document.createElement('button');button.type=fav.type='button';button.textContent=`${t.title} · ${t.scene}`;button.dataset.track=t.id;fav.textContent=prefs.favorites.includes(t.id)?'★':'☆';fav.setAttribute('aria-label',`${t.title}のお気に入り`);fav.setAttribute('aria-pressed',String(prefs.favorites.includes(t.id)));button.onclick=()=>play(t.id);fav.onclick=()=>{prefs.favorites=prefs.favorites.includes(t.id)?prefs.favorites.filter(id=>id!==t.id):[...prefs.favorites,t.id];save();render();};row.append(button,fav);return row;}));}
 const startDefault=()=>{if(autoStarted||!autoStart||!prefs.track)return;autoStarted=true;void play(prefs.track);};
 on(document,'pointerdown',startDefault,{capture:true});on(document,'keydown',startDefault,{capture:true});
 on($('[data-open]'),'click',()=>{render();dialog.showModal();});on($('[data-search]'),'input',render);on($('[data-world]'),'change',render);on($('[data-favorites]'),'change',render);
 on($('[data-volume]'),'input',e=>{player.volume=prefs.volume=Number(e.target.value);save();});on($('[data-stop]'),'click',()=>{serial++;player.pause();try{player.currentTime=0;}catch{}status.textContent='停止しました';});
 on(player,'error',()=>{status.textContent='音源を読み込めませんでした。曲を押して再試行してください。';});on(document,'visibilitychange',()=>{if(document.hidden)player.pause();});
 return()=>{disposed=true;abort.abort();serial++;player.pause();if(objectURL)URL.revokeObjectURL(objectURL);root.remove();};
}
