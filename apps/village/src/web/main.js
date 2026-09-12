import {World,defs,BUILDINGS,GARDEN,FURNITURE,ready,entry,worldToLocal,localToWorld,DAYS_YEAR,DAY_SECONDS,RESOURCE_NAMES,unlocked,capacityOf,jobsOf,materialOptions,recipe,MATERIALS,TUTORIAL,terrainHint,isGuard,isPlayer} from '../game/core.js';
import {View} from './view.js';
import {availableFurniture,canEditRoom} from '../game/housing-access.js';
import {installSceneInput,installCatalogDrag,installCatalogDrop} from './pointer-input.js';
import {Simulation} from '../game/simulation.js';
import {PlayerResidenceBridge} from '../game/bridge.js';
import {createWebPlatform} from '@soul/platform-web';
import {sharedEmblemUrl} from '@soul/assets';
import {createApp} from '../app.js';
import {createSaveStore} from '../game/save-store.js';
const $=id=>document.getElementById(id==='scene'?'game':id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function boot({onProgress}) {
const info=__BUILD_INFO__;
const platform=createWebPlatform({gameId:'village',environment:info.environment,playerId:'local'});
const foundation=createApp(platform);
const store=createSaveStore(platform);
window.__VILLAGE_BOOT__={recover:()=>store.recover(),canRecover:()=>store.blocked};
const canvas=$('scene');
Object.assign(canvas.dataset,{app:info.app,commit:info.commit,environment:info.environment,platform:platform.id,contentVersion:String(foundation.contentVersion),gameWorld:'hoshitsugi.life-and-guard.v5'});
document.title=`星継ぎの庭 | ${info.environment.toUpperCase()}`;
$('emblem').src=sharedEmblemUrl;
onProgress(35,'保存した村を確かめています。');
const saved=await store.load();
const world=new World(saved||undefined);
let storageOK=true,resetting=false;
const frameHooks=new Set(),eventHooks=new Set();
onProgress(55,'地形と建物を用意しています。');
await new Promise(resolve=>requestAnimationFrame(resolve));
const view=new View(canvas,world),sim=new Simulation(world),bridge=new PlayerResidenceBridge(world);
// Retain the common foundation entity as a real, rendered village landmark.
view.mountFoundation(foundation.world);
onProgress(80,'住人を迎え、最初の風景を描いています。');
let stopped=false;
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();stopped=true;save();window.dispatchEvent(new CustomEvent('village:fatal',{detail:new Error('描画の接続が切れました。村を保存してから再試行してください。')}));});
const ui={category:'住まい',selected:null,selectedRoom:null,pending:null,drawer:false,drag:null,lastActivity:performance.now(),idle:false,entryOpen:true,dialogPage:null,bubbles:new Map()};
let toastTimer=null,renderDirty=true,last=performance.now(),elapsed=0,lastUI=0,lastSave=0,frames=0,frameSeconds=0,knownKey='',tutorialKey='';
function toast(text,ms=3500){$('toastText').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,ms);}
async function save(){
 if(resetting)return false;
 try{await store.save(world);storageOK=true;$('status').textContent='';$('status').dataset.state='ready';return true;}
 catch(error){storageOK=false;$('status').dataset.state='warning';$('status').textContent='保存できません。設定の開発者ページからバックアップできます。';return false;}
}
// Keep the current world intact until backup succeeds; block every autosave
// during recovery so beforeunload cannot resurrect the village being removed.
async function resetVillage(){
 if(resetting)return;
 resetting=true;
 try{await store.recover();location.reload();}
 catch(error){resetting=false;throw error;}
}
window.__VILLAGE_BOOT__={recover:resetVillage,canRecover:()=>store.blocked};
function activity(){ui.lastActivity=performance.now();ui.idle=false;$('idleStatus').classList.remove('visible');$('idleMoment').classList.remove('visible');}
for(const name of ['pointerdown','pointerup','wheel','keydown'])document.addEventListener(name,activity,{passive:true,capture:true});
document.addEventListener('pointermove',e=>{if(e.buttons)activity();},{passive:true,capture:true});
function costText(cost){const entries=Object.entries(cost||{});return entries.length?entries.map(([k,n])=>`${RESOURCE_NAMES[k]} ${Math.ceil(n)}`).join(' · '):'建材不要';}
function selection(id,room=view.roomId){view.endObservation();ui.selected=id;ui.selectedRoom=room;ui.pending=null;view.clearGhost();view.showTerrainHints(null);$('placement').hidden=true;const o=world.list(room).find(o=>o.id===id);if(!o){deselect();return;}view.select(o,room);closeDrawer();$('context').hidden=false;updateContext();}
function deselect(){ui.selected=null;ui.selectedRoom=null;view.select(null);$('context').hidden=true;}
function updateContext(){if(!ui.selected)return;const o=world.list(ui.selectedRoom).find(o=>o.id===ui.selected);if(!o){deselect();return;}const d=defs[o.kind];
 $('objectLabel').textContent=d.label+((o.level||1)>1?' · '+o.level+'段階目':'');$('enter').hidden=!d.building||!!ui.selectedRoom||!ready(o)||o.kind==='campfire';$('enter').textContent=d.open||['yard','market'].includes(d.shape)?'敷地':'内装';
 let info='';if(!ready(o))info=o.phase==='planned'?'建材待ち：'+world.missing(o).join('・'):'建築中 '+Math.round(o.progress*100)+'%';
 else if(o.upgrade)info=`増築中 ${Math.floor(o.upgrade.progress*100)}% · 暮らしと内装はそのまま`;
 else if(d.capacity)info=d.reserved?'いつもの住まい。屋根を外して暮らしを見られます。':`${world.people.filter(p=>p.homeId===o.id).length} / ${capacityOf(o)}人${d.clanOnly?' · 一族専用':' · '+(world.safetyAt(o)?'守りが届いています':'警備をこの近くへ')}`;
 else if(d.building)info=`${world.people.filter(p=>p.jobId===o.id).length} / ${jobsOf(o)}人が就労 · ${d.produce?Object.keys(d.produce).map(k=>RESOURCE_NAMES[k]).join('・'):d.trait}`;
 else if(o.ownerId)info=`${world.people.find(p=>p.id===o.ownerId)?.name||'住人'}が買って飾りました`;
 $('objectInfo').textContent=info;
}
function closeDrawer(){ui.drawer=false;$('drawer').hidden=true;$('build').setAttribute('aria-expanded','false');$('build').querySelector('span').textContent='つくる';}
function openDrawer(){
 input.stop();cancelPlacement();deselect();ui.drawer=true;$('drawer').hidden=false;
 $('build').setAttribute('aria-expanded','true');$('build').querySelector('span').textContent='閉じる';renderCatalog();
}
function renderCatalog(){const visible=BUILDINGS.filter(d=>unlocked(world.state,d.id));const garden=GARDEN.filter(d=>unlocked(world.state,d.id));
 const categories=view.roomId?['家具']:['住まい','仕事','守り','庭'].filter(c=>c==='庭'?garden.length:visible.some(d=>d.category===c));if(!categories.includes(ui.category))ui.category=categories[0];
 $('tabs').innerHTML=categories.map(c=>`<button data-category="${c}" class="${c===ui.category?'active':''}">${c}</button>`).join('');for(const b of $('tabs').children)b.onclick=()=>{ui.category=b.dataset.category;renderCatalog();};
 const items=view.roomId?availableFurniture(world,view.roomId,FURNITURE):ui.category==='庭'?garden:visible.filter(d=>d.category===ui.category),tutorial=world.tutorialStep();$('catalog').innerHTML='';
 for(const d of items){const b=document.createElement('button');b.className='card'+(tutorial?.kind===d.id?' recommended':'');b.dataset.kind=d.id;b.setAttribute('aria-label',d.label);
  b.innerHTML=`<img alt="" draggable="false"><span class="name">${esc(d.label)}</span><small>${tutorial?.kind===d.id?'まずはこちら':d.terrain?terrainHint(d.terrain):d.cost&&Object.keys(d.cost).length?'建材でつくる':d.building?'建材不要':'部屋を飾る'}</small>`;$('catalog').append(b);
  b.querySelector('img').src=view.thumbnail(d.id);b.onclick=()=>{if(performance.now()-(ui.lastDrag||0)<350)return;beginPlacement(d.id);};installCatalogDrag(b,d.id,{ui,begin:beginPlacement});
 }
 updateStockTray();
}
function updateStockTray(){const keys=world.state.known.filter(k=>world.state.stock[k]>=1).slice(0,7);$('stockTray').textContent=keys.length?keys.map(k=>`${RESOURCE_NAMES[k]} ${Math.floor(world.state.stock[k])}`).join('　'):'資材は、住人たちの仕事で少しずつ集まります。';}
function renderMaterials(){const p=ui.pending;if(!p)return;const options=materialOptions(world.state,p.kind);$('materialChoices').innerHTML='';
 if(options.length>1&&!p.roomId&&!p.moveId)for(const option of options){const b=document.createElement('button');b.className=option.id===p.material?'active':'';b.textContent=option.label+(option.affordable?'':'');b.dataset.material=option.id;b.onclick=()=>{p.material=option.id;renderMaterials();refreshPreview();};$('materialChoices').append(b);}
 $('placementCost').textContent=p.roomId||p.moveId?'':costText(recipe(p.kind,p.material));
}
function beginPlacement(kind,moveId=null){
 if(!defs[kind])return false;
 if(view.roomId&&!canEditRoom(world,view.roomId)){toast('この場所は編集できません');return false;}
 input.stop();view.endObservation();closeDrawer();deselect();
 const moved=moveId&&world.list(view.roomId).find(o=>o.id===moveId);if(moveId&&!moved)return false;
 const material=moved?.material||materialOptions(world.state,kind).find(o=>o.affordable)?.id||'base';
 ui.pending={kind,rot:moved?.rot||0,moveId,roomId:view.roomId,material};
 view.interacting=true;view.cameraGoal=null;$('placement').hidden=false;
 renderMaterials();view.showTerrainHints(kind);$('muraRotation').value=String(Math.round(ui.pending.rot*180/Math.PI));
 if(moved){ui.pending.x=moved.x;ui.pending.z=moved.z;refreshPreview();}
 else if(kind==='harbor'){view.focus(166,0,70);previewAt(166,0);}
 else previewAt(view.target.x,view.target.z);
 return true;
}
function cancelPlacement(){ui.pending=null;view.clearGhost();view.showTerrainHints(null);$('placement').hidden=true;view.interacting=false;view.lastInteraction=performance.now();}
function previewAt(x,z){
 if(!ui.pending)return;const p=ui.pending,h=p.roomId&&world.object(p.roomId);
 if(p.roomId&&!h){cancelPlacement();return;}
 const q=h?worldToLocal(h,x,z):{x,z};if(p.kind==='harbor'){q.x=166;p.rot=0;}
 p.x=q.x;p.z=q.z;refreshPreview();
}
function refreshPreview(){
 const p=ui.pending;if(!p)return;
 p.error=world.canPlace(p.kind,p.x,p.z,p.rot,p.roomId,p.moveId);
 view.setGhost(p.kind,p.x,p.z,p.rot,!p.error,p.material);
 $('placementText').textContent=defs[p.kind].label+' · '+(p.error||'配置できます');
 $('placement').classList.toggle('invalid',!!p.error);$('cancelPlace').disabled=!!p.error;
 $('muraRotationValue').textContent=Math.round(p.rot*180/Math.PI)+'°';
}
function confirmPlacement(){
 const p=ui.pending;if(!p)return false;
 // The displayed candidate is the only commit source. No pointer raycast here.
 const r=p.moveId?world.move(p.moveId,p.x,p.z,p.rot,p.roomId):world.add(p.kind,p.x,p.z,p.rot,p.roomId,{material:p.material});
 if(r.error){toast(r.error);refreshPreview();return false;}
 const id=p.moveId||r.object?.id;cancelPlacement();if(id)selection(id,p.roomId);void save();
 toast(p.moveId?'移動しました':r.object?.phase==='planned'?'建築を予約しました':'配置しました',2000);return true;
}
$('build').onclick=()=>ui.drawer?closeDrawer():openDrawer();$('deselect').onclick=deselect;
$('move').onclick=()=>{const o=world.list(ui.selectedRoom).find(o=>o.id===ui.selected);if(o){view.roomId=ui.selectedRoom;beginPlacement(o.kind,o.id);}};
$('enter').onclick=()=>enterRoom(ui.selected);
function enterRoom(id){
 if(!canEditRoom(world,id))return false;
 input.stop();view.endObservation();cancelPlacement();closeDrawer();deselect();
 if(!view.enterRoom(id))return false;
 $('leaveRoom').hidden=false;ui.category='家具';return true;
}
function exitRoom(){input.stop();cancelPlacement();closeDrawer();deselect();view.endObservation();view.exitRoom();$('leaveRoom').hidden=true;ui.category='住まい';}
$('leaveRoom').onclick=exitRoom;
$('cancelPlace').onclick=confirmPlacement;$('muraCancelPlacement').onclick=cancelPlacement;
$('muraRotation').oninput=e=>{if(ui.pending){ui.pending.rot=Number(e.target.value)*Math.PI/180;refreshPreview();}};
$('rotate').onclick=()=>{if(ui.pending){ui.pending.rot=(ui.pending.rot+Math.PI/2)%(Math.PI*2);$('muraRotation').value=String(Math.round(ui.pending.rot*180/Math.PI));refreshPreview();}};
function showDialog(html,{page='detail',back=null}={}){
 input.stop();ui.dialogPage=page;
 $('dialogContent').innerHTML=html;
 $('dialog').dataset.page=page;
 const button=$('muraDialogBack');button.hidden=!back;button.onclick=back;
 if(!$('dialog').open)$('dialog').showModal();view.interacting=true;activity();
}
$('dialog').addEventListener('close',()=>{ui.dialogPage=null;view.interacting=!!ui.pending;view.lastInteraction=performance.now();activity();});
function removeDialog(id,room){const o=world.list(room).find(o=>o.id===id);if(!o)return;showDialog(`<h2>${esc(defs[o.kind].label)}を削除</h2><p>${o.room?`室内の配置物 ${o.room.length}個も一緒に削除します。`:''}「取り消す」で同じ物と内装を戻せます。</p><p class="muted">建築に使った建材は払い戻されません。住人のいる住まいは先に住み替えが必要です。</p><button id="confirmDelete" class="wide danger">削除</button>`);$('confirmDelete').onclick=()=>{const r=world.remove(id,room);if(r.error){toast(r.error);return;}$('dialog').close();deselect();save();toast('削除しました。「つくる」の取り消すで戻せます');};}
function buildingDetails(){const id=ui.selected,room=ui.selectedRoom,o=world.list(room).find(o=>o.id===id);if(!o)return;const d=defs[o.kind],workers=world.people.filter(p=>p.jobId===id),cost=world.upgradeCost(o),canUpgrade=d.building&&ready(o)&&o.kind!=='campfire'&&(o.level||1)<3;
 showDialog(`<span class="eyebrow">${d.clanOnly?'一族の住まい':d.building?'施設の手帖':'設置物'}</span><h2>${esc(d.label)}</h2><p>${esc(d.trait||'村の景色や住まいを整える設置物です。')}</p>${d.building?`<div class="factGrid"><span>建材<b>${esc(MATERIALS[o.material||'base'].label)}</b></span><span>増築<b>${o.level||1} / 3</b></span><span>就労<b>${workers.length} / ${jobsOf(o)}</b></span></div>`:''}${d.terrain?`<p class="muted">立地：${terrainHint(d.terrain)}</p>`:''}${d.produce?`<p>獲得：${costText(d.produce)}${(o.level||1)>1?' × '+(1+((o.level||1)-1)*.45).toFixed(2):''}${d.input?'<br>消費：'+costText(d.input):''}</p>`:''}${workers.length?'<p>働く人：'+workers.map(p=>esc(p.name)).join('、')+'</p>':''}${o.upgrade?`<p>増築中：${Math.floor(o.upgrade.progress*100)}%</p>`:canUpgrade?`<button id="upgrade" class="wide">増築<small>${costText(cost)}</small></button><p class="muted">${world.canAfford(cost)?'必要な資材がそろっています。':'不足：'+world.deficit(cost).join('・')}<br>敷地と内装を保ち、定員・就労枠・生産量・守りを強化します。</p>`:''}${d.clanOnly?'<p class="muted">本編接続待ち。一般NPCは入居しません。ローカルの一族ゲストは開発者ページで試せます。</p>':''}${!d.reserved&&o.kind!=='campfire'?'<button id="delete" class="wide danger">削除</button>':''}`);
 if($('upgrade'))$('upgrade').onclick=()=>{const r=world.upgrade(id);if(r.error)toast(r.error);else{$('dialog').close();save();toast('資材を使い、増築を始めました');}};
 if($('delete'))$('delete').onclick=()=>removeDialog(id,room);
}
$('details').onclick=buildingDetails;
$('undo').onclick=()=>{const r=world.undo();if(r.error)toast(r.error);else{deselect();save();toast('取り消しました');}};
function download(text,name,type='application/json'){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([text],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),4000);}
let onlineReady=false;
async function openOnline(){
 $('dialog').close();closeDrawer();$('onlineDialog').showModal();
 if(onlineReady)return;
 try{const {installOnlineHost}=await import('../online.js');$('onlineHost').replaceChildren();installOnlineHost();onlineReady=true;}
 catch(error){$('onlineHost').textContent='オンライン村を開けませんでした。閉じて再度開くと再試行します。\n'+error.message;}
}
function more(){
 showDialog(`<h2>設定</h2><div class="settingsGrid"><button id="musicOpen">音楽</button><button id="photo">写真</button><button id="journal">出来事</button><button id="help">ヘルプ</button><button id="onlineOpen">オンライン</button><button class="muraTitleAction" id="muraTitleAction">タイトル</button>${info.environment!=='prod'?'<button id="muraDeveloperOpen">開発者</button>':''}</div><p class="muted">${storageOK?'自動保存しています。':'保存できません。開発者ページからバックアップできます。'}</p>`,{page:'settings'});
 $('onlineOpen').onclick=openOnline;
 $('musicOpen').onclick=()=>{$('dialog').close();window.__SOUL_MUSIC__?.open();};
 $('photo').onclick=()=>{view.render(elapsed,0);const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download='MURAAAAAAA.png';a.click();};
 $('journal').onclick=()=>showDialog('<h2>出来事</h2>'+world.state.news.slice(0,35).map(n=>`<article class="journalEntry"><small>${Math.floor(n.day/DAYS_YEAR)+1}年 · ${Math.floor(n.day%DAYS_YEAR)+1}日</small><p>${esc(n.text)}</p></article>`).join(''),{page:'events',back:more});
 $('help').onclick=help;
 $('muraTitleAction').onclick=async()=>{const b=$('muraTitleAction');b.disabled=true;if(!await save()){b.disabled=false;toast('保存に失敗しました。タイトルには戻りません。');return;}cancelPlacement();closeDrawer();deselect();view.endObservation();$('dialog').close();window.__MURA_ENTRY_POLISH__.open();};
 if($('muraDeveloperOpen'))$('muraDeveloperOpen').onclick=developer;
}
function help(){
 showDialog(`<h2>村のヘルプ</h2><h3>建築と内装</h3><p>つくるで施設や家具を選び、地面をタップして位置を決めます。「配置」で確定。「取消」は候補だけを取り消します。指でなぞると視点移動、二本指で拡大・縮小と回転ができます。</p><p>完成した施設を選んで「内装」へ。村長として家具の配置・移動・削除ができます。一族の邸宅は一族プレイヤー専用の住まいです。</p><h3>村人の暮らし</h3><p>最初は空きテント、林のそばの伐採場、肥沃な土の小麦畑を用意しましょう。チュートリアルを押すと対象の場所と施設候補へ案内します。資源を初めて手に入れると新しい施設や家具が解放されます。</p><p>食事・警備・住まいの余裕に応じて住民が増えます。住民をタップすると詳細が開き、正面・横・背面から観察できます。「俯瞰」で村の視点へ戻れます。</p><h3>保存</h3><p>村はこの端末に自動保存されます。タイトルへ戻っても続きから再開できます。初期化すると今の村を退避して新しい村へ戻ります。</p><p class="muted">ローカル試作です。本編プレイヤーとの接続は未完了。現在の襲来はAIイベントです。</p>`,{page:'help',back:more});
}
function developer(){
 if(info.environment==='prod')return;
 showDialog(`<h2>開発者</h2><div class="row"><label for="muraDevSpeed">暮らしの速さ</label><select id="muraDevSpeed"><option value="0">停止</option><option value="1">1×</option><option value="5">5×</option><option value="20">20×</option></select></div><div class="row"><label for="muraDevTilt">チルトシフト</label><output id="muraDevTiltValue"></output><input id="muraDevTilt" type="range" min="0.2" max="1.6" step="0.05"></div><details><summary>データの退避と検証</summary><p>自動保存とは別のJSONバックアップです。復旧・検証用に使用します。</p><button id="exportSave">バックアップ</button><button id="loadSave">復元</button><button id="demoPlayer">一族ゲスト</button><button id="onlineOpen">オンライン試験</button></details>`,{page:'developer',back:more});
 const speed=$('muraDevSpeed'),tilt=$('muraDevTilt'),value=$('muraDevTiltValue');speed.value=String(world.state.settings.speed);tilt.value=String(world.state.settings.tilt);value.textContent=Number(tilt.value).toFixed(2);
 speed.onchange=()=>{world.state.settings.speed=Number(speed.value);void save();};tilt.oninput=()=>{world.state.settings.tilt=Number(tilt.value);value.textContent=Number(tilt.value).toFixed(2);};tilt.onchange=()=>void save();
 $('exportSave').onclick=()=>download(world.export(),'MURAAAAAAA-backup.json');$('loadSave').onclick=()=>$('importFile').click();$('onlineOpen').onclick=openOnline;
 $('demoPlayer').onclick=()=>{const r=bridge.upsert({id:'lineage-guest',name:'旅の一族（デモ）',clanId:'星渡りの一族'},{demo:true});if(r.error)toast(r.error);else{sim.refresh();$('dialog').close();view.focus(r.person.x,r.person.z,32);void save();}};
}
$('importFile').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>8e6){toast('保存ファイルが大きすぎます');return;}const r=world.load(await file.text());if(r.error)toast(r.error);else{sim.refresh();view.roomId=null;view.followId=null;$('leaveRoom').hidden=true;view.rebuild();deselect();cancelPlacement();closeDrawer();save();toast('村を読み込みました');if($('dialog').open)$('dialog').close();}e.target.value='';};
function observePerson(id,mode='top'){
 const p=world.people.find(p=>p.id===id);if(!p)return false;
 input.stop();cancelPlacement();closeDrawer();deselect();if($('dialog').open)$('dialog').close();
 if(p.insideId&&view.roomId!==p.insideId){view.enterRoom(p.insideId);$('leaveRoom').hidden=false;}
 view.observePerson(id,mode);activity();return true;
}
function personDialog(id){
 const p=world.people.find(p=>p.id===id);if(!p)return;
 const h=world.object(p.homeId),job=world.object(p.jobId),role=p.role==='mayor'?'村長':isGuard(p)?'護衛':isPlayer(p)?'一族プレイヤー':'住民';
 showDialog(`<span class="eyebrow">${role}</span><h2>${esc(p.name)}</h2><p class="personStatus">${esc(p.status||'休息中')}</p><div class="personMeters">${[['体調',p.health],['満腹',p.hunger],['気分',p.happiness]].map(([label,n])=>`<div><span>${label}</span><meter min="0" max="100" value="${Number(n)||0}"></meter><small>${Math.floor(Number(n)||0)}</small></div>`).join('')}</div><p>住まい：${esc(h?defs[h.kind].label:'なし')}<br>仕事：${esc(job?defs[job.kind].label:role)}<br>好きな時間：${esc(p.favorite||'村の散歩')}</p><div class="memories">${(p.memories||[]).slice(0,3).map(m=>'<p>'+esc(m.text)+'</p>').join('')}</div><div class="muraPersonCamera"><button data-camera="front">正面</button><button data-camera="side">横</button><button data-camera="back">背面</button><button data-camera="top">俯瞰</button></div><button id="followPerson">追従</button>${h?'<button id="visitHome">内装</button>':''}${p.role!=='mayor'&&p.id!=='guard-npc'?'<button id="relocate">住替え</button>':''}`,{page:'person'});
 for(const b of $('dialogContent').querySelectorAll('[data-camera]'))b.onclick=()=>observePerson(id,b.dataset.camera);
 $('followPerson').onclick=()=>{observePerson(id,'top');toast('追従中 · ドラッグで解除',1800);};
 if($('visitHome'))$('visitHome').onclick=()=>{$('dialog').close();enterRoom(h.id);};
 if($('relocate'))$('relocate').onclick=()=>{const home=sim.availableHomes({player:isPlayer(p)}).find(o=>o.id!==h?.id);if(!home){toast('空き住まいがありません');return;}const r=world.assign(p.id,home.id);if(r.error)toast(r.error);else{$('dialog').close();sim.go(p,home,'home');void save();}};
}
function tap(x,y){
 if(ui.entryOpen)return;
 if(ui.pending){const p=view.ground(x,y);if(p)previewAt(p.x,p.z);return;}
 closeDrawer();const person=view.pickPerson(x,y);if(person){personDialog(person);return;}
 const id=view.pick(x,y);if(id){if(world.object(id)){if(view.roomId&&id!==view.roomId)exitRoom();selection(id,null);}else selection(id,view.roomId);return;}deselect();
}
const input=installSceneInput(canvas,{view,ui,tap,activity}),pointers=input.pointers;
installCatalogDrop({ui,view,preview:previewAt,activity,cancel:cancelPlacement});
$('tutorialAction').onclick=()=>{
 const step=world.tutorialStep();if(!step)return;
 if(!unlocked(world.state,step.kind)){toast('丸太が届くのを待ちましょう');return;}
 ui.category=defs[step.kind].category;openDrawer();view.endObservation();view.focus(step.at[0],step.at[1],46);
 const target=$('catalog').querySelector(`[data-kind="${CSS.escape(step.kind)}"]`);
 if(target){target.classList.add('muraTutorialTarget');requestAnimationFrame(()=>target.scrollIntoView({block:'nearest',inline:'nearest'}));}
};
$('dismissTutorial').onclick=()=>{world.state.tutorial.dismissed=true;$('tutorial').hidden=true;save();};
function updateTutorial(){const step=world.tutorialStep(),blocked=ui.entryOpen||!!view.observation||!!ui.pending||ui.drawer||!!ui.selected||!!view.roomId||$('dialog').open;$('tutorial').hidden=!step||blocked;
 if(step){const key=step.kind;if(key!==tutorialKey){tutorialKey=key;$('tutorialCount').textContent=`${step.index+1} / ${TUTORIAL.length}`;$('tutorialText').textContent=step.title;$('tutorialAction').setAttribute('aria-label',step.text);}}
}
function updateIdle(){ui.idle=performance.now()-ui.lastActivity>8000&&!ui.entryOpen&&!ui.drag&&!pointers.size&&!ui.drawer&&!ui.pending&&!ui.selected&&!view.roomId&&!view.observation&&!document.querySelector('dialog[open]');}
function updateBubbles(){
 const now=performance.now(),layer=$('speechLayer');
 for(const p of world.people){if(p.bubble&&!ui.bubbles.has(p.bubble.id)&&!ui.seenBubbles?.has(p.bubble.id)){
  ui.seenBubbles??=new Set();ui.seenBubbles.add(p.bubble.id);if(ui.seenBubbles.size>300)ui.seenBubbles.delete(ui.seenBubbles.values().next().value);
  const node=document.createElement('div');node.className='speech';node.textContent=p.bubble.text;node.dataset.personId=p.id;layer.append(node);ui.bubbles.set(p.bubble.id,{node,personId:p.id,created:now});
 }}
 for(const[id,b]of ui.bubbles){
  const p=world.people.find(p=>p.id===b.personId);if(!p||now-b.created>5000){b.node.remove();ui.bubbles.delete(id);continue;}
  const point=view.headPoint(p),micro=view.span>66; b.node.classList.toggle('micro',micro);
  b.node.style.left=point.x+'px';b.node.style.top=(point.y-6)+'px';
  b.node.style.setProperty('--speech-scale',String(micro?Math.max(.45,Math.min(.8,65/view.span)):Math.max(.6,Math.min(1,32/view.span))));
  b.node.hidden=ui.entryOpen||ui.drawer||!!ui.pending||!!ui.dialogPage||point.x<12||point.x>view.w-12||point.y<60||point.y>view.h-90||!!(p.insideId&&p.insideId!==view.roomId);
 }
 while(ui.bubbles.size>3){const[id,b]=ui.bubbles.entries().next().value;b.node.remove();ui.bubbles.delete(id);}
}
window.addEventListener('resize',()=>view.resize());window.addEventListener('beforeunload',save);document.addEventListener('visibilitychange',()=>{save();last=performance.now();});
world.listeners.add(()=>{renderDirty=true;});sim.onEvent=(text,type)=>{for(const hook of eventHooks)hook(text,type);};
function loop(now){if(stopped)return;try{const dt=document.hidden?0:Math.min(.25,(now-last)/1000);last=now;elapsed+=dt;frames++;frameSeconds+=dt;
 if(!ui.entryOpen&&!resetting)sim.update(dt*world.state.settings.speed);if(renderDirty){view.rebuild();renderDirty=false;updateContext();if(ui.selected){const o=world.list(ui.selectedRoom).find(o=>o.id===ui.selected);if(o)view.select(o,ui.selectedRoom);}}
 const actors=[...world.people,...sim.extras,...world.state.wildlife,...(sim.raid?.phase==='active'?sim.raid.monsters:[])],ids=new Set(actors.map(p=>p.id));for(const[id]of view.actorNodes)if(!ids.has(id))view.removeActor(id);for(const p of actors)view.syncActor(p,elapsed,p.id.startsWith('raid-'));view.drawTrails(sim,dt);
 if(elapsed-lastUI>.35||!frames){lastUI=elapsed;$('calendar').textContent=`${Math.floor(world.state.clock/DAYS_YEAR)+1}年目 · ${Math.floor(world.state.clock%DAYS_YEAR)+1}日`;view.setTime(world.state.time);updateContext();updateTutorial();updateIdle();if(ui.drawer)updateStockTray();const key=world.state.known.join();if(key!==knownKey){knownKey=key;if(ui.drawer)renderCatalog();}}
 if(elapsed-lastSave>12){lastSave=elapsed;save();}view.interacting=ui.entryOpen||!!ui.pending||!!ui.drag||pointers.size>0||!!document.querySelector('dialog[open]')||ui.drawer;view.render(elapsed,dt);updateBubbles();for(const hook of frameHooks)hook(now,dt);requestAnimationFrame(loop);
}catch(error){stopped=true;window.dispatchEvent(new CustomEvent('village:fatal',{detail:error}));}
}
window.village={world,sim,view,ui,bridge,version:5,frameHooks,eventHooks,info,toast,resetVillage,more,help,developer,observePerson,confirmPlacement,previewAt,refreshPreview,exitRoom,closeDrawer,renderCatalog,deselect,enterRoom,openDrawer,beginPlacement,cancelPlacement,selection,personDialog,buildingDetails,updateIdle,updateTutorial,save,activity,get fps(){return frameSeconds?frames/frameSeconds:0;},get storageOK(){return storageOK;}};
updateTutorial();loop(performance.now());
if(stopped)throw new Error('最初の描画に失敗しました');
Object.assign(canvas.dataset,{renderer:'ready',world:foundation.world.id,asset:foundation.world.entities[0].assetId});
$('status').dataset.state='ready';
if(!saved)await save();
return window.village;
}
