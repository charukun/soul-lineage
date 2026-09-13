import {projectMuraLayout,validateMuraLayout} from '@soul/world/mura';
import {createSharedWorldChannel} from '@soul/platform-web/shared-world';
import {World,defs,BUILDINGS,GARDEN,FURNITURE,ready,entry,worldToLocal,localToWorld,DAYS_YEAR,DAY_SECONDS,RESOURCE_NAMES,unlocked,capacityOf,jobsOf,materialOptions,recipe,MATERIALS,TUTORIAL,terrainHint,isGuard,isPlayer} from '../game/core.js';
import {View} from './view.js';
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
const worldChannel=createSharedWorldChannel({environment:info.environment,writer:true,validate:validateMuraLayout});
function publishLayout(){try{worldChannel.publish(projectMuraLayout(world.state));}catch(error){$('status').textContent='村は保存済みですが、共通マップを更新できません：'+error.message;}}
window.__VILLAGE_BOOT__={recover:()=>store.recover(),canRecover:()=>store.blocked};
const canvas=$('scene');
Object.assign(canvas.dataset,{app:info.app,commit:info.commit,environment:info.environment,platform:platform.id,contentVersion:String(foundation.contentVersion),gameWorld:'hoshitsugi.life-and-guard.v5'});
document.title=`星継ぎの庭 | ${info.environment.toUpperCase()}`;
$('emblem').src=sharedEmblemUrl;
onProgress(35,'保存した村を確かめています。');
const saved=await store.load();
const world=new World(saved||undefined);publishLayout();
let storageOK=true;
onProgress(55,'地形と建物を用意しています。');
await new Promise(resolve=>requestAnimationFrame(resolve));
const view=new View(canvas,world),sim=new Simulation(world),bridge=new PlayerResidenceBridge(world);
// Retain the common foundation entity as a real, rendered village landmark.
view.mountFoundation(foundation.world);
onProgress(80,'住人を迎え、最初の風景を描いています。');
let stopped=false;
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();stopped=true;save();window.dispatchEvent(new CustomEvent('village:fatal',{detail:new Error('描画の接続が切れました。村を保存してから再試行してください。')}));});
const ui={category:'住まい',selected:null,selectedRoom:null,pending:null,drawer:false,drag:null,lastActivity:performance.now(),idle:false,bubbles:new Map()};
let toastTimer=null,renderDirty=true,last=performance.now(),elapsed=0,lastUI=0,lastSave=0,frames=0,frameSeconds=0,knownKey='',tutorialKey='';
function toast(text,ms=3500){$('toastText').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,ms);}
function save(){return store.save(world).then(()=>{storageOK=true;publishLayout();if($('status').dataset.state==='warning'){$('status').textContent='';$('status').dataset.state='ready';}},error=>{storageOK=false;$('status').dataset.state='warning';$('status').textContent='保存できません。その他からJSONを書き出してください。';});}
function activity(){ui.lastActivity=performance.now();ui.idle=false;$('idleStatus').classList.remove('visible');$('idleMoment').classList.remove('visible');}
for(const name of ['pointerdown','pointerup','wheel','keydown'])document.addEventListener(name,activity,{passive:true,capture:true});
document.addEventListener('pointermove',e=>{if(e.buttons)activity();},{passive:true,capture:true});
function costText(cost){const entries=Object.entries(cost||{});return entries.length?entries.map(([k,n])=>`${RESOURCE_NAMES[k]} ${Math.ceil(n)}`).join(' · '):'建材不要';}
function selection(id,room=view.roomId){ui.selected=id;ui.selectedRoom=room;ui.pending=null;view.clearGhost();view.showTerrainHints(null);$('placement').hidden=true;const o=world.list(room).find(o=>o.id===id);if(!o){deselect();return;}view.select(o,room);closeDrawer();$('context').hidden=false;updateContext();}
function deselect(){ui.selected=null;ui.selectedRoom=null;view.select(null);$('context').hidden=true;}
function updateContext(){if(!ui.selected)return;const o=world.list(ui.selectedRoom).find(o=>o.id===ui.selected);if(!o){deselect();return;}const d=defs[o.kind];
 $('objectLabel').textContent=d.label+((o.level||1)>1?' · '+o.level+'段階目':'');$('enter').hidden=!d.building||!!ui.selectedRoom||!ready(o)||o.kind==='campfire';$('enter').textContent=d.open||['yard','market'].includes(d.shape)?'敷地を飾る':'内装';
 let info='';if(!ready(o))info=o.phase==='planned'?'建材待ち：'+world.missing(o).join('・'):'建築中 '+Math.round(o.progress*100)+'%';
 else if(o.upgrade)info=`増築中 ${Math.floor(o.upgrade.progress*100)}% · 暮らしと内装はそのまま`;
 else if(d.capacity)info=d.reserved?'いつもの住まい。屋根を外して暮らしを見られます。':`${world.people.filter(p=>p.homeId===o.id).length} / ${capacityOf(o)}人${d.clanOnly?' · 一族専用':' · '+(world.safetyAt(o)?'守りが届いています':'警備をこの近くへ')}`;
 else if(d.building)info=`${world.people.filter(p=>p.jobId===o.id).length} / ${jobsOf(o)}人が就労 · ${d.produce?Object.keys(d.produce).map(k=>RESOURCE_NAMES[k]).join('・'):d.trait}`;
 else if(o.ownerId)info=`${world.people.find(p=>p.id===o.ownerId)?.name||'住人'}が買って飾りました`;
 $('objectInfo').textContent=info;
}
function closeDrawer(){ui.drawer=false;$('drawer').hidden=true;$('build').setAttribute('aria-expanded','false');}
function openDrawer(){cancelPlacement();deselect();ui.drawer=true;$('drawer').hidden=false;$('build').setAttribute('aria-expanded','true');$('drawerTitle').textContent=view.roomId?'この場所を、心地よく。':'村に、何を置こう。';renderCatalog();}
function renderCatalog(){const visible=BUILDINGS.filter(d=>unlocked(world.state,d.id));const garden=GARDEN.filter(d=>unlocked(world.state,d.id));
 const categories=view.roomId?['家具']:['住まい','仕事','守り','庭'].filter(c=>c==='庭'?garden.length:visible.some(d=>d.category===c));if(!categories.includes(ui.category))ui.category=categories[0];
 $('tabs').innerHTML=categories.map(c=>`<button data-category="${c}" class="${c===ui.category?'active':''}">${c}</button>`).join('');for(const b of $('tabs').children)b.onclick=()=>{ui.category=b.dataset.category;renderCatalog();};
 const items=view.roomId?FURNITURE:ui.category==='庭'?garden:visible.filter(d=>d.category===ui.category),tutorial=world.tutorialStep();$('catalog').innerHTML='';
 for(const d of items){const b=document.createElement('button');b.className='card'+(tutorial?.kind===d.id?' recommended':'');b.dataset.kind=d.id;b.setAttribute('aria-label',d.label);
  b.innerHTML=`<img alt="" draggable="false"><span class="name">${esc(d.label)}</span><small>${tutorial?.kind===d.id?'まずはこちら':d.terrain?terrainHint(d.terrain):d.cost&&Object.keys(d.cost).length?'建材でつくる':d.building?'建材不要':'部屋を飾る'}</small>`;$('catalog').append(b);
  b.querySelector('img').src=view.thumbnail(d.id);b.onclick=()=>{if(performance.now()-(ui.lastDrag||0)<350)return;beginPlacement(d.id);};setupCardDrag(b,d.id);
 }
 updateStockTray();
}
function updateStockTray(){const keys=world.state.known.filter(k=>world.state.stock[k]>=1).slice(0,7);$('stockTray').textContent=keys.length?keys.map(k=>`${RESOURCE_NAMES[k]} ${Math.floor(world.state.stock[k])}`).join('　'):'資材は、住人たちの仕事で少しずつ集まります。';}
function renderMaterials(){const p=ui.pending;if(!p)return;const options=materialOptions(world.state,p.kind);$('materialChoices').innerHTML='';
 if(options.length>1&&!p.roomId&&!p.moveId)for(const option of options){const b=document.createElement('button');b.className=option.id===p.material?'active':'';b.textContent=option.label+(option.affordable?'':'');b.dataset.material=option.id;b.onclick=()=>{p.material=option.id;renderMaterials();if(Number.isFinite(p.x))previewAt(p.x,p.z);};$('materialChoices').append(b);}
 $('placementCost').textContent=p.roomId||p.moveId?'':costText(recipe(p.kind,p.material));
}
function beginPlacement(kind,moveId=null){closeDrawer();deselect();ui.pending={kind,rot:0,moveId,roomId:view.roomId,material:'base'};
 if(moveId){const o=world.list(view.roomId).find(o=>o.id===moveId);ui.pending.rot=o.rot;ui.pending.material=o.material||'base';}
 else{const option=materialOptions(world.state,kind).find(o=>o.affordable);if(option)ui.pending.material=option.id;}
 view.interacting=true;$('placement').hidden=false;renderMaterials();view.showTerrainHints(kind);$('placementText').textContent=`${defs[kind].label} · 置きたい場所をタップ`;
 if(kind==='harbor'){view.focus(166,0,70);toast('船着き場は東の海岸沿いに配置します');}else previewAt(view.target.x,view.target.z);
}
function cancelPlacement(){ui.pending=null;view.clearGhost();view.showTerrainHints(null);$('placement').hidden=true;view.interacting=false;view.lastInteraction=performance.now();}
function coordinates(x,z){return view.roomId?worldToLocal(world.object(view.roomId),x,z):{x,z};}
function previewAt(x,z){if(!ui.pending)return;const p=ui.pending,q=coordinates(x,z);if(p.kind==='harbor'){q.x=166;p.rot=0;}p.x=q.x;p.z=q.z;p.error=world.canPlace(p.kind,q.x,q.z,p.rot,p.roomId,p.moveId);view.setGhost(p.kind,q.x,q.z,p.rot,!p.error,p.material);$('placementText').textContent=defs[p.kind].label+' · '+(p.error||'ここに置けます');$('placement').classList.toggle('invalid',!!p.error);}
function placeAt(x,z,{repeat=false}={}){const p=ui.pending;if(!p)return;previewAt(x,z);const r=p.moveId?world.move(p.moveId,p.x,p.z,p.rot,p.roomId):world.add(p.kind,p.x,p.z,p.rot,p.roomId,{material:p.material});if(r.error){toast(r.error);return false;}save();if(repeat){view.clearGhost();return true;}const id=r.object?.id;cancelPlacement();if(id)selection(id,p.roomId);toast(p.moveId?'移動しました':r.object?.phase==='planned'?'予定地を置きました。建材がそろうと住人が建てます':'置きました',2100);return true;}
$('build').onclick=()=>ui.drawer?closeDrawer():openDrawer();$('closeDrawer').onclick=closeDrawer;$('deselect').onclick=deselect;
$('move').onclick=()=>{const id=ui.selected,room=ui.selectedRoom;view.roomId=room;beginPlacement(world.list(room).find(o=>o.id===id).kind,id);};
$('enter').onclick=()=>enterRoom(ui.selected);
function enterRoom(id){cancelPlacement();closeDrawer();deselect();if(view.enterRoom(id)){const d=defs[world.object(id).kind],open=d.open||['yard','market','orchard','pond'].includes(d.shape);$('leaveRoom').hidden=false;$('leaveRoom').textContent=open?'村全体へ':'屋根を戻す';ui.category='家具';toast('同じ村のまま、「つくる」でこの場所を飾れます',3000);}}
$('leaveRoom').onclick=()=>{cancelPlacement();closeDrawer();deselect();view.exitRoom();$('leaveRoom').hidden=true;ui.category='住まい';};
$('cancelPlace').onclick=cancelPlacement;$('rotate').onclick=()=>{if(ui.pending){ui.pending.rot=(ui.pending.rot+Math.PI/2)%(Math.PI*2);const h=ui.pending.roomId&&world.object(ui.pending.roomId),p=h?localToWorld(h,ui.pending.x,ui.pending.z):ui.pending;previewAt(p.x,p.z);}};
function showDialog(html){$('dialogContent').innerHTML=html;if(!$('dialog').open)$('dialog').showModal();view.interacting=true;activity();}
$('dialog').addEventListener('close',()=>{view.interacting=!!ui.pending;view.lastInteraction=performance.now();activity();});
function removeDialog(id,room){const o=world.list(room).find(o=>o.id===id);if(!o)return;showDialog(`<h2>${esc(defs[o.kind].label)}を削除</h2><p>${o.room?`室内の配置物 ${o.room.length}個も一緒に削除します。`:''}「取り消す」で同じ物と内装を戻せます。</p><p class="muted">建築に使った建材は払い戻されません。住人のいる住まいは先に住み替えが必要です。</p><button id="confirmDelete" class="wide danger">削除する</button>`);$('confirmDelete').onclick=()=>{const r=world.remove(id,room);if(r.error){toast(r.error);return;}$('dialog').close();deselect();save();toast('削除しました。「つくる」の取り消すで戻せます');};}
function buildingDetails(){const id=ui.selected,room=ui.selectedRoom,o=world.list(room).find(o=>o.id===id);if(!o)return;const d=defs[o.kind],workers=world.people.filter(p=>p.jobId===id),cost=world.upgradeCost(o),canUpgrade=d.building&&ready(o)&&o.kind!=='campfire'&&(o.level||1)<3;
 showDialog(`<span class="eyebrow">${d.clanOnly?'一族の住まい':d.building?'施設の手帖':'設置物'}</span><h2>${esc(d.label)}</h2><p>${esc(d.trait||'村の景色や住まいを整える設置物です。')}</p>${d.building?`<div class="factGrid"><span>建材<b>${esc(MATERIALS[o.material||'base'].label)}</b></span><span>増築<b>${o.level||1} / 3</b></span><span>就労<b>${workers.length} / ${jobsOf(o)}</b></span></div>`:''}${d.terrain?`<p class="muted">立地：${terrainHint(d.terrain)}</p>`:''}${d.produce?`<p>獲得：${costText(d.produce)}${(o.level||1)>1?' × '+(1+((o.level||1)-1)*.45).toFixed(2):''}${d.input?'<br>消費：'+costText(d.input):''}</p>`:''}${workers.length?'<p>働く人：'+workers.map(p=>esc(p.name)).join('、')+'</p>':''}${o.upgrade?`<p>増築中：${Math.floor(o.upgrade.progress*100)}%</p>`:canUpgrade?`<button id="upgrade" class="wide">資材を使って増築する<small>${costText(cost)}</small></button><p class="muted">${world.canAfford(cost)?'必要な資材がそろっています。':'不足：'+world.deficit(cost).join('・')}<br>敷地と内装を保ち、定員・就労枠・生産量・守りを強化します。</p>`:''}${d.clanOnly?'<p class="muted">本編接続待ち。一般NPCは入居しません。ローカルの一族ゲストは「その他」で試せます。</p>':''}${!d.reserved&&o.kind!=='campfire'?'<button id="delete" class="wide danger">この'+(d.building?'建物':'設置物')+'を削除する</button>':''}`);
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
function more(){showDialog(`<h2>村の手帖</h2><div class="row"><label for="speed">暮らしの速さ</label><select id="speed"><option value="0">時間を止める</option><option value="1">ふつう</option><option value="5">5倍</option><option value="20">20倍</option></select></div><div class="row"><label for="tilt">チルトシフト</label><input id="tilt" type="range" min="0.2" max="1.5" step="0.05" value="${world.state.settings.tilt}"></div><button class="wide" id="exportSave">村をファイルに保存</button><button class="wide" id="loadSave">保存した村を読み込む</button><button class="wide" id="photo">いまの景色を撮る</button><button class="wide" id="journal">暮らしの記録</button><button class="wide" id="help">村のしくみ</button><button class="wide" id="onlineOpen">オンライン村（参加コード）</button><details class="technical"><summary>本編との連動について</summary><p>この村は端末内で進行するローカル版です。本編のプレイヤーやモンスタープレイヤーには未接続。現在の定期襲撃はAIです。</p><button id="demoPlayer" class="wide">一族の居住を試す（ローカル）</button><p class="muted">完成した一族の邸宅が必要です。本物のオンラインプレイヤーではありません。</p></details><p class="muted">${storageOK?'端末内に自動保存しています。':'この閲覧環境では自動保存できません。ファイルに保存してください。'}<br>背景に回った間は進行せず、留守中の襲撃も進みません。</p>`);
 $('onlineOpen').onclick=openOnline;
 $('speed').value=String(world.state.settings.speed);$('speed').onchange=e=>{world.state.settings.speed=Number(e.target.value);save();};$('tilt').oninput=e=>{world.state.settings.tilt=Number(e.target.value);};$('exportSave').onclick=()=>download(world.export(),'星継ぎの庭_暮らしと守り.json');$('loadSave').onclick=()=>$('importFile').click();
 $('photo').onclick=()=>{view.render(elapsed,0);const a=document.createElement('a');a.href=$('scene').toDataURL('image/png');a.download='星継ぎの庭_風景.png';a.click();};
 $('journal').onclick=()=>{showDialog('<h2>暮らしの記録</h2>'+world.state.news.slice(0,35).map(n=>`<p class="journalEntry"><small>${Math.floor(n.day/DAYS_YEAR)+1}年目 · ${Math.floor(n.day%DAYS_YEAR)+1}日</small>${esc(n.text)}</p>`).join('')+`<p class="muted">食事 ${world.state.stats.meals}回 / 家具を飾った ${world.state.stats.furnished}回 / 襲撃 ${world.state.stats.raids}回 / 救助 ${world.state.stats.rescues}人</p>`);};
 $('demoPlayer').onclick=()=>{const r=bridge.upsert({id:'lineage-guest',name:'旅の一族（デモ）',clanId:'星渡りの一族'},{demo:true});if(r.error)toast(r.error);else{sim.refresh();$('dialog').close();closeDrawer();view.focus(r.person.x,r.person.z,32);toast('ローカルの一族ゲストを迎えました。タップで詳細を見られます。');save();}};
 $('help').onclick=()=>showDialog(`<h2>暮らしを、見守る村。</h2><p>あなたの分身である村長と、専属護衛のアルドが暮らしています。最初は空きテント、林のそばの伐採場、肥沃な土の小麦畑を置いてください。</p><p>資源を初めて得ると、新しい施設が手帖に現れます。資源が減っても一度現れた施設は消えません。空き家や屋内施設では建材を選べます。施設の「詳細」から資材を使って3段階まで増築できます。</p><p>住まいを増やすだけでは、人口は増え続けません。食事・警備・空き住まいがそろうと移住者が来ます。余裕がなくなっても、既存の住人を追い出しません。</p><p>野生動物が村人に近づくことがあります。11m以内に活動中の護衛がいれば、野生動物から致命傷を受けません。離れた場所で倒れた住人には90秒の救助時間があり、救助がなければ亡くなることもあります。村長・専属護衛・一族代理は自宅で回復します。</p><p>魔王軍のAI襲撃は定期的です。初回は約8分後、以後は撃退・撤退から約12〜14分。45秒前に気配を知らせます。人数に応じて敵数と強さが変わり、警備職は自動迎撃します。家や家具は永久破壊されません。</p><p>何も操作せず8秒ほどで、村の小さなステータスと暮らしの一幕が浮かびます。住人をタップして詳細を開くと、その人の近況も読めます。カメラはいつでも指で動かせます。</p><p class="muted">時間はこのローカル版では1日60秒、1年12日。帆船は5年ごとです。本編の時計・オンライン住人・共有戦闘・ホスト移行・乗船転送は未接続です。施設の外観は取得済みKenneyパーツの再利用。新しい専用施設モデルやフェルト品質の完成版ではありません。</p>`);
}
$('more').onclick=more;
$('importFile').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>8e6){toast('保存ファイルが大きすぎます');return;}const r=world.load(await file.text());if(r.error)toast(r.error);else{sim.refresh();view.roomId=null;view.followId=null;$('leaveRoom').hidden=true;view.rebuild();deselect();cancelPlacement();closeDrawer();save();toast('村を読み込みました');if($('dialog').open)$('dialog').close();}e.target.value='';};
function personDialog(id){const p=world.people.find(p=>p.id===id);if(!p)return;const h=world.object(p.homeId),job=world.object(p.jobId),role=p.role==='mayor'?'あなたの分身':p.id==='guard-npc'?'専属護衛':isGuard(p)?'村の警備職':isPlayer(p)?'一族プレイヤー'+(p.source==='local-player-demo'?' · デモ':''):'この村の住人';
 showDialog(`<span class="eyebrow">${esc(role)}</span><h2>${esc(p.name)}</h2><p class="personStatus">${esc(p.status||'村を眺めています')}</p>${p.clanId?'<p>一族：'+esc(p.clanId)+'</p>':''}<div class="personMeters">${[['体調',p.health],['満腹',p.hunger],['気分',p.happiness]].map(([label,n])=>`<div><span>${label}</span><meter min="0" max="100" value="${n}">${Math.floor(n)}</meter><small>${Math.floor(n)}</small></div>`).join('')}</div><p>住まい：${esc(defs[h.kind].label)}<br>仕事：${job?esc(defs[job.kind].label):isGuard(p)?'村長の同行護衛':isPlayer(p)?'冒険の合間の暮らし':'村の仕事を探しています'}<br>好きな時間：${esc(p.favorite||'村の散歩')}</p><div class="memories">${p.memories.slice(0,3).map(m=>'<p>'+esc(m.text)+'</p>').join('')}</div><button id="followPerson" class="wide">この人に、そっとカメラを合わせる</button><button id="visitHome" class="wide">この住まいの内装を見る</button>${p.id!=='guard-npc'&&p.role!=='mayor'?'<button id="relocate" class="wide">空き住まいへ住み替え</button>':''}`);
 $('followPerson').onclick=()=>{$('dialog').close();view.focus(p.x,p.z,26);view.followId=p.id;closeDrawer();deselect();toast('カメラがそっと追いかけます。指で動かすと追従を終えます。');};
 $('visitHome').onclick=()=>{$('dialog').close();enterRoom(h.id);};
 if($('relocate'))$('relocate').onclick=()=>{const homes=sim.availableHomes({player:isPlayer(p)}).filter(o=>o.id!==h.id);if(!homes.length){toast('別の空き住まいを先に用意してください');return;}const r=world.assign(p.id,homes[0].id);if(r.error)toast(r.error);else{$('dialog').close();sim.go(p,homes[0],'home');toast('新しい住まいへ向かいます');save();}};
}
function tap(x,y){const p=view.ground(x,y);if(ui.pending){if(p)placeAt(p.x,p.z);return;}closeDrawer();const person=view.pickPerson(x,y);if(person){personDialog(person);return;}const id=view.pick(x,y);if(id){if(world.object(id)){if(view.roomId&&id!==view.roomId){view.exitRoom();$('leaveRoom').hidden=true;}selection(id,null);}else selection(id,view.roomId);return;}deselect();}
const pointers=new Map();let gesture=null;
$('scene').addEventListener('pointerdown',e=>{view.touch();$('scene').setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY});view.interacting=true;gesture=null;});
$('scene').addEventListener('pointermove',e=>{const p=pointers.get(e.pointerId);if(!p){if(ui.pending){const a=view.ground(e.clientX,e.clientY);if(a)previewAt(a.x,a.z);}return;}const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
 if(pointers.size===2){const[a,b]=[...pointers.values()],dist=Math.hypot(a.x-b.x,a.y-b.y),angle=Math.atan2(b.y-a.y,b.x-a.x),cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;if(gesture){view.zoom(gesture.dist/dist);view.yaw-=angle-gesture.angle;view.pan(cx-gesture.cx,cy-gesture.cy);}gesture={dist,angle,cx,cy};for(const q of pointers.values())q.multi=true;return;}
 if(ui.pending){const a=view.ground(e.clientX,e.clientY);if(a){previewAt(a.x,a.z);const k=ui.pending.kind;if(['fence','wall','tree','pine','flowers','hedge'].includes(k)&&Math.hypot(p.x-p.sx,p.y-p.sy)>10){const d=defs[k],spacing=Math.max(d.w,d.d)+.4;if(!p.stamp||Math.hypot(a.x-p.stamp.x,a.z-p.stamp.z)>spacing){if(placeAt(a.x,a.z,{repeat:true}))p.stamp={x:a.x,z:a.z};}p.painted=true;}}}
 else if(Math.hypot(p.x-p.sx,p.y-p.sy)>4)view.pan(dx,dy);
});
function pointerEnd(e){const p=pointers.get(e.pointerId);if(!p)return;pointers.delete(e.pointerId);if(!p.multi&&!p.painted&&Math.hypot(e.clientX-p.sx,e.clientY-p.sy)<7)tap(e.clientX,e.clientY);view.interacting=!!ui.pending||pointers.size>0;view.lastInteraction=performance.now();gesture=null;}
$('scene').addEventListener('pointerup',pointerEnd);$('scene').addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);gesture=null;view.interacting=!!ui.pending;});
$('scene').addEventListener('wheel',e=>{e.preventDefault();view.zoom(Math.exp(e.deltaY*.001));},{passive:false});
function setupCardDrag(button,kind){let start=null,timer=null;
 button.addEventListener('pointerdown',e=>{start={x:e.clientX,y:e.clientY,id:e.pointerId,touch:e.pointerType==='touch',drag:false};timer=setTimeout(()=>{if(!start)return;start.drag=true;ui.lastDrag=performance.now();ui.drag={...start,kind};beginPlacement(kind);},240);});
 button.addEventListener('pointermove',e=>{if(!start)return;const distance=Math.hypot(e.clientX-start.x,e.clientY-start.y);if(distance>10&&!start.drag){clearTimeout(timer);if(!start.touch){start.drag=true;ui.drag={...start,kind};beginPlacement(kind);}}});
 button.addEventListener('pointercancel',()=>{clearTimeout(timer);start=null;});button.addEventListener('pointerup',()=>{clearTimeout(timer);start=null;});
}
document.addEventListener('pointermove',e=>{if(!ui.drag)return;const p=view.ground(e.clientX,e.clientY);if(p)previewAt(p.x,p.z);},{passive:true});
document.addEventListener('pointerup',e=>{if(!ui.drag)return;const p=view.ground(e.clientX,e.clientY);ui.lastDrag=performance.now();ui.drag=null;if(p)placeAt(p.x,p.z);});
document.addEventListener('pointercancel',()=>{if(ui.drag){ui.drag=null;cancelPlacement();}});
$('tutorialAction').onclick=()=>{const step=world.tutorialStep();if(!step)return;if(!unlocked(world.state,step.kind)){toast('まずは伐採場で働く住人から、丸太が届くのを待ちましょう');return;}ui.category=defs[step.kind].category;openDrawer();view.focus(step.at[0],step.at[1],46);};
$('dismissTutorial').onclick=()=>{world.state.tutorial.dismissed=true;$('tutorial').hidden=true;save();};
function updateTutorial(){const step=world.tutorialStep(),blocked=!!ui.pending||ui.drawer||!!ui.selected||!!view.roomId||$('dialog').open;$('tutorial').hidden=!step||blocked;
 if(step){const key=step.kind;if(key!==tutorialKey){tutorialKey=key;$('tutorialCount').textContent=`${step.index+1} / ${TUTORIAL.length}`;$('tutorialText').textContent=step.title;$('tutorialAction').setAttribute('aria-label',step.text);}}
}
function updateIdle(){const now=performance.now(),idle=now-ui.lastActivity>8000&&!ui.drag&&pointers.size===0&&!ui.drawer&&!ui.pending&&!ui.selected&&!view.roomId&&!$('dialog').open;ui.idle=idle;$('idleStatus').classList.toggle('visible',idle);$('idleMoment').classList.toggle('visible',idle);if(!idle)return;
 const s=world.state,p=world.population(),mood=s.defense.raid?(s.defense.raid.phase==='warning'?'遠くに、魔王軍の気配':'警備職が村を守っています'):world.people.some(n=>n.downed)?'負傷した住人を救助しています':'いつもの日々が、育っています。';
 $('idleMood').textContent=mood;$('idlePopulation').textContent=p.people+'人';$('idleSafety').textContent=s.defense.raid?'警戒中':p.safety>p.people?'穏やか':'守りを広げる頃';$('idleBeds').textContent=Math.max(0,p.openBeds-p.people)+'床';
 $('idleResources').textContent=s.known.filter(k=>s.stock[k]>=1).slice(0,5).map(k=>`${RESOURCE_NAMES[k]} ${Math.floor(s.stock[k])}`).join(' · ')||'最初の収穫を待っています';
 $('idleNote').textContent=p.people>=p.limit?p.reason:s.merchant.present?'旅商人が市場に滞在しています。':`${Math.floor(s.clock/DAYS_YEAR)+1}年目 · ${Math.floor(s.clock%DAYS_YEAR)+1}日　${Math.floor(s.time)}時`;
 $('idleMoment').textContent=s.moments[0]?.text||'村長とアルドが、最初の灯りを見守っています。';
}
function updateBubbles(){const now=performance.now();for(const p of world.people){if(p.bubble&&!ui.bubbles.has(p.bubble.id)){const node=document.createElement('div');node.className='speech';node.textContent=p.bubble.text;$('speechLayer').append(node);ui.bubbles.set(p.bubble.id,{node,personId:p.id,created:now});}}
 for(const[id,b]of ui.bubbles){const p=world.people.find(p=>p.id===b.personId);if(!p||now-b.created>5000){b.node.remove();ui.bubbles.delete(id);continue;}const point=view.project(p.x,2.7,p.z);b.node.style.transform=`translate(${point.x}px,${point.y}px) translate(-50%,-100%)`;b.node.hidden=ui.drawer||!!ui.pending||$('dialog').open||point.x<15||point.x>innerWidth-15||point.y<90||point.y>innerHeight-130||(p.insideId&&p.insideId!==view.roomId);}
 while(ui.bubbles.size>3){const[id,b]=ui.bubbles.entries().next().value;b.node.remove();ui.bubbles.delete(id);}
}
window.addEventListener('resize',()=>view.resize());window.addEventListener('beforeunload',save);document.addEventListener('visibilitychange',()=>{save();last=performance.now();});
world.listeners.add(()=>{renderDirty=true;});sim.onEvent=(t,type)=>{if(['threat','loss','rescue','voyage'].includes(type))toast(t,5000);};
function loop(now){if(stopped)return;try{const dt=document.hidden?0:Math.min(.25,(now-last)/1000);last=now;elapsed+=dt;frames++;frameSeconds+=dt;
 sim.update(dt*world.state.settings.speed);if(renderDirty){view.rebuild();renderDirty=false;updateContext();if(ui.selected){const o=world.list(ui.selectedRoom).find(o=>o.id===ui.selected);if(o)view.select(o,ui.selectedRoom);}}
 const actors=[...world.people,...sim.extras,...world.state.wildlife,...(sim.raid?.phase==='active'?sim.raid.monsters:[])],ids=new Set(actors.map(p=>p.id));for(const[id]of view.actorNodes)if(!ids.has(id))view.removeActor(id);for(const p of actors)view.syncActor(p,elapsed,p.id.startsWith('raid-'));view.drawTrails(sim,dt);
 if(elapsed-lastUI>.35||!frames){lastUI=elapsed;$('calendar').textContent=`${Math.floor(world.state.clock/DAYS_YEAR)+1}年目 · ${Math.floor(world.state.clock%DAYS_YEAR)+1}日`;view.setTime(world.state.time);updateContext();updateTutorial();updateIdle();if(ui.drawer)updateStockTray();const key=world.state.known.join();if(key!==knownKey){knownKey=key;if(ui.drawer)renderCatalog();}}
 updateBubbles();if(elapsed-lastSave>12){lastSave=elapsed;save();}view.interacting=!!ui.pending||!!ui.drag||pointers.size>0||$('dialog').open||$('onlineDialog').open||ui.drawer;view.render(elapsed,dt);requestAnimationFrame(loop);
}catch(error){stopped=true;window.dispatchEvent(new CustomEvent('village:fatal',{detail:error}));}
}
window.village={world,sim,view,ui,bridge,version:5,enterRoom,openDrawer,beginPlacement,cancelPlacement,selection,personDialog,buildingDetails,updateIdle,updateTutorial,save,activity,get fps(){return frameSeconds?frames/frameSeconds:0;},get storageOK(){return storageOK;}};
updateTutorial();loop(performance.now());
if(stopped)throw new Error('最初の描画に失敗しました');
Object.assign(canvas.dataset,{renderer:'ready',world:foundation.world.id,asset:foundation.world.entities[0].assetId});
$('status').dataset.state='ready';
if(!saved)await save();
return window.village;
}
