import { Assets } from './adapters/assets.js';
import { World } from './adapters/world.js';
import { Effects } from './adapters/effects.js';
import { Sound } from './adapters/audio.js';
import { Game } from './adapters/game.js';
import { SKILLS,BLESSINGS,clock,roman,clamp } from './domain/rules.js';
const $=id=>document.getElementById(id),show=id=>$(id).classList.remove('hidden'),hide=id=>$(id).classList.add('hidden');
const STORE='eclipse-sanctuary-v1';
function readSaved(){try{return JSON.parse(localStorage.getItem(STORE)||'{}');}catch{return{};}}
function save(){try{localStorage.setItem(STORE,JSON.stringify(saved));}catch{}}
const saved=readSaved();const settings={quality:saved.quality||'auto',volume:saved.volume??.35,shake:saved.shake??!matchMedia('(prefers-reduced-motion:reduce)').matches};
const sound=new Sound(settings.volume);const assets=new Assets();let world,effects,game,previous=performance.now(),uiElapsed=0,modal=null,modalReturn=null,pausedFrom='playing',announcerTimer,toastTimer,fpsStart=0,fpsTime=0,lastFps=0,frameId,accumulator=0,pauseReason=null;
const modalIds=['title-screen','upgrade-screen','pause-screen','settings-screen','credits-screen','result-screen'];
function announce(small,main){$('announce-small').textContent=small;$('announce-main').textContent=main;$('announcer').classList.add('visible');clearTimeout(announcerTimer);announcerTimer=setTimeout(()=>$('announcer').classList.remove('visible'),2600);}
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),1800);}
function stateChanged(state){
  modal=null;modalIds.forEach(hide);
  if(state==='title'){show('title-screen');hide('hud');}
  else{show('hud');if(state==='upgrade'){show('upgrade-screen');makeBlessings();}if(state==='result'){show('result-screen');result();}}
  $('auto-button').classList.toggle('active',game?.auto??true);
}
function makeBlessings(){const parent=$('upgrade-cards');parent.replaceChildren();for(const b of BLESSINGS){const el=document.createElement('button');el.className='upgrade-card';el.innerHTML=`<span class="upgrade-icon">${b.icon}</span><small class="eyebrow">${b.label}</small><h3>${b.title}</h3><p>${b.detail}</p><b>この祝福を受ける ›</b>`;el.onclick=()=>{sound.start();game.bless(b.id);};parent.append(el);}}
function result(){
  const s=game.stats,win=game.win;$('result-eyebrow').textContent=win?'THE NIGHT IS OVER':'A LIGHT THAT NEVER DIES';$('result-title').textContent=win?'夜明けは、ここに。':'灯を、もう一度。';$('result-caption').textContent=win?'朽ちた王は倒れ、聖堂に最初の光が差した。':'この一歩も、夜明けへ続いている。祝福を変え、再び挑もう。';$('result-kills').textContent=s.kills;$('result-time').textContent=clock(s.time);$('result-wave').textContent=roman(s.wave);
  saved.bestWave=Math.max(saved.bestWave||0,s.wave);saved.bestKills=Math.max(saved.bestKills||0,s.kills);if(win&&(!saved.bestTime||s.time<saved.bestTime))saved.bestTime=s.time;save();$('record-text').textContent=win?`BEST CLEAR ${clock(saved.bestTime)}`:`BEST WAVE ${roman(saved.bestWave)} · ${saved.bestKills} KILLS`;
}
function openPause(reason='user'){if(!game||!['playing','upgrade'].includes(game.state)||modal)return;pausedFrom=game.state;pauseReason=reason;game.state='paused';modal='pause';hide('upgrade-screen');show('pause-screen');sound.suspend();}
function resume(){if(game.state!=='paused')return;game.state=pausedFrom;pauseReason=null;modal=null;hide('pause-screen');if(game.state==='upgrade')show('upgrade-screen');previous=performance.now();accumulator=0;sound.resume();}
function openPanel(name){if(modal===name)return;modalReturn=modal||game.state;if(game.state==='playing'||game.state==='upgrade'){pausedFrom=game.state;game.state='paused';}modal=name;for(const id of modalIds)hide(id);show(`${name}-screen`);if(name==='settings')updateSettings();sound.suspend();}
function closePanel(){hide(`${modal}-screen`);const returnTo=modalReturn;modal=null;if(returnTo==='pause'){modal='pause';show('pause-screen');}else if(returnTo==='title'){show('title-screen');}else if(returnTo==='result'){show('result-screen');}else{game.state=pausedFrom;stateChanged(game.state);sound.resume();}previous=performance.now();accumulator=0;}
function updateSettings(){document.querySelectorAll('[data-quality]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.quality===settings.quality)));$('volume-setting').value=Math.round(settings.volume*100);$('shake-setting').setAttribute('aria-checked',String(settings.shake));$('shake-setting').textContent=settings.shake?'入':'切';}
function syncSettings(){Object.assign(saved,settings);save();}
function updateHUD(){if(!game)return;const s=game.stats,hp=clamp(s.hp/s.maxHp,0,1);$('wave-label').textContent=`WAVE ${roman(s.wave)} / V`;$('wave-objective').textContent=game.wave?.title||'亡者の襲撃を退ける';$('wave-progress').style.width=`${100*(game.waveKilled||0)/(game.waveTotal||1)}%`;$('kill-count').textContent=s.kills;$('time-count').textContent=clock(s.time);$('level-label').textContent=`Lv. ${s.wave}`;$('health-fill').style.width=`${hp*100}%`;$('health-ghost').style.width=`${hp*100}%`;$('orb-fluid').style.height=`${hp*100}%`;$('health-label').textContent=`${Math.ceil(s.hp)} / ${s.maxHp}`;$('relics').textContent=s.blessings.map(id=>BLESSINGS.find(b=>b.id===id).icon).join(' ');
  document.querySelectorAll('[data-skill]').forEach((el,i)=>{const t=game.skills[i];el.querySelector('.skill-cd').textContent=t>0?Math.ceil(t):'';el.style.setProperty('--cool',`${t/(SKILLS[i].cooldown*s.cooldown)*360}deg`);el.classList.toggle('ready',t<=0);el.setAttribute('aria-label',`${SKILLS[i].name}${t>0?`：あと${Math.ceil(t)}秒`:'：発動可能'}`);});
  const boss=game.enemies.find(e=>e.isBoss&&e.alive);$('boss-hud').classList.toggle('hidden',!boss);if(boss)$('boss-fill').style.width=`${boss.hp/boss.maxHp*100}%`;if(game.state==='upgrade')$('upgrade-timer').textContent=Math.ceil(game.upgradeTime);
}
function start(){accumulator=0;previous=performance.now();pauseReason=null;sound.start();game.start();}
function handleAction(action){
  if(action==='pause')openPause();if(action==='resume')resume();
  if(action==='settings'||action==='credits')openPanel(action);
  if(action==='close-settings'||action==='close-credits')closePanel();
  if(action==='restart')start();
  if(action==='title'){game.title();sound.suspend();}
  if(action==='sound'){$('sound-button').textContent=sound.toggle()?'SOUND ON':'SOUND OFF';sound.start();}
  if(action==='fullscreen'){const promise=document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen?.();promise?.catch(()=>toast('このブラウザでは全画面表示を利用できません。'));}
}
function bind(){
  $('start-button').onclick=start;
  document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>handleAction(b.dataset.action));
  document.querySelectorAll('[data-skill]').forEach(b=>b.onclick=()=>{sound.start();if(!game.skill(Number(b.dataset.skill))&&game.state==='playing')toast('発動可能になると、自動でスキルを使います。');});
  $('auto-button').onclick=()=>$('auto-button').classList.toggle('active',game.toggleAuto());
  document.querySelectorAll('[data-quality]').forEach(button=>button.onclick=()=>{settings.quality=button.dataset.quality;world.setQuality(settings.quality);updateSettings();syncSettings();});$('volume-setting').oninput=e=>{settings.volume=Number(e.target.value)/100;sound.volumeTo(settings.volume);syncSettings();};$('shake-setting').onclick=()=>{settings.shake=!settings.shake;updateSettings();syncSettings();};
  let keys=new Set();const keyInput=()=>{let x=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),y=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);game.moveInput(x*.86+y*.51,-x*.51+y*.86);};
  addEventListener('keydown',e=>{if(e.target.matches('input,select'))return;const k=e.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' ','1','2','3','escape'].includes(k))e.preventDefault();if(k==='escape'){if(modal==='settings'||modal==='credits')closePanel();else if(modal==='pause')resume();else openPause();return;}if(k===' '){if(game.state==='title'){$('start-button').click();return;}if(modal==='pause')resume();else openPause();return;}if(['1','2','3'].includes(k)&&!e.repeat){game.skill(Number(k)-1);return;}keys.add(k);keyInput();});
  addEventListener('keyup',e=>{keys.delete(e.key.toLowerCase());keyInput();});
  let drag=null;const canvas=$('game'),joy=$('joystick');
  canvas.addEventListener('pointerdown',e=>{if(game.state!=='playing')return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);joy.style.left=`${e.clientX}px`;joy.style.top=`${e.clientY}px`;joy.classList.add('visible');sound.start();});
  canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;let dx=(e.clientX-drag.x)/45,dy=(e.clientY-drag.y)/45;const len=Math.hypot(dx,dy);if(len>1){dx/=len;dy/=len;}game.moveInput(dx*.86+dy*.51,-dx*.51+dy*.86);joy.querySelector('i').style.transform=`translate(${dx*28}px,${dy*28}px)`;});
  const release=()=>{drag=null;joy.classList.remove('visible');game.moveInput(0,0);};canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
  addEventListener('blur',()=>{keys.clear();release();openPause('window-blur');sound.suspend();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();release();openPause('hidden');sound.suspend();}previous=performance.now();accumulator=0;});
  addEventListener('resize',()=>{world.resize();effects.resize();});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();openPause('context-lost');showFatal('描画が中断されました。再読み込みしてお試しください。');});
}
function animate(now){
  frameId=requestAnimationFrame(animate);if(document.hidden){previous=now;accumulator=0;return;}
  const elapsed=Math.max(0,(now-previous)/1000),dt=Math.min(.25,elapsed);previous=now;
  fpsTime+=elapsed;if(fpsTime>=1){lastFps=Math.round((world.renderCount-fpsStart)/fpsTime);fpsStart=world.renderCount;fpsTime=0;}
  const active=!modal&&game.state!=='paused';
  if(active){accumulator+=dt;while(accumulator>=1/60){game.update(1/60);effects.update(1/60);accumulator-=1/60;}}else accumulator=0;
  world.update(active?dt:0,game.hero);world.render();effects.render(game.hero,game.enemies,game.telegraphs);uiElapsed+=dt;if(uiElapsed>.08){updateHUD();uiElapsed=0;}
}
function showFatal(message){hide('loading');$('fatal-message').textContent=message;show('fatal');}
try{
  await assets.load((done,total,name)=>{$('load-fill').style.width=`${done/total*100}%`;$('load-count').textContent=`${done} / ${total} ASSETS`;$('load-status').textContent=done===total?'光と影を整えています。':'忘却の聖堂へ、道をひらいています。';});
  world=new World($('game'),assets,settings);effects=new Effects($('effects'),world);
  game=new Game(world,assets,effects,sound,{state:stateChanged,announce,toast,hurt:()=>{$('hit-flash').classList.remove('visible');void $('hit-flash').offsetWidth;$('hit-flash').classList.add('visible');}});
  bind();hide('loading');stateChanged('title');updateHUD();previous=performance.now();frameId=requestAnimationFrame(animate);
  window.__ECLIPSE__={snapshot:()=>({...game.snapshot(),fps:lastFps,drawCalls:world.renderer.info.render.calls,triangles:world.renderer.info.render.triangles,quality:world.low?'low':'high',audio:sound.ctx?.state||'not-started',modal,pauseReason,hidden:document.hidden,loaded:assets.models.size}),version:'1.0.0',assetManifest:assets.manifest};
  if(new URLSearchParams(location.search).get('test')==='1')window.__ECLIPSE_TEST__={game,world,effects,sound,step:(seconds)=>{for(let t=0;t<seconds;t+=1/60){game.update(1/60);effects.update(1/60);if(game.state==='result')break;}world.update(.1,game.hero);world.lastRender=0;world.render();effects.render(game.hero,game.enemies,game.telegraphs);updateHUD();return game.snapshot();},stopRender:()=>cancelAnimationFrame(frameId)};
}catch(error){console.error(error);showFatal(error.message||'WebGL2対応ブラウザで再度お試しください。');}
