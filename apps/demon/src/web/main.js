import {activeCharacter,CHARACTER_SELECTION_ENABLED} from '../characters.js';
import {openCharacterSelection} from './character-selection.js';
import {huntUiState} from './hunt-ui-state.js';
import {renderRaidRoutes} from './raid-routes.js';
import './raid-routes.css';
import {sharedEmblemUrl} from '@soul/assets';
import noticesUrl from '@soul/night-assets/notices';
import {createExclusiveProfileStorage} from './profile-storage.js';
import {NightView} from './view.js';
import {NightAudio} from './audio.js';
import {ProfileStore} from '@soul/raid/profile';
import {RaidSession} from '@soul/raid';
import {PREY,FORMS,offerVillages,importHousing} from '@soul/raid/world';
import {SwipeInput} from '@soul/input';
import {createTidebreakRuntime} from '@soul/tidebreak-combat';
import {installOnlineRaid} from './online.js';
import {firstHuntGuide} from './first-hunt-guide.js';
import {renderLineage} from './lineage.js';

const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let view,game,store,profile,error=null,mode='title',paused=false,sheetKind='',toastUntil=0,last=0,acc=0,returnMode=false,lastHud=0;
const swipe=new SwipeInput(),audio=new NightAudio();
let disposeCharacterSelection=null;
let onlineRaid,guideState={sensed:false,lineageSeen:false};

function safe(fn){try{return fn();}catch(e){console.error(e);showError(e.message||String(e));}}
function showError(text){pauseInput();$('sheet').hidden=false;$('sheet-kicker').textContent='NOTICE';$('sheet-title').textContent='確認が必要です';$('sheet-body').innerHTML='<p class="error">'+esc(text)+'</p><p class="muted">保存データの削除や上書きによる初期化はしていません。</p>';sheetKind='error';}
function pauseInput(){game?.resetIdle();swipe.cancel();$('move-pad').hidden=true;$('dash-stop').hidden=true;}
function sheet(title,kicker,html,kind){pauseInput();$('sheet-title').textContent=title;$('sheet-kicker').textContent=kicker;$('sheet-body').innerHTML=html;$('sheet').hidden=false;sheetKind=kind;}
function closeSheet(){disposeCharacterSelection?.();disposeCharacterSelection=null;pauseInput();$('sheet').hidden=true;sheetKind='';}
function dismissSheet(){if(sheetKind==='error'&&error)return;if(mode==='result'){mode='title';$('title').hidden=false;$('hud').hidden=true;}paused=false;closeSheet();}
function characters(){if(!CHARACTER_SELECTION_ENABLED)return;disposeCharacterSelection?.();disposeCharacterSelection=openCharacterSelection({store,view,sheet,onSaved:refresh,onClose:dismissSheet});}
function refresh(){profile=store.read();game?.refreshProfile(profile);$('title-character').textContent='狩る姿 · '+activeCharacter(profile).name;}
function toast(text,d=3.5){toastUntil=performance.now()+d*1000;$('toast').textContent=text;$('toast').style.opacity='1';}
function event(e){
  if(e.type==='scent')guideState.sensed=true;
  view?.event(e);audio.event(e);
  if(e.type==='learn'&&e.first)toast('写し・'+e.name,1.8);
  if(e.type==='guardian')toast(e.echo?'異質な気配。':'警鐘。',1.8);
  if(e.type==='bell-silenced')toast('鐘、沈黙。',1.5);
  if(e.type==='ward')toast('結界。',1.2);
  if(e.type==='gate')toast('封鎖、砕く。',1.5);
  if(e.type==='finish'){mode='result';pauseInput();showResult(e);}
}
function newSession(v){
  guideState={sensed:false,lineageSeen:false};refresh();
  game=new RaidSession(v,profile,{
    event,
    consume(role){
      const first=store.unlock(role);refresh();
      if(first){
        const n=PREY[role];toast(n.power+'、刻む。',2.4);
        if([2,4,6].includes(profile.unlocked.length))setTimeout(()=>{if(mode==='hunt')toast('骨が軋む。',1.8);},900);
      }else toast('喰らう。',1.3);
    },
    learn(role,move,name){const first=store.learn(role,move);refresh();return first;},
    finish(status,n){store.finish(v.id,status,n);refresh();}
  });
  view.build(game.village);view.snapCamera(game.player);
}
async function claimAndEnter(v){try{pauseInput();await view.prepareCharacter(activeCharacter(store.read()).id);store.claim(v);closeSheet();newSession(v);mode='hunt';returnMode=false;$('title').hidden=true;$('hud').hidden=false;audio.start();toast('夜へ。',1.4);last=0;acc=0;}catch(e){showError(e.message);}}
function routes(){refresh();const offers=offerVillages(store);sheet('今夜、どこを襲う。','CHOOSE YOUR HUNT',renderRaidRoutes(offers,profile),'routes');for(const b of document.querySelectorAll('[data-village]'))b.onclick=()=>claimAndEnter(offers.find(v=>v.id===b.dataset.village));document.querySelector('[data-imported]')?.addEventListener('click',()=>claimAndEnter(profile.imported));}
function lineage(){if(game?.eaten>0)guideState.memorySeen=true;guideState.lineageSeen=!!game?.eaten;refresh();sheet('転生史','WHAT THE BODY REMEMBERS',renderLineage(profile),'lineage');}
function settings(){
  refresh();
  let html='<p>滑る。弾く。退けば、ほどける。</p><button class="inline-action" id="sound-toggle">環境音・効果音：'+(audio.enabled?'入':'切')+'<small>風、足音、警鐘、捕食、戦闘音</small></button><button class="inline-action" id="visit-log">喰痕<small>'+Object.keys(profile.visits).length+'か所</small></button><button class="inline-action" id="load-village">ハウジングの村を読み込む<small>村ゲームのセーブJSON。配置は再利用し、元のデータは変更しない。</small></button><button class="inline-action" id="load-echo">守護者の戦型を読み込む<small>輪廻転焦の技目録から、敵側の構成をオフラインで再現する。</small></button><button class="inline-action" id="credits">アセットと接続状況<small>GitHub取得素材・共通戦闘コード・実装範囲</small></button>';
  html+='<button class="inline-action" id="music-library">音楽室・BGM音量<small>曲の選択とBGM音量。環境音・効果音とは別の設定です。</small></button><button class="inline-action" id="online-settings">実プレイヤーの村<small>村長から受け取った参加コードで接続する。</small></button>';
  if(mode==='hunt')html+='<button class="inline-action" id="give-up">この夜から離れる<small>喰痕だけ残る。</small></button>';
  sheet(mode==='hunt'?'闇で、ひと息。':'記録と連携','THE NIGHT REMEMBERS',html,'settings');
  $('music-library').hidden=!window.__SOUL_MUSIC__;$('music-library').onclick=()=>window.__SOUL_MUSIC__?.open();$('online-settings').onclick=()=>onlineRaid.open();$('sound-toggle').onclick=()=>{audio.start();audio.toggle();settings();};$('visit-log').onclick=visits;$('load-village').onclick=()=>importFile('village');$('load-echo').onclick=()=>importFile('echo');$('credits').onclick=credits;
  $('give-up')?.addEventListener('click',()=>{sheet('夜を抜ける。','LEAVE THE SCAR','<p>喰痕だけが残る。</p><button class="primary" id="confirm-leave">闇へ戻る</button>','leave');$('confirm-leave').onclick=()=>game.finish('escaped');});
}
function visits(){refresh();const rows=Object.values(profile.visits).reverse();sheet('喰痕','SCARS ON THE NIGHT',rows.length?rows.map(v=>`<div class="visit-row">${esc(v.name)}<span>${({entered:'夜の中',escaped:'離脱',defeated:'死亡',abandoned:'途絶',completed:'喰い抜け'})[v.status]} · 閉</span></div>`).join(''):'<p>まだ、地図に傷はない。</p>','visits');}
function credits(){sheet('この夜の成り立ち。','SOURCE / CONNECTION',`<p>移動と戦闘は、取得したTidebreakの判定・序破急・間合い・被弾処理を再利用しています。</p><div class="credits">GitHub取得：KayKit Dungeon Remastered / Kay Lousberg / CC0<br>floor_tile_small.obj：石畳<br>banner_blue.obj：村門・礼拝所の布<br><br>家屋：ハウジング実装のモデル生成コードを再利用<br>怪物・人間：この試作の手続き型モデル<br>音：この試作の合成音<br>描画：Three.js / MIT</div><p>現在はオフラインの単独狩りです。輪廻転焦の実アカウント、村の共有サーバー、実プレイヤー対戦には未接続です。</p><p class="muted">喰痕はこのブラウザへ保存します。端末をまたぐ永続化には、今後アカウント側の台帳を接続します。</p><div class="provenance">ASSET COMMIT b0ca9bd9<br>RINNE REFERENCE: ZIP同梱 Tidebreak Atelier<br>LEGACY COMBAT SOURCE: TIDEBREAK ATELIER 10<br>${esc(__BUILD_INFO__.environment.toUpperCase())} / ${esc(__BUILD_INFO__.commit.slice(0,12))}<br><a href="${esc(noticesUrl)}" target="_blank" rel="noopener">利用素材とライセンス</a></div>`,'credits');}
function importFile(kind){
  const f=$('import-file');f.value='';
  f.onchange=async()=>{try{
    const file=f.files?.[0];if(!file)return;if(file.size>2_000_000)throw Error('2MB以下のJSONを選んでください。');const data=JSON.parse(await file.text());
    if(kind==='village'){
      const v=importHousing(data);store.change(p=>p.imported=v);refresh();
      sheet('村を読み込んだ。','HOUSING SAVE / LOCAL',`<p>${esc(v.name)}<br>${v.entities.length}個の配置を読み込みました。</p><p class="muted">${v.legacyIdentity?'古い保存形式のため、この所有者の村として同じ喰痕を追います。':'村IDで喰痕を照合します。'}<br>オンラインの所有権や住民データを取得したわけではありません。</p><button class="primary" id="after-import">${mode==='hunt'?'狩りへ戻る':'狩場を選ぶ'}</button>`,'import');$('after-import').onclick=()=>mode==='hunt'?closeSheet():routes();
    }else{
      const prepared=createTidebreakRuntime().decodeNotebook(data);store.change(p=>p.echo={weapon:prepared.weapon,loadout:prepared.slots,name:'技目録の守護者'});refresh();
      sheet('守護者の戦型を読み込んだ。','RINNE SKILL NOTEBOOK / LOCAL','<p>次の村で警戒が高まると、この構成を持つ守護者が現れる。</p><p class="muted">これは敵側の再現です。自分の技を設定する機能ではありません。</p>','import');
    }
  }catch(e){showError('読み込みできません：'+e.message);}};f.click();
}
function showResult(e){
  const headline=e.status==='defeated'?'一生が、ここで切れた。':e.target?'その命を、次の生へ。':'闇へ、持ち帰る。';
  const copied=new Set(Object.values(profile.adaptations||{}).flatMap(a=>a.moves||[])).size;
  const after=e.status==='defeated'?'刻みは残る。':e.target?'命は沈んだ。':'刻みは持ち越す。';
  sheet(headline,'THE HUNT IS OVER',`<div class="result-stats"><div><b>${e.eaten}</b><span>今夜の捕食</span></div><div><b>${profile.unlocked.length}</b><span>刻まれた特能</span></div><div><b>${copied}</b><span>写した動き</span></div></div><p>${esc(game.village.name)}に、喰痕が残った。</p><p class="muted">${after}</p><button class="primary" id="next-night">次の村を嗅ぎつける</button><button class="inline-action" id="result-memory">転生史を見る</button>`,'result');
  $('next-night').onclick=routes;$('result-memory').onclick=lineage;
}
function hud(now){
 const p=game?.player;if(!game||!p)return;const al=game.alarm,ui=huntUiState(game,{returning:returnMode}),groupCount=ui.fight?(game.combatantCount?.()||1):0;let hp=Math.max(0,p.hp);
 $('life-fill').style.width=(hp/p.maxhp*100)+'%';$('life-text').textContent=Math.ceil(hp)+' / '+p.maxhp;$('form-name').textContent=activeCharacter(profile).id==='night-creature'?FORMS[profile.form].name:activeCharacter(profile).name+' · '+FORMS[profile.form].name;$('village-name').textContent=game.village.name;$('night-label').textContent=game.village.source==='imported-local'?'HOUSING SAVE · LOCAL':'LIFE '+String(profile.currentLife?.number||1).padStart(2,'0')+' · NIGHT '+String(profile.hunts+1).padStart(2,'0');
 $('alarm-fill').style.width=al+'%';$('alarm-label').textContent=al<20?'静寂':al<45?'ざわめき':al<72?'警戒':'討伐';$('objective').querySelector('span').textContent=game.targetEaten?'帰れ。':PREY[game.village.target].name+'の「'+PREY[game.village.target].power+'」';$('objective').querySelector('small').textContent=game.targetEaten?'獲得':'今夜の獲物';
 $('battle').style.opacity=ui.fight?'1':'0';$('enemy-name').textContent=ui.fight?game.fight.npc.name+(groupCount>1?' ×'+groupCount:''):'';$('skill-name').textContent=game.fight?.retreat>0?'離脱…':p.skill||'';document.querySelectorAll('[data-phase]').forEach(e=>e.classList.toggle('active',e.dataset.phase===p.slot));$('enemy-health').style.width=ui.fight?Math.max(0,Math.min(100,game.fight.npc.hp/game.fight.npc.maxhp*100))+'%':'0';$('eaten-label').textContent='捕食 '+game.eaten+' · 特能 '+profile.unlocked.length+' · 写し '+new Set(Object.values(profile.adaptations||{}).flatMap(a=>a.moves||[])).size;
 const scent=$('scent'),memoryButton=$('memory'),returnButton=$('return');scent.querySelector('span').textContent=game.scentCooldown>0?Math.ceil(game.scentCooldown)+'秒':'嗅覚';scent.disabled=ui.scentDisabled;memoryButton.disabled=ui.memoryDisabled;returnButton.disabled=ui.returnDisabled;returnButton.classList.toggle('locked',ui.returnLocked);returnButton.setAttribute('aria-label',ui.returnLocked?'帰路。ひとつ捕食すると使えます':'帰路を表示');$('return-label').textContent=ui.returnLocked?'閉':'帰路';$('return-arrow').textContent=ui.returnLocked?'×':'⌄';$('dash-stop').hidden=!swipe.dash;const guide=firstHuntGuide(game,profile,{...guideState,returning:returnMode});const hint=$('first-hunt-guide');hint.hidden=!guide;$('hud').dataset.guide=guide?.step||'';if(guide&&hint.dataset.step!==guide.step){hint.dataset.step=guide.step;hint.textContent=guide.text;}else if(!guide){hint.dataset.step='';hint.textContent='';}$('swipe-hint').style.opacity=!guide&&game.time<14&&!ui.fight?'1':'0';
 const exit=game.nearestEscape?.()||{id:'entry',label:'村口',x:game.village.entry.x,z:game.village.entry.z,distance:Math.hypot(game.village.entry.x-p.x,game.village.entry.z-p.z)},dist=exit.distance;if(ui.returnLocked)$('return-arrow').style.transform='none';else $('return-arrow').style.transform=`rotate(${-Math.atan2(exit.x-p.x,exit.z-p.z)*180/Math.PI}deg)`;$('return-hint').hidden=!ui.showReturnHint;$('return-hint').textContent=game.escapeHold>0?'静止…':`${exit.label} ${Math.ceil(dist)} m`;$('toast').style.opacity=now<toastUntil?'1':'0';
}
function installInput(){
  const el=$('game');el.oncontextmenu=e=>e.preventDefault();
  el.addEventListener('pointerdown',e=>{if(mode!=='hunt'||!$('sheet').hidden||paused||e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();if(!swipe.down(e.pointerId,e.clientX,e.clientY,performance.now()))return;game.resetIdle();el.setPointerCapture(e.pointerId);$('move-pad').hidden=false;$('move-pad').style.left=e.clientX+'px';$('move-pad').style.top=e.clientY+'px';$('move-nub').style.transform='';});
  el.addEventListener('pointermove',e=>{if(!swipe.move(e.pointerId,e.clientX,e.clientY,performance.now()))return;e.preventDefault();const d=Math.hypot(swipe.dx,swipe.dy)||1,k=Math.min(1,34/d);$('move-nub').style.transform=`translate(${swipe.dx*k}px,${swipe.dy*k}px)`;});
  el.addEventListener('pointerup',e=>{if(swipe.id!==e.pointerId)return;e.preventDefault();const flick=swipe.up(e.pointerId,e.clientX,e.clientY,performance.now());$('move-pad').hidden=true;if(el.hasPointerCapture(e.pointerId))el.releasePointerCapture(e.pointerId);if(flick)game.shadowStep(swipe.vector(.33));});
  el.addEventListener('pointercancel',pauseInput);el.addEventListener('lostpointercapture',()=>{if(swipe.id!==null)pauseInput();});
  window.addEventListener('blur',()=>{pauseInput();if(mode==='hunt'&&$('sheet').hidden){paused=true;sheet('夜を、止めている。','PAUSED','<p>閉じると再開。</p>','paused');}});
  document.addEventListener('visibilitychange',()=>{pauseInput();audio.pause(document.hidden);if(document.hidden&&mode==='hunt'&&$('sheet').hidden){paused=true;sheet('夜を、止めている。','PAUSED','<p>閉じると再開。</p>','paused');}});
}
function frame(now){
  if(error)return;requestAnimationFrame(frame);
  try{
    if(!view||!game)return;const dt=Math.max(0,Math.min(.07,(now-(last||now))/1000));last=now;const running=mode==='hunt'&&$('sheet').hidden&&!paused&&!document.hidden;
    if(running){acc=Math.min(.10,acc+dt);let steps=0;while(acc>=1/60&&steps++<6){const v=swipe.vector(.33);v.dash=swipe.dash;v.active=swipe.id!==null;game.tick(1/60,v);acc-=1/60;if(game.fight&&swipe.dash)pauseInput();if(game.finished)break;}audio.tick(dt,game.player.speed>.15&&!game.fight);}else acc=0;
    view.update(game,dt,mode==='title');if(now-lastHud>80){hud(now);lastHud=now;}
  }catch(e){error=e;pauseInput();console.error(e);$('boot').hidden=false;$('boot-message').textContent='狩場を再開できません';$('boot-detail').textContent=e.message;$('boot-retry').hidden=false;$('game').dataset.renderer='error';}
}
export async function boot(){
  const storage=await createExclusiveProfileStorage(__BUILD_INFO__.environment);view=new NightView($('game'));store=new ProfileStore(storage,()=>crypto.randomUUID(),()=>Date.now());profile=store.read();store.abandonInterrupted();profile=store.read();
  const preview={id:'title-only-not-entered',name:'森の向こうの灯',seed:67002,target:'arcanist',level:1,weather:'fog',source:'generated'};game=new RaidSession(preview,profile,{});view.build(game.village);await view.prepareCharacter(activeCharacter(profile).id);game.player.x=1;game.player.z=20;game.player.yaw=.5;view.camera.position.set(5,3.6,27);view.cameraLook.set(1,.95,18);view.update(game,0,true);$('game').dataset.renderer='ready';Object.assign($('game').dataset,{app:'demon',commit:__BUILD_INFO__.commit,environment:__BUILD_INFO__.environment,platform:'web',world:'night-hunt.v3',asset:'kaykit.floor_tile_small'});$('emblem').src=sharedEmblemUrl;$('boot').hidden=true;$('title').hidden=false;
  $('title-character').hidden=!CHARACTER_SELECTION_ENABLED;if(CHARACTER_SELECTION_ENABLED)$('title-character').onclick=()=>safe(characters);refresh();
  $('begin').onclick=()=>safe(()=>{audio.start();routes();});$('title-memory').onclick=()=>safe(lineage);$('title-settings').onclick=()=>safe(settings);$('connection').onclick=credits;
  $('game').addEventListener('webglcontextlost',e=>{e.preventDefault();error=Error('描画が中断されました。再試行するとタイトルへ戻ります。喰痕は保持します。');pauseInput();$('boot').hidden=false;$('boot-message').textContent='描画が中断されました';$('boot-detail').textContent=error.message;$('boot-retry').hidden=false;$('game').dataset.renderer='lost';});
  $('pause').onclick=()=>safe(settings);$('memory').onclick=()=>safe(lineage);$('scent').onclick=()=>{game.resetIdle();audio.start();game.sense();};$('return').onclick=()=>{game.resetIdle();const ui=huntUiState(game,{returning:returnMode});if(ui.returnDisabled)return;if(ui.returnLocked){toast('まだ、帰れない。',1.5);return;}returnMode=!returnMode;toast(returnMode?'帰路、開く。':'帰路、閉じる。',1.4);};$('dash-stop').onclick=pauseInput;
  $('sheet-close').onclick=dismissSheet;
  window.addEventListener('resize',()=>view.resize());installInput();requestAnimationFrame(frame);
  window.__NIGHT_HUNT__={snapshot:()=>({mode,paused:!$('sheet').hidden||paused,source:game.village.source,village:game.village.id,visited:Object.keys(store.read().visits),profile:store.read(),player:JSON.parse(JSON.stringify(game.player)),npcs:game.village.npcs.map(n=>({id:n.id,kind:n.kind,adult:n.adult,role:n.role,hp:n.hp,dead:n.dead,eaten:n.eaten,x:n.x,z:n.z,marked:n.marked,state:n.state})),devouring:!!game.devour,combat:game.fight?{...game.fight.core.state(),retreat:game.fight.retreat}:null,eaten:game.eaten,alarm:game.alarm,time:game.time,finished:game.finished,metrics:view.metrics(),input:{id:swipe.id,dx:swipe.dx,dy:swipe.dy,amount:swipe.amount,dash:swipe.dash}}),openRoutes:routes};
  onlineRaid=installOnlineRaid(()=>window.__NIGHT_HUNT__.snapshot());
  if(import.meta.env.DEV&&new URLSearchParams(location.search).has('review'))window.__NIGHT_REVIEW__={enter:async(i=0)=>{await claimAndEnter(offerVillages(store)[i]);},nearHuman(i=0){const n=game.village.npcs[i];game.player.x=n.x;game.player.z=n.z+2.5;game.player.yaw=Math.PI;},setPosition(x,z){game.clearCombat?.();game.devour=null;game.player.x=x;game.player.z=z;game.player.pose=null;},step(n=1){for(let i=0;i<Math.min(n,36000)&&!game.finished;i++)game.tick(1/60,{x:0,z:0,amount:0});},unlock(k){store.unlock(k);refresh();},finish(s='escaped'){game.finish(s);},retry(id){return store.claim({id,name:'再訪テスト'});},read:()=>store.read(),screenshot(){view.update(game,1/60,false);hud(performance.now());},ready:()=>!!game};
}
