import {THREE as T} from '@soul/rendering';
import {defs,RESOURCE_NAMES,DAYS_YEAR,capacityOf,jobsOf,localToWorld} from './game/core.js';
import {t,getLocale,setLocale,options,exposeI18n} from './mura-i18n.js';

const village=window.village;
if(!village)throw new Error('MURAAAAAAA v2 UI requires a booted village');
const {world,sim,view,ui,cancelPlacement,save}=village;
const sys=window.__MURA_SYSTEMS__;
const $=id=>document.getElementById(id);
exposeI18n();

const css=document.createElement('style');css.dataset.muraV2='1';css.textContent=`
/* v2 composition */
#title{margin-left:0!important;left:12px!important;top:max(10px,env(safe-area-inset-top))!important;padding-left:5px!important;width:min(255px,62vw)!important}#title .eyebrow,#title #emblem{display:none!important}#title h1{margin-top:0!important}
#tutorial{left:12px!important;top:max(78px,calc(env(safe-area-inset-top) + 68px))!important;bottom:auto!important;transform:none!important;max-width:min(340px,calc(100vw - 24px))!important;white-space:normal!important;z-index:17!important}#tutorialAction{white-space:normal!important;text-align:left!important}
#idleStatus{left:auto!important;right:12px!important;top:max(12px,env(safe-area-inset-top))!important;width:min(320px,42vw)!important;opacity:1!important;transform:none!important;pointer-events:auto!important;padding:13px 14px 12px!important;border-radius:22px!important;z-index:16!important}.muraNowHead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:7px}.muraNowHead div{display:flex;flex-direction:column}.muraNowHead small{font-size:8px;letter-spacing:.18em;opacity:.6}.muraNowHead b{font-size:15px}.muraClimate{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin:8px 0}.muraClimate span{background:#fff8e99c;border:1px solid #75644820;border-radius:10px;padding:6px 7px;font-size:8px;color:#667064}.muraClimate b{display:block;font-size:10px;color:#3e5144;margin-top:2px}.muraScaleLine{font-size:8px;color:#687468;margin-top:7px;display:flex;justify-content:space-between;gap:8px}
#muraEventButton{position:static!important;min-height:30px!important;padding:5px 9px!important;border-radius:13px!important;font-size:9px!important}#muraEventLog{top:max(128px,calc(env(safe-area-inset-top) + 118px))!important}
.soul-music>button{display:none!important}
/* placement */
#muraPlacementTools{margin-top:9px;border-top:1px dashed #75664d38;padding-top:9px;display:grid;grid-template-columns:94px 1fr;gap:10px;align-items:center}.muraNudge{display:grid;grid-template-columns:repeat(3,28px);grid-template-rows:repeat(3,28px);gap:3px;justify-content:center}.muraNudge button{min-height:28px!important;width:28px;padding:0!important;border-radius:9px!important;background:#c9d8b8!important}.muraNudge button[data-dir=up]{grid-column:2}.muraNudge button[data-dir=left]{grid-row:2;grid-column:1}.muraNudge button[data-dir=right]{grid-row:2;grid-column:3}.muraNudge button[data-dir=down]{grid-row:3;grid-column:2}.muraRotateControl label{display:flex;align-items:center;justify-content:space-between;font-size:9px;margin-bottom:5px}.muraRotateControl input{width:100%;accent-color:#718966}.muraPlacementBottom{display:flex;gap:6px;margin-top:7px}.muraPlacementBottom button{flex:1;min-height:34px!important;background:#d6dfc6!important}.muraPlacementBottom .cancel{background:#ead2c5!important;color:#6f433d!important}
/* rich details */
.muraRichDetails{margin:14px 0 6px;border-top:1px solid #7b6f552b;padding-top:12px}.muraDetailHero{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:9px}.muraDetailHero strong{font-size:13px}.muraDetailHero small{font-size:9px;opacity:.65}.muraDetailGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.muraDetailGrid>div{background:#fff8e69c;border:1px solid #75644820;border-radius:12px;padding:8px 9px}.muraDetailGrid span{display:block;font-size:8px;color:#7b8171}.muraDetailGrid b{display:block;font-size:11px;color:#405145;margin-top:3px;overflow-wrap:anywhere}.muraDetailWide{grid-column:1/-1!important}.muraDetailTools{display:flex;gap:7px;margin-top:8px}.muraDetailTools button,.muraDetailTools select{flex:1;min-height:38px;border:1px solid #7564482d;border-radius:12px;background:#d7e2c9;color:#405145;padding:7px;font:inherit;font-size:10px}
/* universal button icon */
.muraButtonIcon{display:inline-grid;place-items:center;width:17px;height:17px;flex:none;margin-right:6px;vertical-align:-4px}.muraButtonIcon svg{width:15px!important;height:15px!important;stroke:currentColor!important;fill:none!important;stroke-width:1.8!important}.muraButtonIcon.fallback{font-size:10px;opacity:.65}.eventItem .muraButtonIcon,.card .muraButtonIcon,.soul-music [data-tracks] .muraButtonIcon{display:none!important}
/* selection halo */
.muraSelectionTag{position:fixed;z-index:20;pointer-events:none;padding:4px 8px;border-radius:10px;background:#fff1cbd9;border:1px solid #b9954f60;color:#5c4932;font-size:9px;font-weight:800;box-shadow:0 4px 14px #44341d24}
/* music dialog layout is viewport-contained, track list scrolls independently */
.soul-music dialog{height:min(86dvh,720px)!important;max-height:none!important;overflow:hidden!important;display:grid!important;grid-template-columns:1fr 1fr!important;grid-template-rows:auto auto auto minmax(0,1fr) auto!important;gap:6px 12px!important}.soul-music dialog>form{grid-column:1/-1!important;grid-row:1}.soul-music dialog>h2{grid-column:1}.soul-music dialog>h2+p{grid-column:2;text-align:right}.soul-music dialog>[data-tracks]{grid-column:1/-1!important;grid-row:4!important;max-height:none!important;min-height:0!important;overflow:auto!important}.soul-music dialog>audio{grid-column:1/-1!important}.soul-music dialog>details{position:absolute;left:18px;bottom:12px;max-width:42%;font-size:9px}.soul-music dialog>[data-state]{grid-column:1}.soul-music dialog>[data-stop]{justify-self:end}
@media(max-width:700px){#idleStatus{width:min(285px,54vw)!important}.soul-music dialog{width:96vw!important;height:90dvh!important;grid-template-columns:1fr 1fr!important;padding:13px!important}.soul-music dialog>h2{font-size:18px!important}.soul-music dialog>h2+p{font-size:9px!important}.soul-music dialog label{font-size:10px!important;margin:2px 0!important}.soul-music dialog>details{display:none}.soul-music [data-tracks] button{padding:7px!important;margin:2px!important;font-size:10px!important}}
@media(max-width:520px){#idleStatus{right:8px!important;width:46vw!important;padding:10px!important}.idleFacts{display:none!important}#idleResources{font-size:8px!important;line-height:1.45!important}.muraClimate{grid-template-columns:1fr!important;gap:3px}.muraClimate span{padding:4px 6px}.muraScaleLine{display:none}#tutorial{max-width:47vw!important}.soul-music dialog{grid-template-columns:1fr!important;grid-template-rows:auto auto auto minmax(0,1fr) auto!important}.soul-music dialog>h2,.soul-music dialog>h2+p,.soul-music dialog>[data-tracks],.soul-music dialog>audio,.soul-music dialog>[data-state]{grid-column:1!important}.soul-music dialog>h2+p{text-align:left;margin:0!important}}
`;
document.head.append(css);

const ICONS={
 close:'<path d="M5 5l14 14M19 5 5 19"/>',build:'<path d="M3 11l9-8 9 8M5 10v10h14V10M9 20v-6h6v6"/>',move:'<path d="M12 2v20M2 12h20M12 2l-3 3m3-3 3 3M22 12l-3-3m3 3-3 3"/>',room:'<path d="M4 5h16v15H4zM8 9h8M8 13h8"/>',detail:'<circle cx="12" cy="12" r="9"/><path d="M12 10v7M12 7h.01"/>',rotate:'<path d="M20 7v6h-6M19 13a8 8 0 1 1-2-8"/>',done:'<path d="M4 12l5 5L20 6"/>',cancel:'<path d="M5 5l14 14M19 5 5 19"/>',undo:'<path d="M9 7 4 12l5 5M5 12h8a6 6 0 0 1 6 6"/>',more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',follow:'<circle cx="12" cy="8" r="3"/><path d="M5 21c1-5 3-7 7-7s6 2 7 7"/>',log:'<path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h5"/>',music:'<path d="M9 18V5l10-2v13M9 9l10-2"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>',start:'<path d="M8 5l11 7-11 7z"/>',generic:'<circle cx="12" cy="12" r="7"/>'};
function svgIcon(name){return`<span class="muraButtonIcon"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]||ICONS.generic}</svg></span>`;}
function iconName(button){const id=button.id||'',text=(button.textContent||'').trim();if(/close|dismiss|deselect|cancelPlace|muraCancel/i.test(id)||text==='閉じる'||text==='×')return'close';if(id==='build'||text.includes('つくる'))return'build';if(id==='move'||text.includes('移動'))return'move';if(id==='enter'||text.includes('内装'))return'room';if(id==='details'||text.includes('詳細'))return'detail';if(id==='rotate'||text.includes('回転'))return'rotate';if(text.includes('完了')||text.includes('配置'))return'done';if(text.includes('キャンセル'))return'cancel';if(id==='undo'||text.includes('取り消'))return'undo';if(id==='more'||text.includes('その他'))return'more';if(text.includes('追')||id.includes('Follow'))return'follow';if(text.includes('記録')||id.includes('Event'))return'log';if(text.includes('音楽'))return'music';if(text.includes('始め'))return'start';return'generic';}
function decorateButtons(root=document){for(const b of root.querySelectorAll('button')){if(b.dataset.muraIcon||b.querySelector('img')||b.querySelector('.muraButtonIcon')||b.matches('[data-track]')||b.closest('[data-tracks]'))continue;if(b.querySelector('svg')){b.dataset.muraIcon='native';continue;}b.insertAdjacentHTML('afterbegin',svgIcon(iconName(b)));b.dataset.muraIcon='1';}}
const buttonObserver=new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes)if(n.nodeType===1){if(n.matches?.('button'))decorateButtons(n.parentElement||document);else decorateButtons(n);}});buttonObserver.observe(document.body,{subtree:true,childList:true});decorateButtons();

function installSelectionHighlight(){
 const group=new T.Group();group.visible=false;group.renderOrder=48;const ringMat=new T.MeshBasicMaterial({color:0xffd47f,transparent:true,opacity:.72,depthWrite:false,depthTest:false,side:T.DoubleSide});
 const ring=new T.Mesh(new T.RingGeometry(.82,1,48),ringMat),ring2=new T.Mesh(new T.RingGeometry(.55,.62,48),ringMat.clone());ring.rotation.x=ring2.rotation.x=-Math.PI/2;ring.position.y=.1;ring2.position.y=.12;group.add(ring,ring2);view.scene.add(group);
 const tag=document.createElement('div');tag.className='muraSelectionTag';tag.hidden=true;document.body.append(tag);
 const original=view.select.bind(view);view.select=(o,roomId=view.roomId)=>{const result=original(o,roomId);if(!o?.id){group.visible=false;tag.hidden=true;return result;}const host=roomId&&world.object(roomId),p=host?localToWorld(host,o.x,o.z):o,d=defs[o.kind]||{w:2,d:2};group.position.set(p.x,0,p.z);group.rotation.y=(o.rot||0)+(host?.rot||0);group.scale.set(Math.max(2,d.w*.7),1,Math.max(2,d.d*.7));group.visible=true;tag.textContent=d.label||o.kind;tag.hidden=false;return result;};
 const animate=time=>{if(group.visible){const pulse=1+Math.sin(time*.004)*.055;ring.scale.setScalar(pulse);ring2.rotation.z=time*.0008;const p=view.project(group.position.x,2.6,group.position.z);tag.style.transform=`translate(${p.x}px,${p.y}px) translate(-50%,-100%)`;tag.hidden=p.x<0||p.x>innerWidth||p.y<0||p.y>innerHeight;}requestAnimationFrame(animate);};requestAnimationFrame(animate);
}

function refreshPending(){const p=ui.pending;if(!p)return;p.rot=((p.rot%(Math.PI*2))+Math.PI*2)%(Math.PI*2);p.error=world.canPlace(p.kind,p.x,p.z,p.rot,p.roomId,p.moveId);view.setGhost(p.kind,p.x,p.z,p.rot,!p.error,p.material);$('placement')?.classList.toggle('invalid',!!p.error);const text=$('placementText');if(text)text.textContent=`${defs[p.kind]?.label||p.kind} · ${p.error||'ここに置けます'}`;}
function installPlacementTools(){
 const placement=$('placement'),actions=placement?.querySelector('.actions'),done=$('cancelPlace'),rotate=$('rotate');if(!placement||!actions||!done||!rotate)return;
 done.textContent=t('done');rotate.textContent=t('rotate');
 const tools=document.createElement('div');tools.id='muraPlacementTools';tools.innerHTML=`<div class="muraNudge" aria-label="${t('moveCamera')}"><button type="button" data-dir="up" aria-label="上">↑</button><button type="button" data-dir="left" aria-label="左">←</button><button type="button" data-dir="right" aria-label="右">→</button><button type="button" data-dir="down" aria-label="下">↓</button></div><div class="muraRotateControl"><label><span>${t('rotate')}</span><output>0°</output></label><input id="muraRotateRange" type="range" min="0" max="359" step="1" value="0"><div class="muraPlacementBottom"><button type="button" id="muraCancelPlacement" class="cancel">${t('cancel')}</button></div></div>`;placement.append(tools);
 const range=tools.querySelector('input'),output=tools.querySelector('output');
 const syncRange=()=>{if(!ui.pending)return;const deg=Math.round((((ui.pending.rot||0)*180/Math.PI)%360+360)%360);if(document.activeElement!==range)range.value=String(deg);output.value=`${deg}°`;};
 rotate.onclick=()=>{if(!ui.pending)return;ui.pending.rot=(ui.pending.rot+Math.PI/12)%(Math.PI*2);refreshPending();syncRange();};
 range.oninput=()=>{if(!ui.pending)return;ui.pending.rot=Number(range.value)*Math.PI/180;refreshPending();syncRange();};
 tools.querySelector('#muraCancelPlacement').onclick=()=>cancelPlacement();
 for(const b of tools.querySelectorAll('[data-dir]'))b.onclick=()=>{const p=ui.pending;if(!p)return;const step=1.5,forward={x:-Math.sin(view.yaw),z:-Math.cos(view.yaw)},right={x:Math.cos(view.yaw),z:-Math.sin(view.yaw)};let dx=0,dz=0;if(b.dataset.dir==='up'){dx=forward.x*step;dz=forward.z*step;}if(b.dataset.dir==='down'){dx=-forward.x*step;dz=-forward.z*step;}if(b.dataset.dir==='right'){dx=right.x*step;dz=right.z*step;}if(b.dataset.dir==='left'){dx=-right.x*step;dz=-right.z*step;}p.x=(Number(p.x)||0)+dx;p.z=(Number(p.z)||0)+dz;refreshPending();};
 const loop=()=>{tools.hidden=!ui.pending;if(ui.pending)syncRange();requestAnimationFrame(loop);};loop();decorateButtons(tools);
}

function resourcesText(map){const entries=Object.entries(map||{});return entries.length?entries.map(([k,n])=>`${RESOURCE_NAMES[k]||k} ${Math.round(n*10)/10}`).join(' / '):'なし';}
function cleanLanguage(root){const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);while(walker.nextNode()){const n=walker.currentNode;n.nodeValue=n.nodeValue.replaceAll('獲得：','生産：').replaceAll('働く人：','担当住民：').replaceAll('就労','担当');}}
function enhanceDialog(){
 const root=$('dialogContent');if(!root)return;root.querySelector('#relocate')?.remove();cleanLanguage(root);if(root.querySelector('.muraRichDetails'))return;
 const heading=root.querySelector('h2')?.textContent?.trim();if(!heading)return;
 const p=world.people.find(x=>x.name===heading);
 const panel=document.createElement('section');panel.className='muraRichDetails';
 if(p){
  const age=sys?.ageYears?.(p)??p.ageYears??0,stage=sys?.lifeStage?.(p)||p.lifeStage||'adult',trait=sys?.traitFor?.(p)||p.trait||'gentle',weight=sys?.carryWeight?.(p)||0,limit=sys?.carryLimit?.(p)||0,home=world.object(p.homeId),job=world.object(p.jobId);
  panel.innerHTML=`<div class="muraDetailHero"><div><strong>${p.role==='mayor'?t('mayorTitle'):heading}</strong><small>${p.status||''}</small></div><small>${Math.floor(age)}歳</small></div><div class="muraDetailGrid"><div><span>${t('age')} / ${t('lifeStage')}</span><b>${Math.floor(age)}歳 · ${t(stage)}</b></div><div><span>${t('trait')}</span><b>${t(trait)}</b></div><div><span>${t('carry')}</span><b>${weight.toFixed(1)} / ${limit.toFixed(1)} kg</b></div><div><span>${t('job')}</span><b>${job?defs[job.kind]?.label:'未担当'}</b></div><div class="muraDetailWide"><span>${t('home')}</span><b>${home?defs[home.kind]?.label:'なし'} · ${p.favorite||''}</b></div></div>`;
  if(p.role==='mayor'){
   const tools=document.createElement('div');tools.className='muraDetailTools';tools.innerHTML=`<button type="button" id="muraOpenMusic">${t('musicRoom')}</button><select id="muraLanguage" aria-label="${t('language')}">${options().map(o=>`<option value="${o.id}" ${o.id===getLocale()?'selected':''}>${o.label}</option>`).join('')}</select>`;panel.append(tools);tools.querySelector('#muraOpenMusic').onclick=()=>window.__SOUL_MUSIC__?.open?.();tools.querySelector('#muraLanguage').onchange=e=>{setLocale(e.target.value);panel.remove();enhanceDialog();};
  }
 }else{
  const o=world.list(ui.selectedRoom).find(x=>x.id===ui.selected);if(!o)return;const d=defs[o.kind]||{},workers=world.people.filter(p=>p.jobId===o.id).length,residents=world.people.filter(p=>p.homeId===o.id).length,status=o.phase==='planned'?t('planned'):o.phase==='building'?t('construction'):t('built'),remaining=o.phase==='building'&&o.buildDuration?Math.max(0,o.buildDuration*(1-(o.progress||0))):0;
  const stored=o.kind==='storage'?Object.entries(world.state.stock).filter(([,n])=>n>0).map(([k,n])=>`${RESOURCE_NAMES[k]} ${Math.floor(n)}`).join(' / ')||'まだありません':'';
  panel.innerHTML=`<div class="muraDetailHero"><div><strong>${d.label||o.kind}</strong><small>${d.trait||''}</small></div><small>${Math.round((o.rot||0)*180/Math.PI)}°</small></div><div class="muraDetailGrid"><div><span>${t('buildingState')}</span><b>${status}${o.phase==='building'?` ${Math.round((o.progress||0)*100)}%`:''}</b></div><div><span>${t('eta')}</span><b>${remaining&&sys?.constructionLabel?sys.constructionLabel(remaining):'—'}</b></div><div><span>${t('workers')}</span><b>${workers} / ${jobsOf(o)}</b></div><div><span>${t('residents')}</span><b>${residents} / ${capacityOf(o)}</b></div><div class="muraDetailWide"><span>${t('production')}</span><b>${resourcesText(d.produce)}</b></div><div class="muraDetailWide"><span>${t('consumption')}</span><b>${resourcesText(d.input)}</b></div>${o.kind==='storage'?`<div class="muraDetailWide"><span>${t('stored')}</span><b>${stored}</b></div><div class="muraDetailWide"><span>特別仕様</span><b>${t('unlimitedStorage')}</b></div>`:''}<div><span>${t('position')}</span><b>${o.x.toFixed(1)}, ${o.z.toFixed(1)}</b></div><div><span>${t('material')}</span><b>${o.material||'base'} · Lv.${o.level||1}</b></div></div>`;
 }
 root.append(panel);decorateButtons(panel);
}
const dialogObserver=new MutationObserver(()=>queueMicrotask(enhanceDialog));if($('dialogContent'))dialogObserver.observe($('dialogContent'),{subtree:true,childList:true,characterData:true});window.addEventListener('mura:locale',()=>{const p=$('dialogContent')?.querySelector('.muraRichDetails');p?.remove();enhanceDialog();});

function installVillageNow(){
 const panel=$('idleStatus');if(!panel)return;panel.classList.add('visible');const head=document.createElement('div');head.className='muraNowHead';head.innerHTML=`<div><small>MURAAAAAAA</small><b>${t('villageNow')}</b></div>`;panel.prepend(head);const event=$('muraEventButton');if(event)head.append(event);const climate=document.createElement('div');climate.className='muraClimate';climate.innerHTML='<span>季節<b data-season></b></span><span>天気<b data-weather></b></span><span>六年輪<b data-cycle></b></span>';head.after(climate);const scale=document.createElement('div');scale.className='muraScaleLine';panel.append(scale);
 const update=()=>{const c=currentClimate(),pop=world.population();climate.querySelector('[data-season]').textContent=t(c.season);climate.querySelector('[data-weather]').textContent=t(c.weather);climate.querySelector('[data-cycle]').textContent=`${c.cycleYear}/6 · ${t(c.lightAge)}`;scale.innerHTML=`<span>${t('population')} ${pop.people}</span><span>${t('activeResidents')} ${pop.activePeople??world.people.length} / ${t('virtualResidents')} ${pop.virtualPeople??0}</span>`;requestAnimationFrame(update);};update();
}

function currentClimate(){
 const day=Math.floor(world.state.clock),year=Math.floor(world.state.clock/DAYS_YEAR)+1,dayOfYear=((world.state.clock%DAYS_YEAR)+DAYS_YEAR)%DAYS_YEAR,seasonIndex=Math.min(3,Math.floor(dayOfYear/(DAYS_YEAR/4))),season=['spring','summer','autumn','winter'][seasonIndex],cycleYear=((year-1)%6)+1,lightAge=cycleYear<=2?'dawnAge':cycleYear<=4?'dayAge':'duskAge';world.state.climate??={day:-1,weather:'clear'};
 if(world.state.climate.day!==day){const n=(Math.sin(day*12.9898+78.233)*43758.5453)%1,roll=Math.abs(n);let weather='clear';if(season==='winter')weather=roll<.34?'snow':roll<.55?'cloudy':roll<.68?'wind':'clear';else if(season==='summer')weather=roll<.24?'rain':roll<.4?'cloudy':roll<.53?'wind':'clear';else weather=roll<.2?'rain':roll<.42?'cloudy':roll<.55?'wind':'clear';world.state.climate={day,weather};}
 return{day,year,dayOfYear,season,cycleYear,lightAge,weather:world.state.climate.weather};
}

function installSeasonWeather(){
 const count=220,geo=new T.BufferGeometry(),positions=new Float32Array(count*3);for(let i=0;i<count;i++){positions[i*3]=(Math.random()-.5)*80;positions[i*3+1]=Math.random()*45+3;positions[i*3+2]=(Math.random()-.5)*80;}geo.setAttribute('position',new T.BufferAttribute(positions,3));const mat=new T.PointsMaterial({color:0xdce9ee,size:.12,transparent:true,opacity:.55,depthWrite:false});const points=new T.Points(geo,mat);points.visible=false;view.scene.add(points);
 const foliageMaterials=new Set();for(const mesh of view.forestMeshes||[]){const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];for(const m of mats)if(m?.color){if(m.userData.muraBaseColor==null)m.userData.muraBaseColor=m.color.getHex();foliageMaterials.add(m);}}
 let lastSeason='';function tintFoliage(climate){if(lastSeason===climate.season&&world.state.climate.weather===points.userData.weather)return;lastSeason=climate.season;points.userData.weather=climate.weather;for(const m of foliageMaterials){const base=new T.Color(m.userData.muraBaseColor),hsl={};base.getHSL(hsl);if(hsl.s<.12||hsl.h<.12||hsl.h>.48){m.color.copy(base);continue;}const target={spring:0x8ebc76,summer:m.userData.muraBaseColor,autumn:0xc27645,winter:0x8e9b89}[climate.season];m.color.copy(base).lerp(new T.Color(target),climate.season==='summer'?0:.52);if(climate.weather==='rain'||climate.weather==='cloudy')m.color.multiplyScalar(.88);}}
 let last=performance.now();const animate=now=>{const dt=Math.min(.05,(now-last)/1000);last=now;const c=currentClimate();tintFoliage(c);const wet=c.weather==='rain'||c.weather==='snow';points.visible=wet;mat.size=c.weather==='snow'?.22:.075;mat.opacity=c.weather==='snow'?.72:.52;mat.color.set(c.weather==='snow'?0xf4f5ef:0xbad5e2);if(wet){const a=geo.attributes.position.array;for(let i=0;i<count;i++){a[i*3+1]-=dt*(c.weather==='snow'?3.2:34);if(c.weather==='snow')a[i*3]+=Math.sin(now*.001+i)*dt*.7;if(a[i*3+1]<.2){a[i*3]=(Math.random()-.5)*80;a[i*3+1]=45+Math.random()*15;a[i*3+2]=(Math.random()-.5)*80;}}geo.attributes.position.needsUpdate=true;points.position.x=view.target.x;points.position.z=view.target.z;}
  const cycleTint=new T.Color(c.lightAge==='dawnAge'?0xd6af91:c.lightAge==='duskAge'?0x8793b2:0xcad5c4),seasonTint=new T.Color(c.season==='spring'?0xc8d6b0:c.season==='summer'?0xbad1c8:c.season==='autumn'?0xc69a78:0xa9bbc7);view.scene.background.lerp(cycleTint,.025).lerp(seasonTint,.018);view.scene.fog.color.lerp(view.scene.background,.1);if(c.weather==='cloudy'||c.weather==='rain')view.scene.background.lerp(new T.Color(0x81939a),.08);if(c.weather==='snow')view.scene.background.lerp(new T.Color(0xc8d3d5),.05);
  const hour=Math.floor(world.state.time),minute=Math.floor((world.state.time-hour)*60),cycleNo=Math.floor((c.year-1)/6)+1,calendar=$('calendar');if(calendar)calendar.textContent=`第${cycleNo}輪 · ${c.cycleYear}/6年 · ${t(c.season)} · ${t(c.weather)} · ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;requestAnimationFrame(animate);};requestAnimationFrame(animate);
}

const mats={wood:new T.MeshStandardMaterial({color:0x795b42,roughness:.9}),cloth:new T.MeshStandardMaterial({color:0xb86257,roughness:.95}),metal:new T.MeshStandardMaterial({color:0x556169,roughness:.58,metalness:.35}),stone:new T.MeshStandardMaterial({color:0x8c918b,roughness:1}),gold:new T.MeshStandardMaterial({color:0xc79a4d,roughness:.6,metalness:.18}),green:new T.MeshStandardMaterial({color:0x738f67,roughness:.95}),blue:new T.MeshStandardMaterial({color:0x6f92a2,roughness:.8}),crystal:new T.MeshStandardMaterial({color:0x9b82c5,roughness:.25,emissive:0x302046,emissiveIntensity:.25})};
function box(g,x,y,z,w,h,d,m=mats.wood){const n=new T.Mesh(new T.BoxGeometry(w,h,d),m);n.position.set(x,y,z);g.add(n);return n;}function cyl(g,x,y,z,r,h,m=mats.wood,rotZ=0){const n=new T.Mesh(new T.CylinderGeometry(r,r,h,7),m);n.position.set(x,y,z);n.rotation.z=rotZ;g.add(n);return n;}function sphere(g,x,y,z,r,m=mats.stone){const n=new T.Mesh(new T.SphereGeometry(r,8,6),m);n.position.set(x,y,z);g.add(n);return n;}function cone(g,x,y,z,r,h,m=mats.wood){const n=new T.Mesh(new T.ConeGeometry(r,h,7),m);n.position.set(x,y,z);g.add(n);return n;}
function identity(kind,d){const g=new T.Group(),front=(d?.d||10)/2+.4;g.name='MURAAAAAAA_FacilityIdentity';
 switch(kind){
  case'storage':for(let i=0;i<3;i++)box(g,-1.2+i*1.2,.45,front,1,.9,1,mats.wood);cyl(g,2,.55,front,.48,1.1,mats.wood);break;
  case'logging':for(let i=0;i<4;i++)cyl(g,-1.8+i*1.2,.36,front,.28,2.2,mats.wood,Math.PI/2);break;
  case'quarry':sphere(g,-1.2,.65,front,1,mats.stone);sphere(g,.5,.45,front,.7,mats.stone);sphere(g,1.5,.55,front,.8,mats.stone);break;
  case'carpenter':box(g,0,.8,front,3,.18,1,mats.wood);cyl(g,0,1.25,front,.65,.12,mats.metal,Math.PI/2);break;
  case'market':for(const x of[-2,0,2]){cyl(g,x,1.2,front,.08,2.4,mats.wood);box(g,x,2.35,front,1.6,.18,1.4,x?mats.cloth:mats.green);}break;
  case'guardpost':case'barracks':for(const x of[-.7,.7]){cyl(g,x,1.2,front,.05,2.5,mats.wood);cone(g,x,2.55,front,.13,.35,mats.metal);}sphere(g,0,.85,front,.65,mats.metal);break;
  case'watchtower':cyl(g,0,2.2,front,.06,4.4,mats.wood);box(g,.7,3.6,front,1.4,.8,.08,mats.cloth);break;
  case'chapel':cyl(g,0,1.5,front,.3,2.3,mats.stone);cone(g,0,3.1,front,.7,2,mats.gold);break;
  case'harbor':cyl(g,0,2.1,front,.09,4.2,mats.wood);box(g,0,2.9,front,2.8,.09,.09,mats.wood);break;
  case'smith':box(g,0,.55,front,1.6,.65,.7,mats.metal);cone(g,1.3,.65,front,.55,.7,mats.metal);cyl(g,-1.5,1.5,front,.45,3,mats.stone);break;
  case'dojo':for(const x of[-1.3,1.3])cyl(g,x,1.3,front,.13,2.6,mats.wood);box(g,0,2.45,front,3.2,.22,.22,mats.wood);break;
  case'school':cyl(g,0,1.65,front,.07,3.3,mats.wood);sphere(g,0,2.95,front,.4,mats.gold);break;
  case'clinic':for(const x of[-.45,.45])sphere(g,x,1.1,front,.48,mats.green);cyl(g,0,.75,front,.08,1.5,mats.wood);break;
  case'farm':cyl(g,0,1.4,front,.9,2.8,mats.stone);cone(g,0,3.1,front,1,1.3,mats.cloth);break;
  case'fishpond':for(let i=0;i<4;i++)box(g,-1.5+i,0.18,front, .85,.18,2.2,mats.wood);break;
  case'hunting':for(const x of[-.8,.8]){cyl(g,x,1.2,front,.07,2.4,mats.wood);const b=cyl(g,x+(x<0?-.35:.35),2,front,.05,.9,mats.wood,x<0?-.7:.7);b.rotation.x=.35;}break;
  case'orchard':for(const x of[-1,0,1])sphere(g,x,.5,front,.45,mats.gold);box(g,0,.18,front,3,.35,1,mats.wood);break;
  case'inn':box(g,0,1.35,front,2.2,1.2,.18,mats.wood);cyl(g,-1.25,1.65,front,.08,1.7,mats.wood);break;
  case'diner':cyl(g,0,.6,front,.9,.7,mats.metal);cyl(g,0,1.2,front,.6,.18,mats.metal);break;
  case'restaurant':for(const x of[-1.4,0,1.4])sphere(g,x,1.5,front,.42,mats.cloth);box(g,0,2.2,front,3.8,.12,.12,mats.wood);break;
  case'weapons':for(const x of[-.45,.45]){const n=box(g,x,1.25,front,.09,2.5,.08,mats.metal);n.rotation.z=x<0?.65:-.65;}break;
  case'armor':sphere(g,0,1.15,front,.9,mats.metal);box(g,0,1.15,front+.45,.08,1.1,.08,mats.gold);break;
  case'jeweler':for(const x of[-.8,0,.8])cone(g,x,.8,front,.32,.9+(x===0?.5:0),mats.crystal);break;
  case'tools':{const tor=new T.Mesh(new T.TorusGeometry(.7,.16,6,12),mats.metal);tor.position.set(0,1.2,front);tor.rotation.y=Math.PI/2;g.add(tor);break;}
  case'tavern':for(const x of[-.65,.65])cyl(g,x,.65,front,.48,1.25,mats.wood);break;
  case'furniture':box(g,0,.55,front,1.3,.18,1.3,mats.wood);box(g,0,1.25,front+.5,1.3,1.3,.18,mats.wood);break;
  case'home':cyl(g,1.8,1.6,front-.5,.35,3.2,mats.stone);break;
  case'lodge':for(const x of[-1.4,1.4])cyl(g,x,1.8,front-.5,.28,3.6,mats.stone);break;
  case'clanManor':cyl(g,0,2.1,front,.11,4.2,mats.gold);sphere(g,0,4.2,front,.3,mats.crystal);break;
  default:{const k=hashKind(kind),m=[mats.green,mats.blue,mats.gold,mats.cloth][k%4];box(g,0,1.1,front,1.8,1.4,.18,m);cyl(g,-1.1,.9,front,.06,1.8,mats.wood);}
 }
 g.traverse(n=>{if(n.isMesh){n.castShadow=false;n.receiveShadow=true;}});return g;
}
function hashKind(text){let h=0;for(const c of text)h=(h*31+c.charCodeAt(0))|0;return Math.abs(h);}
function installFacilityIdentity(){const original=view.getBuilding.bind(view);view.getBuilding=(kind,material='base',level=1)=>{const g=original(kind,material,level);if(!g.userData.muraIdentity){g.add(identity(kind,defs[kind]));g.userData.muraIdentity=true;}return g;};for(const o of world.objects)if(defs[o.kind]?.building)view.getBuilding(o.kind,o.material||'base',o.level||1);view.rebuild();}

function mayorGear(node){if(!node||node.userData.muraMayor)return;node.userData.muraMayor=true;const g=new T.Group();g.name='MURAAAAAAA_MayorRegalia';const felt=new T.MeshStandardMaterial({color:0x4f725c,roughness:.92}),trim=new T.MeshStandardMaterial({color:0xd4b16d,roughness:.58,metalness:.12}),cloth=new T.MeshStandardMaterial({color:0x9b665d,roughness:.95});const brim=new T.Mesh(new T.CylinderGeometry(.48,.56,.11,12),felt);brim.position.set(0,1.95,0);g.add(brim);const crown=new T.Mesh(new T.ConeGeometry(.38,.62,10),felt);crown.position.set(.03,2.28,0);crown.rotation.z=-.12;g.add(crown);const sash=box(g,.22,1.15,-.27,.12,1.05,.07,trim);sash.rotation.z=-.4;const cape=new T.Mesh(new T.SphereGeometry(.58,10,7,0,Math.PI*2,0,Math.PI*.48),cloth);cape.position.set(0,1.17,.22);cape.scale.set(1,.92,.55);g.add(cape);const staff=cyl(g,.58,1.15,.08,.035,2.25,mats.wood);staff.rotation.z=-.05;sphere(g,.62,2.35,.08,.11,trim);const aura=new T.Mesh(new T.RingGeometry(.56,.72,32),new T.MeshBasicMaterial({color:0xffd783,transparent:true,opacity:.5,depthWrite:false,side:T.DoubleSide}));aura.rotation.x=-Math.PI/2;aura.position.y=.05;g.add(aura);g.userData.aura=aura;node.add(g);node.userData.muraMayorGroup=g;}
function installMayorModel(){const original=view.syncActor.bind(view);view.syncActor=(p,time,monster=false)=>{const r=original(p,time,monster),node=view.actorNodes.get(p.id);if(!monster&&p.role==='mayor'&&node){mayorGear(node);const g=node.userData.muraMayorGroup;if(g?.userData?.aura){g.userData.aura.rotation.z=time*.35;const s=1+Math.sin(time*2.2)*.06;g.userData.aura.scale.setScalar(s);}}return r;};}

installSelectionHighlight();
installPlacementTools();
installVillageNow();
installSeasonWeather();
installFacilityIdentity();
installMayorModel();
enhanceDialog();

window.__MURAAAAAAA_V2_UI__={version:2,currentClimate,refreshPending};
