const village=window.village;
if(!village)throw new Error('MURAAAAAAA experience layer requires a booted village');

const {world,sim,view,ui,save,selection,cancelPlacement}=village;
const $=id=>document.getElementById(id);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const pad=n=>String(n).padStart(2,'0');

function installPlacementCommit(){
 const button=$('cancelPlace');
 if(!button)return;
 button.textContent='完了';
 button.onclick=()=>{
  const p=ui.pending;
  if(!p){cancelPlacement();return;}
  if(p.error){showMiniNotice(p.error);return;}
  if(!Number.isFinite(p.x)||!Number.isFinite(p.z)){showMiniNotice('置きたい場所を先にタップしてください');return;}
  const result=p.moveId?world.move(p.moveId,p.x,p.z,p.rot,p.roomId):world.add(p.kind,p.x,p.z,p.rot,p.roomId,{material:p.material});
  if(result?.error){showMiniNotice(result.error);return;}
  const roomId=p.roomId;
  cancelPlacement();
  save();
  if(result?.object?.id)selection(result.object.id,roomId);
  showMiniNotice(p.moveId?'移動しました':'施設を配置しました');
 };
}

let noticeTimer=0;
function showMiniNotice(text){
 const toast=$('toast'),label=$('toastText');
 if(!toast||!label)return;
 label.textContent=text;toast.hidden=false;
 clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>toast.hidden=true,2600);
}

function installBuildButtonRecovery(){
 const button=$('build');if(!button)return;
 const clear=()=>{button.blur();button.classList.remove('muraPressed');};
 button.addEventListener('pointerdown',()=>button.classList.add('muraPressed'),{passive:true});
 button.addEventListener('pointerup',clear,{passive:true});
 button.addEventListener('pointercancel',clear,{passive:true});
 button.addEventListener('click',()=>requestAnimationFrame(clear));
}

function installCameraGestures(){
 const canvas=$('game');if(!canvas)return;
 const pointers=new Map();
 let inertia={vx:0,vy:0,raf:0,last:0},multi=null;
 const stopInertia=()=>{if(inertia.raf)cancelAnimationFrame(inertia.raf);inertia.raf=0;inertia.vx=inertia.vy=0;};
 const runInertia=()=>{
  stopInertia();
  let last=performance.now();
  const tick=now=>{
   const dt=Math.min(32,now-last);last=now;
   inertia.vx*=Math.pow(.91,dt/16);inertia.vy*=Math.pow(.91,dt/16);
   if(Math.hypot(inertia.vx,inertia.vy)<.035){stopInertia();return;}
   view.pan(inertia.vx*dt,inertia.vy*dt);
   inertia.raf=requestAnimationFrame(tick);
  };
  inertia.raf=requestAnimationFrame(tick);
 };
 canvas.addEventListener('pointerdown',e=>{
  stopInertia();
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,lastT:performance.now(),drag:false,multi:false});
  if(pointers.size===2){const [a,b]=[...pointers.values()];multi={angle:Math.atan2(b.y-a.y,b.x-a.x)};for(const p of pointers.values())p.multi=true;}
 },{capture:true,passive:true});
 canvas.addEventListener('pointermove',e=>{
  const p=pointers.get(e.pointerId);if(!p)return;
  const now=performance.now(),dx=e.clientX-p.x,dy=e.clientY-p.y;
  p.lastX=p.x;p.lastY=p.y;p.x=e.clientX;p.y=e.clientY;
  if(pointers.size>=2){
   const [a,b]=[...pointers.values()],angle=Math.atan2(b.y-a.y,b.x-a.x);
   if(multi){
    let delta=angle-multi.angle;
    if(delta>Math.PI)delta-=Math.PI*2;if(delta<-Math.PI)delta+=Math.PI*2;
    // web/main applies yaw -= delta. Apply +2*delta after it, yielding the natural +delta direction.
    queueMicrotask(()=>{view.yaw+=delta*2;view.updateCamera();});
   }
   multi={angle};p.multi=true;return;
  }
  multi=null;
  if(ui.pending||ui.drawer||$('dialog')?.open||$('onlineDialog')?.open)return;
  const total=Math.hypot(e.clientX-(p.startX??(p.startX=e.clientX-dx)),e.clientY-(p.startY??(p.startY=e.clientY-dy)));
  if(total>4)p.drag=true;
  if(!p.drag)return;
  e.preventDefault();e.stopPropagation();
  view.pan(dx,dy);
  const dt=Math.max(1,now-p.lastT);inertia.vx=dx/dt;inertia.vy=dy/dt;p.lastT=now;
 },{capture:true,passive:false});
 const end=e=>{
  const p=pointers.get(e.pointerId);if(!p)return;
  pointers.delete(e.pointerId);
  if(p.drag&&!p.multi&&pointers.size===0&&Math.hypot(inertia.vx,inertia.vy)>.08)runInertia();
  if(pointers.size<2)multi=null;
 };
 canvas.addEventListener('pointerup',end,{capture:true,passive:true});
 canvas.addEventListener('pointercancel',end,{capture:true,passive:true});
}

function installMayorFollow(){
 const button=document.createElement('button');
 button.id='muraMayorFollow';button.type='button';button.className='feltControl';button.innerHTML='<span class="feltIcon">◎</span><span>村長を追う</span>';
 document.body.append(button);
 const refresh=()=>button.classList.toggle('active',!!view.followId&&world.people.some(p=>p.id===view.followId&&p.role==='mayor'));
 button.onclick=()=>{
  const mayor=world.people.find(p=>p.role==='mayor');
  if(!mayor){showMiniNotice('村長が見つかりません');return;}
  if(view.followId===mayor.id){view.followId=null;view.lastInteraction=performance.now();showMiniNotice('追尾を解除しました');}
  else{view.focus(mayor.x,mayor.z,Math.min(view.span,38));view.followId=mayor.id;showMiniNotice('村長を追尾します。画面を動かすと解除します');}
  refresh();
 };
 setInterval(refresh,500);
}

const LOG_KEY='mura.village.event-log.v2';
function installEventLog(){
 const wrap=document.createElement('aside');wrap.id='muraEventLog';wrap.hidden=true;wrap.innerHTML='<header><div><small>村の記録</small><b>出来事</b></div><button type="button" data-close aria-label="閉じる">×</button></header><div class="eventList"></div>';
 const opener=document.createElement('button');opener.id='muraEventButton';opener.type='button';opener.className='feltControl';opener.innerHTML='<span>記録</span><b data-count>0</b>';
 document.body.append(opener,wrap);
 const list=wrap.querySelector('.eventList'),count=opener.querySelector('[data-count]');
 let records=[];try{records=JSON.parse(localStorage.getItem(LOG_KEY))||[];}catch{}
 const persist=()=>{try{localStorage.setItem(LOG_KEY,JSON.stringify(records.slice(0,30)));}catch{}};
 const timeLabel=()=>`${Math.floor(world.state.clock/365)+1}年 ${Math.floor(world.state.clock%365)+1}日 ${pad(Math.floor(world.state.time))}:${pad(Math.floor((world.state.time%1)*60))}`;
 function focusFor(record){
  if(record.type==='threat'&&sim.raid?.monsters?.length){const alive=sim.raid.monsters.filter(m=>m.health>0);if(alive.length){const x=alive.reduce((n,m)=>n+m.x,0)/alive.length,z=alive.reduce((n,m)=>n+m.z,0)/alive.length;view.focus(x,z,32);wrap.hidden=true;return true;}}
  const person=world.people.find(p=>record.text.includes(p.name));if(person){view.focus(person.x,person.z,30);wrap.hidden=true;return true;}
  return false;
 }
 function render(){
  count.textContent=String(records.length);count.hidden=!records.length;
  list.replaceChildren(...records.map(record=>{const b=document.createElement('button');b.type='button';b.className=`eventItem type-${record.type}`;b.innerHTML=`<small>${record.when}</small><span>${record.text.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</span>${record.type==='threat'?'<em>場所を見る ›</em>':''}`;b.onclick=()=>{if(!focusFor(record)&&record.type==='threat')showMiniNotice('この出来事の場所はすでに静かになっています');};return b;}));
  if(!records.length){const empty=document.createElement('p');empty.className='eventEmpty';empty.textContent='大きな出来事が起きると、ここに記録されます。';list.append(empty);}
 }
 const previous=sim.onEvent;
 sim.onEvent=(text,type)=>{
  previous?.(text,type);
  if(!['threat','loss','rescue','voyage','arrival'].includes(type))return;
  records.unshift({id:`${Date.now()}-${Math.random()}`,text,type,when:timeLabel()});records=records.slice(0,30);persist();render();
  opener.classList.add('pulse');setTimeout(()=>opener.classList.remove('pulse'),900);
 };
 opener.onclick=()=>{wrap.hidden=!wrap.hidden;if(!wrap.hidden)render();};
 wrap.querySelector('[data-close]').onclick=()=>wrap.hidden=true;
 render();
}

function installOpeningTutorial(){
 const key='mura.village.mayor-intro.v1';
 let seen=false;try{seen=localStorage.getItem(key)==='1';}catch{}
 if(seen)return;
 const overlay=document.createElement('div');overlay.id='muraMayorIntro';overlay.innerHTML='<section><small>MURAAAAAAA</small><h2>あなたは村長です。</h2><p>この村で暮らす人を見守り、住まいと仕事場を増やして、少しずつ村を発展させましょう。</p><div class="introTips"><span>指1本で村を移動</span><span>指2本で拡大・回転</span><span>「つくる」で施設を配置</span></div><button type="button" data-start>村づくりを始める</button></section>';
 document.body.append(overlay);
 overlay.querySelector('[data-start]').onclick=()=>{try{localStorage.setItem(key,'1');}catch{}overlay.classList.add('closing');setTimeout(()=>overlay.remove(),360);const mayor=world.people.find(p=>p.role==='mayor');if(mayor)view.focus(mayor.x,mayor.z,46);};
}

function installSmoothWorldTime(){
 let targetHour=world.state.time,last=performance.now();
 view.setTime=hour=>{targetHour=((hour%24)+24)%24;};
 const lerpColor=(color,hex,k)=>{const r=((hex>>16)&255)/255,g=((hex>>8)&255)/255,b=(hex&255)/255;color.r+=(r-color.r)*k;color.g+=(g-color.g)*k;color.b+=(b-color.b)*k;};
 const mixHex=(a,b,t)=>{const ar=(a>>16)&255,ag=(a>>8)&255,ab=a&255,br=(b>>16)&255,bg=(b>>8)&255,bb=b&255;return((Math.round(ar+(br-ar)*t)<<16)|(Math.round(ag+(bg-ag)*t)<<8)|Math.round(ab+(bb-ab)*t));};
 const loop=now=>{
  const dt=Math.min(.1,(now-last)/1000);last=now;
  const h=targetHour,day=smooth(5.1,7.2,h)*(1-smooth(17.0,20.2,h)),sunset=Math.max(0,1-Math.abs(h-18.15)/2.35),k=1-Math.exp(-dt/4.8);
  const baseSky=mixHex(0x263e54,0xb5d0cf,day),sky=mixHex(baseSky,0xd2a98e,sunset*.56);
  const baseSun=mixHex(0xb1c9ea,0xffe0b2,day),sun=mixHex(baseSun,0xffa864,sunset*.72);
  const hemi=mixHex(0x93afd2,0xddeafb,day),ground=mixHex(0x4c6555,0x8e9f6b,day),water=mixHex(0x345369,0x65a4ae,day);
  view.sun.intensity+=(.2+day*2.45+sunset*.28-view.sun.intensity)*k;lerpColor(view.sun.color,sun,k);
  view.hemi.intensity+=(.68+day*1.05-view.hemi.intensity)*k;lerpColor(view.hemi.color,hemi,k);lerpColor(view.hemi.groundColor,ground,k);
  lerpColor(view.scene.background,sky,k);lerpColor(view.scene.fog.color,sky,k);lerpColor(view.waterMat.uniforms.tint.value,water,k);
  view.renderer.toneMappingExposure+=(1.03+day*.09-view.renderer.toneMappingExposure)*k;
  const calendar=$('calendar');if(calendar){const hour=Math.floor(h),minute=Math.floor((h-hour)*60);calendar.textContent=`${Math.floor(world.state.clock/365)+1}年目 · ${Math.floor(world.state.clock%365)+1}日 · ${pad(hour)}:${pad(minute)}`;}
  const scale=clamp(1.05+(46-view.span)*.012,.72,1.55);$('speechLayer')?.style.setProperty('--mura-bubble-scale',scale.toFixed(3));
  requestAnimationFrame(loop);
 };
 requestAnimationFrame(loop);
}

installPlacementCommit();
installBuildButtonRecovery();
installCameraGestures();
installMayorFollow();
installEventLog();
installOpeningTutorial();
installSmoothWorldTime();

window.__MURAAAAAAA_EXPERIENCE__={version:1};
