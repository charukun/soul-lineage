import {createMenuGate,SOLO_SESSION} from './menu-gate.js';
import {riverX,defs} from '@soul/world/mura';

const paths={
 soul:'M12 2C9 7 4 9 5 15a7 7 0 0 0 14 0c0-3-2-5-3-7 0 4-3 4-3 7-3-3 0-8-1-13Z',
 map:'m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Zm6-2v16m6-14v16',
 book:'M4 3h14l2 2v16H6l-2-2Zm0 14h16M8 7h8M8 11h6',
 sword:'m15 3 6-1-1 6L9 19l-4-4ZM4 13l7 7m-7-2-2 4m1-3 3 3',
 bag:'M8 7V5a4 4 0 0 1 8 0v2M6 7h12l3 14H3Zm3 5h6',
 menu:'M5 5h14M5 12h14M5 19h14M3 5h0m0 7h0m0 7h0',
 close:'m6 6 12 12M6 18 18 6',
 compass:'m12 2 4 8 6 2-6 4-4 6-4-6-6-4 6-2Zm0 6-2 5 4-2Z',
 hand:'M8 12V5a2 2 0 0 1 4 0v5-6a2 2 0 0 1 4 0v7-5a2 2 0 0 1 4 0v9c0 4-2 6-6 6h-3c-3 0-4-3-6-5l-3-4c-1-2 1-3 3-1l3 2',
 talk:'M3 4h18v12H10l-6 5v-5H3Zm4 4h10M7 12h7',
 bell:'M5 17h14l-2-4V9a5 5 0 0 0-10 0v4Zm5 3h4M12 2v2',
 stone:'m5 8 9-5 6 7-2 9-11 2-4-7Zm0 0 7 5 8-3m-8 3 6 6',
 feather:'M4 21 17 6M5 15C1 8 11 1 21 3c0 10-8 18-14 14m2-8 4 1m0 4 4 1',
 rest:'M4 20h16M6 20v-5h12v5M8 15l-3-6m13 6 2-6M10 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 2 4 4h4',
 walk:'M15 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-5 3 4-1 3 5 4 1M7 14l3-6-1 8-5 5m5-5 6 1 1 5',
 ship:'M12 2v13M12 3l7 9h-7M10 5l-5 7h5M3 16h18l-4 5H7Z',
 star:'m12 2 2.5 7 7.5 3-7.5 3-2.5 7-2.5-7L2 12l7.5-3Z',
 eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
 pause:'M8 4v16M16 4v16', play:'m7 3 14 9-14 9Z', home:'m2 11 10-9 10 9M5 9v12h14V9M10 21v-7h4v7',
 sound:'m3 9 5 0 5-5v16l-5-5H3Zm14-3c4 3 4 9 0 12m0-8c1 1 1 3 0 4',
 camera:'M3 7h5l2-3h5l2 3h4v14H3Zm9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
};
export const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${paths[name]||paths.star}"/></svg>`;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const markFor=action=>({gift:'star',talk:'talk',release:'walk',activity:'hand',equip:'sword',travel:'ship',rescue:'hand',next:'compass',rest:'rest',discover:'star',cancel:'close',weapons:'sword'}[action.split(':')[0]]||'hand');

/** Presentation only. Inputs and combat are still owned by the native game port. */
export function createPlayInterface({win,port,onRecords,onExit,onMusic,onAction}){
 const doc=win.document,$=id=>doc.getElementById(id),abort=new win.AbortController();
 const on=(el,type,fn,options={})=>el.addEventListener(type,fn,{...options,signal:abort.signal});
 const root=doc.createElement('div');root.id='story-interface';root.innerHTML=`
 <section id="story-hud" aria-label="生命と旅の目的">
  <div class="soul-vitals"><div id="story-age-slot"></div><div class="soul-vitals-body"><strong id="story-zone"></strong><span id="story-summary"></span><div class="story-health" role="meter" aria-label="体力" aria-valuemin="0" aria-valuemax="100"><i id="story-hp"></i></div><span id="story-health-label"></span></div></div>
  <button id="story-menu-button" class="metal-coin" aria-label="旅のメニュー" aria-haspopup="dialog">${icon('menu')}<span>旅支度</span></button>
  <div class="quest-ribbon"><span class="quest-seal">${icon('star')}</span><p id="story-objective"></p></div>
 </section>
 <p id="story-session-status" aria-live="polite">ひとりの旅</p>
 <button id="story-waypoint" aria-label="地図を開く" aria-haspopup="dialog"><span id="story-bearing">${icon('compass')}</span><span><strong id="story-target-name"></strong><small id="story-target-distance"></small></span></button>
 <div id="story-move-hint" aria-hidden="true"><span class="move-hint-ring">${icon('compass')}</span><span>ここからスワイプで歩く<small>短く弾くと走る · タップで止まる</small></span></div>
 <section id="story-actions" aria-label="近くでできること"><div class="action-caption"><span id="story-place"></span><span id="story-action-status"></span></div><div id="story-buttons"></div><button id="story-more" class="secondary-action" aria-haspopup="dialog">${icon('hand')}<span>ほかの行動</span></button></section>
 <div id="story-message-wrap"><p id="story-message" role="status" aria-live="polite"></p><progress id="story-activity-progress" max="8" value="0" hidden></progress></div>
 <nav id="story-belt" aria-label="冒険の道具"><button id="story-map" class="belt-tool" aria-haspopup="dialog">${icon('map')}<span>地図</span></button><div id="story-arts-slot"></div><button id="story-records" class="belt-tool" aria-haspopup="dialog">${icon('book')}<span>記録</span></button><button id="story-rest" class="belt-tool">${icon('rest')}<span>休む</span></button><button id="story-stop" class="belt-tool">${icon('hand')}<span>止まる</span></button></nav>
 <div id="story-pause-banner" hidden><span>時が止まっています</span><button id="story-resume">${icon('play')}<span>冒険をつづける</span></button></div>
 <p id="story-storage" role="status"></p>`;
 $('stage').append(root);
 const age=$('lifeBadge'),ageParent=age.parentElement;root.querySelector('#story-age-slot').append(age);
 const arts=$('settingsBtn'),artsParent=arts.parentElement;arts.classList.add('belt-tool');arts.innerHTML=icon('sword')+'<span>技・装備</span>';$('story-arts-slot').append(arts);
 const makeDialog=(id,title,content)=>{const d=doc.createElement('dialog');d.id=id;d.className='story-sheet';d.setAttribute('aria-labelledby',id+'-title');d.innerHTML=`<header class="sheet-heading"><div><small>輪廻転焦 · 旅の手帳</small><h2 id="${id}-title">${title}</h2></div><button class="sheet-close" aria-label="閉じる">${icon('close')}</button></header>${content}`;doc.body.append(d);on(d.querySelector('.sheet-close'),'click',()=>close(d));on(d,'keydown',e=>e.stopPropagation());return d;};
 const choices=makeDialog('story-choice-dialog','この場所でできること','<p id="story-choice-description"></p><div id="story-choice-buttons"></div>');
 const map=makeDialog('story-map-dialog','村の地図','<p class="map-instruction">行き先を選ぶと、方位と距離を表示します。</p><div id="story-map-surface"></div><div id="story-map-list"></div><section id="story-companions" hidden><h3>同じ世界の旅人</h3><ul></ul></section>');
 const menu=makeDialog('story-menu-dialog','旅支度',`<div class="travel-menu"><button data-tool="cameraBtn">${icon('camera')}<span>視点を整える<small>回転・高さ・近さ</small></span></button><button data-tool="lifeBadge">${icon('soul')}<span>時の流れ<small>年齢・世界時計</small></span></button><button data-tool="soundBtn">${icon('sound')}<span id="story-sound-label">効果音</span></button><button id="story-music">${icon('sound')}<span>音楽室<small>曲と音量</small></span></button><button data-tool="pauseBtn">${icon('pause')}<span>一時停止</span></button><button data-tool="fullscreenBtn">${icon('camera')}<span>全画面表示</span></button><button id="story-exit">${icon('home')}<span>タイトルへ<small>今の人生を保存して戻る</small></span></button></div><section class="play-guide"><h3>冒険の手引き</h3><p>空いている画面をスワイプして歩き、指を離すと止まります。短くフリックすると走り続け、画面のタップか「止まる」で停止します。</p><p>敵に近づくと自動で戦います。「技・装備」で戦い方を整えましょう。休息中もスワイプすれば歩き出せます。</p></section>`);

 const readSession=()=>port.session?.()||SOLO_SESSION;
 const gate=createMenuGate({readSession,snapshot:port.snapshot,pause:port.pause,stopMove:port.stopMove,blockInput:value=>port.blockInput(value)});
 const watched=new WeakSet();
 function watchModal(d){if(watched.has(d))return;watched.add(d);on(d,'close',()=>{gate.close(d);$('game').focus({preventScroll:true});});}
 function close(d){gate.close(d);d.close();}
 function open(d){if(d.open)return;watchModal(d);gate.open(d);d.showModal();}
 for(const d of [choices,map,menu])watchModal(d);
 for(const [buttonId,dialogId] of [['settingsBtn','settingsDialog'],['cameraBtn','cameraDialog']]){const d=$(dialogId);watchModal(d);on($(buttonId),'click',()=>{if(!d.open)gate.open(d);},{capture:true});}
 let latest=null,targetId='garden',lastSignature='',gestureOrigin=null;
 function openMap(){if(!latest)return;renderMap();open(map);}
 on($('story-map'),'click',openMap);on($('story-waypoint'),'click',openMap);on($('story-records'),'click',onRecords);
 on($('story-menu-button'),'click',()=>{ $('story-sound-label').textContent=$('soundBtn').getAttribute('aria-label')?.includes('オン')?'効果音を鳴らす':'効果音を消す';open(menu);});
 on(menu,'click',e=>{const b=e.target.closest('[data-tool]');if(!b)return;const id=b.dataset.tool;if(['pauseBtn','lifeBadge'].includes(id)&&!gate.canPause())return;close(menu);$(id).click();});
 on($('story-music'),'click',()=>{onMusic?.();});on($('story-exit'),'click',()=>{close(menu);onExit?.();});
 on($('story-more'),'click',()=>open(choices));on($('story-rest'),'click',()=>onAction('rest'));on($('story-stop'),'click',()=>{port.stopMove();$('game').focus({preventScroll:true});});on($('story-resume'),'click',()=>{if(gate.canPause())port.pause(false);});
 on($('game'),'pointerdown',e=>{gestureOrigin={x:e.clientX,y:e.clientY};});
 on($('game'),'pointermove',e=>{if(gestureOrigin&&Math.hypot(e.clientX-gestureOrigin.x,e.clientY-gestureOrigin.y)>8)root.dataset.moved='true';});
 for(const type of ['pointerup','pointercancel'])on($('game'),type,()=>gestureOrigin=null);
 on(map,'click',e=>{const b=e.target.closest('[data-destination]');if(!b)return;targetId=b.dataset.destination;close(map);update(latest);});
 function decorate(b){const action=b.dataset.action,key=action.startsWith('gift:')?action.split(':')[1]:markFor(action),label=b.textContent;b.innerHTML=icon(key)+`<span>${esc(label)}</span>`;return b;}
 function actions(buttons,state){
  $('story-choice-buttons').replaceChildren();$('story-buttons').replaceChildren();
  root.dataset.phase=state.phase;$('story-actions').dataset.phase=state.phase;
  const live=state.phase==='living',available=buttons.filter(b=>b.dataset.action!=='rest');
  if(!live){$('story-buttons').append(...buttons.map(decorate));$('story-more').hidden=true;return;}
  const primary=available.find(b=>!b.disabled&&!b.dataset.action.startsWith('activity:observe')&&!b.dataset.action.startsWith('activity:track'))||available.find(b=>!b.disabled)||available[0];
  if(primary)$('story-buttons').append(decorate(primary));
  const other=available.filter(b=>b!==primary);$('story-choice-buttons').append(...other.map(decorate));$('story-more').hidden=!other.length;
  $('story-choice-description').textContent='行動中はここで過ごします。歩き出すと中断できます。';
 }
 function destination(){if(!latest)return null;const {story,frame}=latest,s=story.state;if(s.zone==='frontier')return s.rescue?.status==='waiting'?{id:'rescue',name:'倒れた村人',...s.rescue}:{id:'return',name:'帰還船・救護所',x:-5,z:3};return story.places.find(p=>p.id===targetId)||story.nearest(frame.hero);}
 function update(data){latest=data;const {frame,story,layout}=data,s=story.state;
  gate.sync();const session=readSession(),solo=gate.canPause();
  $('lifeBadge').disabled=!solo;for(const control of menu.querySelectorAll('[data-tool="pauseBtn"],[data-tool="lifeBadge"]'))control.disabled=!solo;
  $('story-session-status').textContent=session.mode==='solo'?'ひとりの旅':session.phase==='migrating'?'村との繋がりを引き継いでいます':session.phase==='closed'?'村との接続が途絶えました':`同じ世界に ${(session.members||[]).length} 人 · メニュー中も世界は進みます`;
  root.dataset.session=session.phase;
  $('story-resume').disabled=!solo;
  for(const id of ['story-import','story-map-import'])if($(id))$(id).disabled=!solo;
  root.dataset.phase=s.phase;root.dataset.resting=String(s.resting);root.dataset.moving=String(!!frame.controls?.moving);root.dataset.combat=String(s.zone==='frontier');
  for(const b of doc.querySelectorAll('[data-weapon]'))b.disabled=frame.life.ageYears<7;
  $('story-health-label').textContent=frame.hero.dead?'救助を待っています':`${Math.ceil(frame.hero.hp)} / ${frame.hero.maxhp}`;
  $('story-hp').parentElement.setAttribute('aria-valuenow',String(Math.round(frame.hero.hp/frame.hero.maxhp*100)));
  $('story-rest').disabled=s.phase!=='living'||frame.hero.dead;$('story-rest').setAttribute('aria-pressed',String(s.resting));$('story-rest').querySelector('span').textContent=s.resting?'立ち上がる':'休む';
  $('story-action-status').textContent=s.resting?'休息中':s.activity?'行動中':frame.controls?.dashing?'走っている':frame.controls?.moving?'歩いている':s.zone==='frontier'?'接近すると自動戦闘':'';
  $('story-activity-progress').hidden=!s.activity;$('story-activity-progress').value=s.activity?8-s.activity.remaining:0;
  $('story-pause-banner').hidden=!frame.paused||!!doc.querySelector('dialog[open]')||s.phase==='ended';
  const point=destination();$('story-waypoint').hidden=s.phase==='birth';
  if(point){const dx=point.x-frame.hero.x,dz=point.z-frame.hero.z,distance=Math.hypot(dx,dz),angle=(Math.atan2(dx,-dz)+(frame.controls?.cameraAngle||0))*180/Math.PI;
   $('story-bearing').style.transform=`rotate(${angle}deg)`;$('story-target-name').textContent=point.name;$('story-target-distance').textContent=distance<2.2?'到着 · 近くの行動を選ぶ':`${Math.ceil(distance)} m · 地図で行き先を選ぶ`;}
  if(map.open&&lastSignature!==JSON.stringify([layout.revision,frame.hero.x,frame.hero.z,s.zone]))renderMap();
 }
 function renderMap(){const {story,frame,layout}=latest,s=story.state,point=destination();lastSignature=JSON.stringify([layout.revision,frame.hero.x,frame.hero.z,s.zone]);
  const points=s.zone==='village'?story.places:[{id:'return',name:'帰還船・救護所',x:-5,z:3},...(s.rescue?[{id:'rescue',name:'倒れた村人',...s.rescue}]:[])];
  const all=s.zone==='village'?[...points,...layout.objects,frame.hero]:[];
  const minX=Math.min(-30,...all.map(p=>p.x))-12,maxX=Math.max(180,...all.map(p=>p.x))+12,minZ=Math.min(-35,...all.map(p=>p.z))-12,maxZ=Math.max(35,...all.map(p=>p.z))+12;
  const ext=s.zone==='village'?{x:minX,z:minZ,w:maxX-minX,h:maxZ-minZ}:{x:-9,z:-7,w:18,h:14};
  const scale=Math.min(552/ext.w,272/ext.h),ox=24+(552-ext.w*scale)/2,oy=28+(272-ext.h*scale)/2;
  const pos=(x,z)=>[ox+(x-ext.x)*scale,oy+(z-ext.z)*scale];
  const river=Array.from({length:41},(_,i)=>{const z=ext.z+i*ext.h/40;return pos(riverX(z),z).join(',');}).join(' ');
  const buildings=s.zone==='village'?layout.objects.filter(o=>o.phase==='built').map(o=>{const d=defs[o.kind],[x,y]=pos(o.x,o.z),w=d.w*scale,h=d.d*scale;return `<rect x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="1" transform="rotate(${o.rot*180/Math.PI} ${x} ${y})"/>`;}).join(''):'';
  const [hx,hy]=pos(frame.hero.x,frame.hero.z),[tx,ty]=point?pos(point.x,point.z):[hx,hy];
  const outside=frame.hero.x<ext.x||frame.hero.x>ext.x+ext.w||frame.hero.z<ext.z||frame.hero.z>ext.z+ext.h;
  $('story-map-surface').innerHTML=`<svg viewBox="0 0 600 332" role="img" aria-label="${esc(layout.name)}の地図。現在位置と施設"><rect class="map-paper" x="5" y="5" width="590" height="322" rx="5"/><path class="map-grid" d="M24 80h552M24 136h552M24 192h552M24 248h552M90 28v272M190 28v272M290 28v272M390 28v272M490 28v272"/>${s.zone==='village'?`<polyline class="map-river" points="${river}"/>`:''}<g class="map-buildings">${buildings}</g><path class="map-bearing-line" d="M${Math.max(20,Math.min(580,hx))} ${Math.max(20,Math.min(310,hy))}L${tx} ${ty}"/><g>${points.map(p=>{const [x,y]=pos(p.x,p.z);return `<circle class="map-pin ${p.id===point?.id?'selected':''}" cx="${x}" cy="${y}" r="${p.id===point?.id?7:4}"/>`;}).join('')}</g><g class="map-you" transform="translate(${Math.max(20,Math.min(580,hx))} ${Math.max(20,Math.min(310,hy))})"><circle r="10"/><path d="m0-6 4 10-4-2-4 2Z"/></g><text x="545" y="40" class="map-north">北 ↑</text><text x="24" y="319" class="map-coordinate">${outside?'地図の外側 · ':''}現在地 ${frame.hero.x.toFixed(0)}, ${frame.hero.z.toFixed(0)}</text></svg>`;
  const members=readSession().members||[];$('story-companions').hidden=readSession().mode!=='shared';$('story-companions').querySelector('ul').innerHTML=members.map(m=>`<li data-player-id="${esc(m.playerId||m.id)}">${esc(m.name||'旅人')} · ${m.connected===false?'接続を確認中':'参加中'}</li>`).join('');
  $('story-map-list').innerHTML=points.map(p=>`<button data-destination="${esc(p.id)}" aria-pressed="${p.id===targetId}">${icon(p.id==='port'?'ship':p.id==='armory'?'sword':'home')}<span>${esc(p.name)}<small>${esc(p.verb|| (p.id==='port'?'船に乗る':p.id==='armory'?'武具庫':'ここへ向かう'))}</small></span><b>${Math.ceil(Math.hypot(p.x-frame.hero.x,p.z-frame.hero.z))} m</b></button>`).join('');
 }
 return{root,actions,update,openDialog:open,canPause:gate.canPause,closeChoices(){if(choices.open)close(choices);},selectTarget(id){targetId=id;},destroy(){gate.dispose();abort.abort();ageParent.append(age);artsParent.append(arts);root.remove();choices.remove();map.remove();menu.remove();}};
}
