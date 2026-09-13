import {defaultMuraLayout,validateMuraLayout,projectMuraLayout} from '@soul/world/mura';
import {createSharedWorldChannel} from '@soul/platform-web/shared-world';
import {Story,GIFTS,EXPERIENCES} from '../game/story.js';
import {readStorySave,createStorySave} from '../game/story-save.js';
import {createStoryScene} from './scene.js';
import css from './story.css?inline';
import {createPlayInterface} from './interface.js';
import {acquireStorySaveLease} from './save-lease.js';

/** Browser adapter for the portable story and the existing, same-origin game port. */
export async function mountStory(win,environment,{signal,onExit,onMusic}={}){
  const doc=win.document,port=win.__RINNE_GAME_PORT__;
  if(port?.version!==1)throw Error('本編のゲーム接続を確認できません。');
  const key=`soul.${environment}.rinne.story.v1`;let raw=null,storageMessage='',active=false,disposed=false;
  const lease=await acquireStorySaveLease(win,key,signal);
  if(!lease.persistent)storageMessage='この環境では自動保存できません。記録から保存データを書き出せます。';
  try{raw=win.localStorage.getItem(key);}catch{storageMessage='この環境では保存できません。保存データを書き出して保管してください。';}
  const saved=raw?readStorySave(JSON.parse(raw)):null;let layout=saved?.world||defaultMuraLayout();
  const worldChannel=createSharedWorldChannel({environment,validate:validateMuraLayout,window:win});
  try{const current=worldChannel.read();if(current&&(!saved||current.id===layout.id))layout=current;}catch(error){storageMessage='共通マップを更新できません：'+error.message;}
  let story=new Story(saved?.story,layout);
  await port.restore(saved?.runtime);
  if(signal?.aborted)return()=>{};
  const scene=await createStoryScene(port,doc,layout);
  if(signal?.aborted){scene.dispose();return()=>{};}
  if(!saved){const start=story.places.find(p=>p.id==='home');port.position(start.x,start.z);}scene.relocate();
  const abort=new win.AbortController(),on=(el,type,fn)=>el.addEventListener(type,fn,{signal:abort.signal});
  const style=doc.createElement('style');style.textContent=css;doc.head.append(style);doc.body.dataset.story='true';
  doc.getElementById('game').setAttribute('aria-label','輪廻転焦本編。現在の移動操作で村や前線を歩きます。');
  const dialog=doc.createElement('dialog');dialog.id='story-dialog';dialog.setAttribute('aria-labelledby','story-dialog-title');dialog.innerHTML='<h2 id="story-dialog-title">暮らしの記録</h2><div id="story-dialog-content"></div><div class="story-dialog-actions"><button id="story-export">保存を書き出す</button><button id="story-import">保存を読み込む</button><button id="story-map-import">村の配置を読み込む</button><button id="story-close">閉じる</button></div><input type="file" accept="application/json,.json" id="story-file" hidden><input type="file" accept="application/json,.json" id="story-map-file" hidden>';
  const death=doc.createElement('dialog');death.id='story-ended';death.setAttribute('aria-labelledby','story-ended-title');death.innerHTML='<p class="story-kicker">ひとつの生涯、その終わり</p><h2 id="story-ended-title">また、どこかで。</h2><p>90年を生き終えました。技と装備の設定は、次の人生にも残ります。</p><label for="story-memento">この生涯を象徴するもの</label><select id="story-memento"></select><button id="story-rebirth">もう一度、生まれる</button>';
  doc.body.append(dialog,death);const $=id=>doc.getElementById(id);let signature='',saveElapsed=0,lastNotice='',noticeUntil=0;
  const ui=createPlayInterface({win,port,onRecords:openRecords,onExit,onMusic,onAction:perform});
  $('game').tabIndex=0;
  $('settingsTitle').textContent='戦いの手帳';
  doc.querySelector('.modal-footer > span').firstChild.textContent='輪廻転焦 · 戦いの手帳 / ';
  $('settingsDialog').querySelector('.eyebrow').textContent='輪廻転焦 · 技と身支度';
  $('settingsDialog').querySelector('.modal-status').textContent='手帳を閉じるまで時が止まります';
  $('tab-character').textContent='身支度';
  $('tab-overview').textContent='技を組む';
  $('tab-saved').firstChild.textContent='技目録 ';
  $('closeSettings').setAttribute('aria-label','手帳を閉じて冒険に戻る');
  doc.querySelector('#panel-character .humanoid-details')?.remove();
  function notice(text){lastNotice=text;noticeUntil=win.performance.now()+6500;$('story-message').textContent=text;}
  function save(){if(!active||disposed||!ui.canPause())return false;
    try{if(!lease.persistent)throw Error('この環境では保存の排他制御を利用できません。');win.localStorage.setItem(key,JSON.stringify(createStorySave(story,port.save(),layout)));storageMessage='';$('story-storage').textContent='';return true;}
    catch(error){storageMessage=`保存できません：${error.message} 記録から書き出せます。`;$('story-storage').textContent=storageMessage;return false;}
  }
  function sync(){const s=story.state;scene.sync(s,layout);port.posture({carried:s.phase==='birth',moveScale:s.resting?0:s.rescue?.status==='carried'?.62:1});}
  function endScreen(){if(death.open)return;if(ui.canPause())port.pause(true);else port.blockInput(true);const select=$('story-memento');select.replaceChildren();
    for(const name of ['村で過ごした日々',...port.notebook().recipes.map(r=>r.name)]){const option=doc.createElement('option');option.textContent=name;option.value=name;select.append(option);}if(dialog.open)dialog.close();death.showModal();}
  function button(text,action,enabled=true){const b=doc.createElement('button');b.type='button';b.textContent=text;b.disabled=!enabled;b.dataset.action=action;return b;}
  function render(force=false){
    const f=port.snapshot(),s=story.state,place=story.nearest(f.hero),near=s.zone==='village'&&story.near(place,f.hero);
    $('story-zone').textContent=s.zone==='village'?'故郷の村':s.front===5?'最終前線':`第${s.front+1}前線`;
    $('story-summary').textContent=`第${s.generation}生 · 世界暦${Math.floor(f.life.worldSeconds/60)}年`;
    $('story-hp').style.width=`${Math.max(0,f.hero.hp/f.hero.maxhp*100)}%`;
    $('story-hp').parentElement.setAttribute('aria-label',`体力 ${Math.ceil(f.hero.hp)} / ${f.hero.maxhp}`);
    $('story-storage').textContent=storageMessage;
    $('story-objective').textContent=f.hero.dead?`救助を待っています。あと${Math.ceil(Math.max(0,(s.zone==='village'?12:40)-s.downedSeconds))}秒`:
      s.phase==='birth'?'はじまりの贈り物を、ふたつ選ぼう。':s.zone==='frontier'?(s.cleared?'前線を突破。先へ進むか、帰還船へ。':'村人を救助し、前線を突破しよう。'):
      f.life.ageYears<7?'焚き火へ向かい、村の暮らしに触れよう。':f.life.ageYears<15?'村で経験を重ねよう。15歳から船に乗れる。':story.canDepart(f.life)?'出航の年。船着き場から前線へ向かえる。':`次の出航：世界暦${story.nextDeparture(f.life)}年。村で暮らし続けてもよい。`;
    $('story-place').textContent=s.phase==='birth'?'母の腕の中':s.zone==='frontier'?'前線でできること':near?place.name:`${place.name}まで ${Math.hypot(place.x-f.hero.x,place.z-f.hero.z).toFixed(1)}m`;
    const sig=JSON.stringify([s.phase,s.zone,near?place.id:null,f.hero.dead,Math.floor(f.life.ageYears)>=7,story.canDepart(f.life),!!s.activity,s.resting,s.gifts,s.pendingDiscoveries,s.cleared,s.front,s.rescue?.status,s.rescue&&story.near(s.rescue,f.hero),story.near({x:-5,z:3},f.hero)]);
    if(force||signature!==sig){signature=sig;const buttons=[];const add=(text,id,enabled=true)=>buttons.push(button(text,id,enabled));
      if(s.phase==='birth'){for(const [id,name] of Object.entries(GIFTS))add(`${s.gifts.includes(id)?'受取済み：':''}${name}`,`gift:${id}`,s.gifts.length<2&&!s.gifts.includes(id));add('母に話す','talk');add('自分の足で歩く','release');}
      else if(s.phase==='living'&&!f.hero.dead){
        if(s.zone==='village'){
          for(const p of story.places.filter(p=>p.activity&&story.near(p,f.hero)))add(p.verb,`activity:${p.activity}:${p.id}`,!s.activity);
          add('周囲を観察','activity:observe:field',!s.activity);add('足跡を追う','activity:track:field',!s.activity);
          if(story.near(story.places.find(p=>p.id==='armory'),f.hero))for(const weapon of port.weapons())add(weapon.name,`equip:${weapon.id}`,f.life.ageYears>=7);
          if(story.near(story.places.find(p=>p.id==='port'),f.hero))add('船に乗る','travel',story.canDepart(f.life));
        }else{
          if(s.rescue?.status==='waiting')add('村人を抱える','rescue',story.near(s.rescue,f.hero));
          if(s.rescue?.status==='carried')add(story.near({x:-5,z:3},f.hero)?'救護所へ届ける':'村人を降ろす','rescue');
          if(s.cleared&&s.front<5)add('次の前線へ','next',s.rescue?.status!=='carried');
          add('村へ帰る','travel',story.near({x:-5,z:3},f.hero));
        }
        if(s.activity)add('行動をやめる','cancel');add(s.resting?'休息を終える':'休息する','rest');if(s.pendingDiscoveries.length)add('閃いた技を受け取る','discover');
      }
      ui.actions(buttons,s);
    }
    if(s.activity)$('story-message').textContent=`${EXPERIENCES[s.activity.kind]}を続けています… ${Math.ceil(s.activity.remaining)}秒`;
    else $('story-message').textContent=lastNotice&&win.performance.now()<noticeUntil?lastNotice:s.phase==='birth'?'母「この小さな宝物が、あなたの旅を見守りますように。」':s.resting?'腰を下ろして回復中。スワイプすると歩き出します。':'';
    ui.update({frame:f,story,layout});
    if(s.phase==='ended')endScreen();sync();
  }
  on(doc,'click',event=>{const b=event.target.closest('[data-action]');if(!b||b.disabled||!b.closest('#story-actions,#story-choice-dialog'))return;perform(b.dataset.action);});
  function perform(action){const [kind,id,place]=action.split(':'),f=port.snapshot();port.stopMove();let result=false;
    if(story.state.phase!=='living'&&['rest','cancel'].includes(kind))return;
    if(kind==='gift')result=story.gift(id);
    if(kind==='talk'){notice('母「焦らなくていい。人と暮らして、あなたの生き方を見つけてね。」');return;}
    if(kind==='release'){result=story.release();ui.selectTarget('garden');}
    if(kind==='activity')result=story.startActivity(id,place,f);
    if(kind==='equip'&&story.near(story.places.find(p=>p.id==='armory'),f.hero)){result=port.equip(id);if(result)story.log('武具庫で装備を選んだ。');}
    if(kind==='cancel'){story.state.activity=null;result=true;story.log('生活行動を中断した。');}
    if(kind==='rest'){story.state.resting=!story.state.resting;story.state.activity=null;result=true;story.log(story.state.resting?'腰を休め、体力を回復している。':'また歩き始めた。');}
    if(kind==='travel'){result=story.travel(f);if(result){if(story.state.zone==='frontier')port.encounter(0);else port.village(story.places.find(p=>p.id==='port'));}}
    if(kind==='next'){result=story.nextFront(f);if(result)port.encounter(story.state.front);}
    if(kind==='rescue')result=story.rescue(f);
    if(kind==='discover'){
      for(const discovery of [...story.state.pendingDiscoveries])if(port.discover(`${story.state.generation}-${discovery}`,'暮らしの閃き')){story.state.pendingDiscoveries=story.state.pendingDiscoveries.filter(d=>d!==discovery);result=true;}
      notice(result?'閃いた技を技目録へ加えました。装備は技設定から選べます。':'技目録が満杯です。整理してから受け取れます。');
    }else lastNotice='';
    if(result){if(kind!=='discover')notice(story.state.events[0]||'');sync();save();}if(!['gift','talk'].includes(kind))ui.closeChoices();render(true);
  }
  function paragraph(parent,text){const p=doc.createElement('p');p.textContent=text;parent.append(p);}
  function records(){const s=story.state,f=port.snapshot(),content=$('story-dialog-content');content.replaceChildren();
    paragraph(content,`村：${layout.name} · 配置 ${layout.revision}`);
    paragraph(content,`持ち物（${s.gifts.length}/2）：${s.gifts.map(id=>GIFTS[id]).join('・')||'なし'}`);
    paragraph(content,`生活経験：${Object.entries(s.experiences).map(([k,n])=>`${EXPERIENCES[k]} ${n}`).join(' / ')}`);
    paragraph(content,`今回の生涯：救助 ${s.rescued}人、前線突破 ${s.victories}回`);
    const map=doc.createElement('div');map.className='story-place-list';for(const p of story.places)paragraph(map,`${p.name}：${p.z<0?'村の北側':'村の南側'}・${p.x<0?'西寄り':'東寄り'}`);content.append(map);
    paragraph(content,`村の人々（${s.residents.length}/30）：${s.residents.map(r=>`${r.name} ${Math.max(0,Math.floor((f.life.worldSeconds-r.bornAt)/60))}歳`).join('、')}`);
    paragraph(content,'生涯の記録');if(!s.history.length)paragraph(content,'最初の人生を歩んでいます。');
    for(const h of s.history)paragraph(content,`第${h.generation}生 · 世界暦${Math.floor(h.worldEnd/60)}年まで · 救助${h.rescued}人 · 突破${h.victories}回 · ${h.memento}`);
    for(const event of s.events.slice(0,12))paragraph(content,event);
  }
  function openRecords(){records();ui.openDialog(dialog);}
  on($('story-close'),'click',()=>dialog.close());on(dialog,'keydown',e=>e.stopPropagation());on(death,'keydown',e=>e.stopPropagation());
  on(dialog,'close',()=>{$('game').focus({preventScroll:true});save();render(true);});
  on(death,'cancel',e=>e.preventDefault());
  on($('story-rebirth'),'click',()=>{story.memento($('story-memento').value);if(story.rebirth(port.snapshot().life)){port.rebirth();const start=story.places.find(p=>p.id==='home');port.position(start.x,start.z);scene.relocate();death.close();lastNotice='';sync();save();render(true);}});
  on($('story-export'),'click',()=>{const data=JSON.stringify(createStorySave(story,port.save(),layout),null,2),url=win.URL.createObjectURL(new win.Blob([data],{type:'application/json'})),a=doc.createElement('a');a.href=url;a.download='rinne-story-save.json';a.click();win.setTimeout(()=>win.URL.revokeObjectURL(url),1000);});
  on($('story-import'),'click',()=>$('story-file').click());
  on($('story-file'),'change',async()=>{const file=$('story-file').files[0];if(!file)return;
    try{if(!ui.canPause())throw Error('共有世界では保存の置き換えはできません。');if(file.size>2000000)throw Error('保存ファイルが大きすぎます。');const imported=readStorySave(JSON.parse(await file.text()));await port.restore(imported.runtime);layout=imported.world;story=new Story(imported.story,layout);sync();save();records();render(true);notice('保存した人生を読み込みました。');}
    catch(error){paragraph($('story-dialog-content'),`読み込めません：${error.message}`);}finally{$('story-file').value='';}
  });
  on($('story-map-import'),'click',()=>$('story-map-file').click());
  on($('story-map-file'),'change',async()=>{const file=$('story-map-file').files[0];if(!file)return;
    try{if(!ui.canPause())throw Error('共有世界の配置は村の管理者が更新します。');if(file.size>8000000)throw Error('村の配置が大きすぎます。');const value=JSON.parse(await file.text()),next=value.schemaVersion===1&&value.terrainId?validateMuraLayout(value):projectMuraLayout(value.payload||value);applyWorld(next,true);records();paragraph($('story-dialog-content'),'村の配置を読み込みました。村の元データは変更しません。');}
    catch(error){paragraph($('story-dialog-content'),'村を読み込めません：'+error.message);}finally{$('story-map-file').value='';}
  });
  function applyWorld(next,explicit=false){if(!next||disposed)return;if(!explicit&&next.id!==layout.id){notice('別の村が更新されました。今いる村を引き続き表示します。');return;}layout=next;story.setWorld(layout);sync();if(story.state.zone==='village')scene.relocate();save();render(true);}
  const unsubscribeWorld=worldChannel.subscribe(next=>applyWorld(next),error=>notice('共通マップの更新を保留しました：'+error.message));
  const unsubscribe=port.subscribe(seconds=>{if(disposed)return;const f=port.snapshot();for(const effect of story.tick(seconds,f)){
    if(effect==='recover'){port.recover();port.village(story.places.find(p=>p.id==='clinic'));scene.relocate();}
    if(effect==='released')port.stopMove();
    if(effect==='heal'||effect==='heal-clinic')port.heal(f.hero.maxhp*seconds/(effect==='heal-clinic'?6:40));
  }sync();saveElapsed+=seconds;if(story.state.phase==='ended'||saveElapsed>=2){saveElapsed=0;save();}if(story.state.phase==='ended')render();});
  let pointerStart=null;
  on($('game'),'pointerdown',e=>{pointerStart={x:e.clientX,y:e.clientY};if(story.state.resting&&!port.snapshot().paused){story.state.resting=false;sync();notice('立ち上がって、歩き始めた。');render(true);}});
  on($('game'),'pointermove',e=>{if(pointerStart&&story.state.activity&&Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)>8){story.state.activity=null;notice('歩き始めたので、行動を中断しました。');render(true);}});
  for(const type of ['pointerup','pointercancel'])on($('game'),type,()=>pointerStart=null);
  const uiTimer=win.setInterval(()=>{if(!doc.hidden&&!disposed)render();},200);
  on(doc,'visibilitychange',save);on(win,'pagehide',save);
  // Native notebook controls keep their current composition/equipment semantics.
  on($('settingsDialog'),'close',()=>{save();render(true);});on($('lifeDialog'),'close',save);
  const dispose=()=>{if(disposed)return;save();disposed=true;active=false;lease.release();if(ui.canPause())port.pause(true);else port.blockInput(true);unsubscribe();unsubscribeWorld();abort.abort();win.clearInterval(uiTimer);scene.dispose();ui.destroy();dialog.remove();death.remove();style.remove();delete doc.body.dataset.story;};
  signal?.addEventListener('abort',dispose,{once:true});
  active=true;sync();render(true);save();if(story.state.phase!=='ended')port.pause(false);
  return dispose;
}
