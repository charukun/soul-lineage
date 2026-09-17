import {
  inspirationCatalogRevision,
  INSPIRATION_WEAPON_ARTS,
  INSPIRATION_WEAPONS,
  INSPIRATION_MOTION_IDS,
} from '@soul/game-data';
import {assetCatalog,publicWebAssetCatalog} from '@soul/assets';
import {KAYKIT_FAMILY_ID,KAYKIT_MODEL_BY_KEY,KAYKIT_RIG_ID,PROTAGONIST_VILLAGER_MODEL_ID} from '@soul/characters';
import { RaidHost } from '@soul/network/raid-host';
import './develop-review.css';

const q = selector => document.querySelector(selector);
const qa = selector => [...document.querySelectorAll(selector)];
const weaponLabels = Object.freeze({sword:'片手剣',great:'大剣',spear:'槍',axe:'戦斧',fist:'拳',katana:'刀'});
const phaseLabels = Object.freeze({open:'序候補',middle:'破候補',finish:'急候補'});
const appLabels=Object.freeze({rinne:'輪廻転焦',village:'MURAAAAAAA',demon:'尽喰廻遊'});
const appContexts=Object.freeze({
  rinne:{model:PROTAGONIST_VILLAGER_MODEL_ID,detail:'主人公はKayKit Rig_Medium互換PRIMARY。母・敵も同じKayKit familyから解決。',camera:'工房の固定カメラ'},
  village:{model:`identity: ${KAYKIT_MODEL_BY_KEY.rogue.id} / ${KAYKIT_MODEL_BY_KEY.knight.id}`,detail:'住民は人物IDでKayKitモデルを固定。護衛化しても人物の顔・体型を変えず、roleは衣装・装備だけに反映。procedural人体は読込失敗時だけfallback。',camera:'Village通常距離'},
  demon:{model:KAYKIT_MODEL_BY_KEY.knight.id,detail:'人間NPCはKayKit基盤を共有loaderで読込し、人物ID由来の顔・体型をrole変更から分離。魔物プレイヤーは別の非人間contract。',camera:'Demon通常距離'}
});

const build = typeof __BUILD_INFO__ === 'object' && __BUILD_INFO__ ? __BUILD_INFO__ : {branch:'develop',commit:'local'};
q('#build-source').textContent = `${build.branch || 'develop'} · ${String(build.commit || 'local').slice(0,12)}`;
q('#catalog-revision').textContent = inspirationCatalogRevision;
q('#motion-count').textContent = `${INSPIRATION_MOTION_IDS.length} 基礎動作`;
q('#foundation-id').textContent=KAYKIT_FAMILY_ID;q('#foundation-rig').textContent=KAYKIT_RIG_ID;

let selectedWeapon = INSPIRATION_WEAPONS[0];
function renderCatalog() {
  q('#weapon-tabs').replaceChildren(...INSPIRATION_WEAPONS.map(weapon => {
    const button=document.createElement('button');
    button.type='button';button.textContent=weaponLabels[weapon] || weapon;button.dataset.weapon=weapon;
    button.classList.toggle('active',weapon===selectedWeapon);
    button.addEventListener('click',()=>{selectedWeapon=weapon;renderCatalog();});
    return button;
  }));
  const arts=INSPIRATION_WEAPON_ARTS[selectedWeapon];
  q('#inspiration-phases').replaceChildren(...['open','middle','finish'].map(phase => {
    const card=document.createElement('article');
    const heading=document.createElement('h3');heading.textContent=phaseLabels[phase];
    const list=document.createElement('ol');
    arts[phase].forEach(id=>{const item=document.createElement('li');const code=document.createElement('code');code.textContent=id;item.append(code);list.append(item);});
    card.append(heading,list);return card;
  }));
}
renderCatalog();

q('#app-status-grid').replaceChildren(...Object.entries(appContexts).map(([app,row])=>{
  const article=document.createElement('article');article.dataset.appStatus=app;
  const heading=document.createElement('div'),title=document.createElement('strong'),badge=document.createElement('span'),model=document.createElement('code'),detail=document.createElement('p');
  title.textContent=appLabels[app];badge.textContent=`${KAYKIT_RIG_ID} · shared`;heading.append(title,badge);model.textContent=row.model;detail.textContent=row.detail;article.append(heading,model,detail);return article;
}));
const objectRows=[
  ...Object.entries(assetCatalog).map(([id,row])=>[id,{...row,status:'SHARED PACKAGE',apps:['rinne','village','demon']}]),
  ...Object.entries(publicWebAssetCatalog).filter(([,row])=>['3d','pbr-material'].includes(row.category)&&row.status==='MATERIALIZED')
].slice(0,12);
q('#world-object-grid').replaceChildren(...objectRows.map(([id,row])=>{
  const card=document.createElement('article'),title=document.createElement('code'),meta=document.createElement('span');title.textContent=id;meta.textContent=`${row.category||row.type||'asset'} · ${row.status||'shared'} · ${(row.apps||[]).join(' / ')||'shared'}`;card.append(title,meta);return card;
}));

let selectedApp='rinne';
function applyEmbeddedContext(frame){
  try{
    const win=frame?.contentWindow,doc=frame?.contentDocument;if(!win||!doc)return;
    const mapped=selectedApp==='village'?'village':selectedApp==='demon'?'demon':'studio';
    const select=doc.getElementById('quality-context');
    if(select&&select.value!==mapped){select.value=mapped;select.dispatchEvent(new win.Event('change',{bubbles:true}));}
    const studio=win.characterStudio;
    if(studio?.review?.ready){studio.review.aim(selectedApp==='village'?'village':selectedApp==='demon'?'demon':'front');}
  }catch{/* A still-loading embedded tool keeps its own defaults. */}
}
function renderAppContext(){
  qa('[data-app-context]').forEach(button=>button.classList.toggle('active',button.dataset.appContext===selectedApp));
  qa('[data-app-status]').forEach(card=>card.classList.toggle('active',card.dataset.appStatus===selectedApp));
  const row=appContexts[selectedApp];q('#context-summary').textContent=`${appLabels[selectedApp]} · ${row.camera} · ${KAYKIT_RIG_ID}`;
  qa('iframe[src]').forEach(applyEmbeddedContext);
}
qa('[data-app-context]').forEach(button=>button.addEventListener('click',()=>{selectedApp=button.dataset.appContext;renderAppContext();}));
renderAppContext();

function openPanel(name) {
  qa('[data-view]').forEach(button=>button.classList.toggle('active',button.dataset.view===name));
  qa('[data-panel]').forEach(panel=>panel.classList.toggle('active',panel.dataset.panel===name));
  const panel=q(`[data-panel="${name}"]`);
  const frame=panel?.querySelector('iframe[data-src]');
  if(frame && !frame.getAttribute('src')){frame.addEventListener('load',()=>applyEmbeddedContext(frame),{once:true});frame.setAttribute('src',frame.dataset.src);}
  else if(frame)applyEmbeddedContext(frame);
}
qa('[data-view]').forEach(button=>button.addEventListener('click',()=>openPanel(button.dataset.view)));

const memory=new Map();
const storage={getItem:key=>memory.has(key)?memory.get(key):null,setItem:(key,value)=>memory.set(key,String(value))};
let host=null,playing=true,last=performance.now(),lastCore=null;
function resetBattle() {
  memory.clear();lastCore=null;
  host=new RaidHost({villageId:'develop-visual-review',storage,now:()=>Date.now()});
  host.join('demon',{type:'join',app:'demon',role:'demon',playerId:'review-demon',name:'Demon'});
  host.join('human',{type:'join',app:'rinne',role:'human',playerId:'review-human',name:'Human'});
  host.input('demon',{type:'state',x:-1.2,z:0,yaw:Math.PI/2,state:'combat',action:null});
  host.input('human',{type:'state',x:1.2,z:0,yaw:-Math.PI/2,state:'combat',action:null});
  host.tick(1/60);
  lastCore=host.battle?.core?.state?.() || null;
  playing=true;q('#battle-toggle').textContent='一時停止';last=performance.now();
}
resetBattle();

function drawFighter(ctx,actor,x,y,label,side) {
  const hp=Math.max(0,actor.hp),ratio=actor.maxhp?hp/actor.maxhp:0;
  ctx.save();ctx.translate(x,y);
  ctx.beginPath();ctx.arc(0,0,28,0,Math.PI*2);ctx.fillStyle=side==='hero'?'#d9b45b':'#82aeb6';ctx.fill();
  ctx.lineWidth=4;ctx.strokeStyle='#101413';ctx.stroke();
  ctx.fillStyle='#f4f1e8';ctx.font='700 14px system-ui,sans-serif';ctx.textAlign='center';ctx.fillText(label,0,-42);
  ctx.fillStyle='#242a28';ctx.fillRect(-42,38,84,8);ctx.fillStyle='#d9d4c4';ctx.fillRect(-42,38,84*ratio,8);
  if(actor.attack){ctx.beginPath();ctx.arc(0,0,36,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.max(0,Math.min(1,actor.progress||0)));ctx.strokeStyle='#f4f1e8';ctx.lineWidth=3;ctx.stroke();}
  ctx.restore();
}
function drawBattle() {
  const canvas=q('#battle-canvas'),ctx=canvas.getContext('2d');
  const battle=host.battle,currentCore=battle?.core?.state?.();
  if(currentCore) lastCore=currentCore;
  const core=currentCore || lastCore;
  ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#111716';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle='#3b4440';ctx.lineWidth=2;ctx.strokeRect(28,28,canvas.width-56,canvas.height-56);
  if(!core){ctx.fillStyle='#d9d4c4';ctx.font='18px system-ui,sans-serif';ctx.fillText('戦闘を開始しています…',48,64);return;}
  const scale=60,centerX=canvas.width/2,centerY=canvas.height/2;
  drawFighter(ctx,core.hero,centerX+core.hero.x*scale,centerY+core.hero.z*scale,'DEMON','hero');
  drawFighter(ctx,core.enemy,centerX+core.enemy.x*scale,centerY+core.enemy.z*scale,'HUMAN','enemy');
  q('#hero-action').textContent=core.hero.attack || '構え';q('#enemy-action').textContent=core.enemy.attack || '構え';
  q('#hero-hp').value=Math.max(0,core.hero.hp/core.hero.maxhp);q('#enemy-hp').value=Math.max(0,core.enemy.hp/core.enemy.maxhp);
  q('#hero-meta').textContent=`${Math.ceil(core.hero.hp)} / ${core.hero.maxhp} HP · ${core.hero.weapon}`;
  q('#enemy-meta').textContent=`${Math.ceil(core.enemy.hp)} / ${core.enemy.maxhp} HP · ${core.enemy.weapon}`;
  q('#battle-time').textContent=`${(battle?.time||0).toFixed(1)}秒`;
  q('#battle-result').textContent=battle?.finished?`${battle.winner==='demon'?'DEMON':'HUMAN'} 勝利`:'戦闘中';
}
function frame(now) {
  const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
  if(playing && host?.battle && !host.battle.finished) host.tick(dt);
  drawBattle();requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
q('#battle-restart').addEventListener('click',resetBattle);
q('#battle-toggle').addEventListener('click',()=>{playing=!playing;q('#battle-toggle').textContent=playing?'一時停止':'再開';last=performance.now();});
