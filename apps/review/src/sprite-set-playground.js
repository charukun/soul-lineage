import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {SPRITE_SET_ACTIONS,SPRITE_SET_DIRECTIONS} from '@soul/assets/character-sprite-set';
import {readSpriteSetFiles,loadSpriteSetURL,downloadSpriteSetBundle} from '@soul/assets/character-sprite-set/browser';
import {createCharacterSpriteSetActor} from '@soul/assets/character-sprite-set/three';
import {createSpriteSetSandbox} from '@soul/assets/character-sprite-set/sandbox';
import {REVIEW_DEV} from './review-lab-config.js';
import './sprite-set-playground.css';

const LABELS={idle:'待機',walk:'歩く',run:'走る',turn:'振り向く',attack:'攻撃',hit:'被弾',talk:'会話',pickup:'拾う',rest:'休息',jump:'跳ぶ',fall:'落下',vault:'乗り越え',climb:'登攀'};
export function mountSpriteSetPlayground(){
  const host=document.createElement('section');host.className='lab-section sprite-set-playground';
  host.innerHTML=`<div class="section-head"><div><span>CHARACTER SPRITE SET / V1</span><h2>行動する、2.5Dキャラクター。</h2></div><small>8 directions · action sheets · local draft</small></div>
    <div class="sprite-set-import"><label>manifest.json ＋ 行動PNG / bundle<input data-sprite-import type="file" multiple accept=".json,.png,application/json,image/png"></label><button data-sprite-sample type="button">13行動のサンプルを開く</button><button data-sprite-export type="button" disabled>セットを書き出す</button></div>
    <output data-sprite-status role="status" aria-live="polite">行動ごとの透過PNGをmanifestで束ねて読み込みます。画像1枚からの自動生成は行いません。</output>
    <div class="sprite-set-stage"><canvas aria-label="Sprite Set 3D Playground" tabindex="0"></canvas><output data-sprite-readout>素材未読込</output></div>
    <div class="sprite-set-actions" aria-label="actions">${SPRITE_SET_ACTIONS.map(a=>`<button type="button" data-sprite-action="${a}" disabled><b>${LABELS[a]}</b><small>${a}</small></button>`).join('')}</div>
    <div class="sprite-set-controls"><label>再生<select data-sprite-loop><option value="default">manifest指定</option><option value="loop">ループ</option><option value="once">1回・終端保持</option></select></label><button data-sprite-pause type="button">一時停止</button><button data-sprite-reset type="button">最初に戻す</button><label><input data-sprite-demo type="checkbox">全行動を巡回</label></div>
    <div class="sprite-set-controls"><label>表示方向<select data-sprite-direction><option value="auto">カメラから自動選択</option>${SPRITE_SET_DIRECTIONS.map(d=>`<option value="${d}">${d}</option>`).join('')}</select></label><label>Actor yaw<input data-sprite-yaw type="range" min="-180" max="180" value="0"></label><label>カメラ回転<input data-sprite-camera type="range" min="-180" max="180" value="25"></label></div>
    <div class="sprite-set-directions" aria-label="8方向の表示状態">${SPRITE_SET_DIRECTIONS.map(d=>`<span data-sprite-view="${d}">${d}</span>`).join('')}</div>
    <p class="sprite-set-note">足元の十字がpivot。影・地面・遮蔽物を共有しています。ドラッグでカメラ回転。Jump/Fallは接地基準の跳躍、Vault/Climbはstarter animationです。汎用の壁登り判定ではありません。</p>
    <details><summary>来歴とイベント</summary><pre data-sprite-provenance></pre><output data-sprite-events></output></details>
    <div class="sprite-set-session"><button data-sprite-rinne type="button" disabled>RINNEの村で動かす</button><label><input data-sprite-send type="checkbox" checked>接続先にも操作を送る</label><output data-sprite-remote>保存しない検証セッション。RINNEを開いたら通常操作で村へ入ってください。</output></div>`;
  document.querySelector('.lab-layout').after(host);
  const find=selector=>host.querySelector(selector),canvas=find('canvas'),abort=new AbortController(),on=(node,event,fn)=>node.addEventListener(event,fn,{signal:abort.signal});
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x23312e);scene.fog=new THREE.Fog(0x23312e,9,18);
  const camera=new THREE.PerspectiveCamera(38,1,.05,40),controls=new OrbitControls(camera,canvas);controls.target.set(0,.85,0);controls.enableDamping=true;controls.minDistance=2.2;controls.maxDistance=10;controls.maxPolarAngle=Math.PI*.48;
  const owned=[];const mesh=(geometry,material)=>{owned.push(geometry,material);const result=new THREE.Mesh(geometry,material);scene.add(result);return result;};
  scene.add(new THREE.HemisphereLight(0xdce7e0,0x4b514a,2));const light=new THREE.DirectionalLight(0xffedce,2.2);light.position.set(-3,6,5);scene.add(light);
  const floor=mesh(new THREE.PlaneGeometry(12,12),new THREE.MeshStandardMaterial({color:0x78817a,roughness:.95}));floor.rotation.x=-Math.PI/2;
  const grid=new THREE.GridHelper(12,24,0xb4b3a0,0x64726a);grid.position.y=.006;scene.add(grid);owned.push(grid.geometry,grid.material);
  const obstacle=mesh(new THREE.BoxGeometry(.7,.65,1.2),new THREE.MeshStandardMaterial({color:0x93856b,roughness:.9}));obstacle.position.set(1.4,.325,-.9);
  for(const x of [-.18,.18]){const marker=mesh(new THREE.BoxGeometry(.018,.012,.55),new THREE.MeshBasicMaterial({color:0xd8c999}));marker.position.set(x,.012,0);}
  let actor=null,sandbox=null,disposed=false,busy=false,raf=0,last=performance.now(),readoutTime=0,paused=false,pending=null,remoteSnapshot=null,transferTimeout=0;
  const eventRows=[];
  const status=text=>{if(!disposed)find('[data-sprite-status]').textContent=text;};
  const cameraAngle=degrees=>{const angle=Number(degrees)*Math.PI/180;controls.enableDamping=false;controls.update();camera.position.set(Math.sin(angle)*5.5,2.6,Math.cos(angle)*5.5);controls.target.set(0,.85,0);controls.update();controls.enableDamping=true;};
  cameraAngle(25);
  const resize=()=>{const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  const canMoveTo=(x,z,r)=>Math.abs(x)<3.7-r&&Math.abs(z)<3.7-r&&!(Math.abs(x-1.4)<.35+r&&Math.abs(z+.9)<.6+r);
  async function install(resources){
    const next=await createCharacterSpriteSetActor(THREE,resources,{playable:true,onEvent:event=>{eventRows.push(`${event.action}: ${event.name||event.type} @${event.frame}`);if(eventRows.length>12)eventRows.shift();}});
    if(disposed){next.dispose();return;}
    sandbox?.dispose();actor?.dispose();actor=next;scene.add(actor.object);sandbox=createSpriteSetSandbox(actor,{canMoveTo});sandbox.reset();sandbox.pause(paused);eventRows.length=0;
    host.dataset.spriteReady='true';
    for(const button of host.querySelectorAll('[data-sprite-action]'))button.disabled=!Object.hasOwn(actor.manifest.actions,button.dataset.spriteAction);
    find('[data-sprite-export]').disabled=false;find('[data-sprite-rinne]').disabled=false;find('[data-sprite-demo]').checked=false;
    find('[data-sprite-provenance]').textContent=JSON.stringify({id:actor.manifest.id,stage:actor.manifest.stage,provenance:actor.manifest.provenance,approval:actor.manifest.approval},null,2);
    status(`${actor.manifest.label} · ${Object.keys(actor.manifest.actions).length}行動 / 8方向 · local-draft（本番未承認）`);
  }
  async function run(work){if(busy||disposed)return;busy=true;host.dataset.busy='true';try{await work();}catch(error){status(error.message);}finally{busy=false;host.dataset.busy='false';}}
  on(find('[data-sprite-import]'),'change',event=>{const files=Array.from(event.target.files||[]);if(files.length)void run(async()=>install(await readSpriteSetFiles(files,{playable:true})));});
  on(find('[data-sprite-sample]'),'click',()=>void run(async()=>{status('行動PNGを読み込んで検証しています');await install(await loadSpriteSetURL('./sprite-sets/kaykit-knight/manifest.json',{playable:true}));}));
  on(find('[data-sprite-export]'),'click',()=>{if(actor)downloadSpriteSetBundle(actor.bundle);});
  const send=(command,data={})=>{if(pending&&find('[data-sprite-send]').checked)pending.target.postMessage({type:'rinne.sprite-set.command',token:pending.token,command,...data},pending.origin);};
  for(const button of host.querySelectorAll('[data-sprite-action]'))on(button,'click',()=>{
    if(!sandbox)return;find('[data-sprite-demo]').checked=false;sandbox.setDemo(false);
    const choice=find('[data-sprite-loop]').value,options=choice==='default'?{}:{loop:choice==='loop'};
    sandbox.play(button.dataset.spriteAction,options);send('action',{action:button.dataset.spriteAction});
  });
  on(find('[data-sprite-pause]'),'click',()=>{paused=!paused;sandbox?.pause(paused);find('[data-sprite-pause]').textContent=paused?'再開':'一時停止';send('pause',{value:paused});});
  on(find('[data-sprite-reset]'),'click',()=>{sandbox?.reset();sandbox?.setDemo(false);find('[data-sprite-demo]').checked=false;send('reset');});
  on(find('[data-sprite-demo]'),'change',event=>{sandbox?.setDemo(event.target.checked);send('demo',{value:event.target.checked});});
  on(find('[data-sprite-direction]'),'change',event=>actor?.setDirection(event.target.value==='auto'?null:event.target.value));
  on(find('[data-sprite-yaw]'),'input',event=>{if(sandbox)sandbox.proxy.setTransform(sandbox.proxy.position,Number(event.target.value)*Math.PI/180);});
  on(find('[data-sprite-camera]'),'input',event=>cameraAngle(event.target.value));
  on(find('[data-sprite-rinne]'),'click',()=>{
    if(!actor)return;const url=new URL(REVIEW_DEV.rinne);
    if(['localhost','127.0.0.1'].includes(location.hostname)){url.protocol=location.protocol;url.hostname=location.hostname;url.port=location.port==='5276'?'5273':'5173';url.pathname='/';}
    const token=crypto.randomUUID();url.searchParams.set('character25d','actor');url.searchParams.set('spriteSet','1');url.searchParams.set('spriteTransfer',token);
    const target=window.open(url.href,'rinne-sprite-set');if(!target){status('RINNEを開くポップアップを許可してください');return;}
    pending={target,token,origin:url.origin,bundle:structuredClone(actor.bundle)};remoteSnapshot=null;host.dataset.rinneConnected='false';clearTimeout(transferTimeout);
    transferTimeout=setTimeout(()=>{if(host.dataset.rinneConnected!=='true'){pending=null;find('[data-sprite-remote]').textContent='転送期限が切れました。もう一度開いてください。';}},90000);
    find('[data-sprite-remote]').textContent='転送中。RINNEで村へ入ると隣にsandbox actorが現れます。';
  });
  on(window,'message',event=>{
    if(!pending||event.source!==pending.target||event.origin!==pending.origin||event.data?.token!==pending.token)return;
    if(event.data.type==='rinne.sprite-set.ready')pending.target.postMessage({type:'rinne.sprite-set.transfer',token:pending.token,bundle:pending.bundle},pending.origin);
    if(event.data.type==='rinne.sprite-set.received'){clearTimeout(transferTimeout);host.dataset.rinneConnected='true';find('[data-sprite-remote]').textContent='接続済み。下の行動操作はRINNE内のactorにも届きます。';}
    if(event.data.type==='rinne.sprite-set.rejected')find('[data-sprite-remote]').textContent='転送/操作エラー: '+String(event.data.message||'');
    if(event.data.type==='rinne.sprite-set.state')remoteSnapshot=event.data.snapshot;
  });
  canvas.spriteSetSnapshot=()=>({actor:actor?.snapshot()||null,sandbox:sandbox?.snapshot()||null,camera:{x:camera.position.x,y:camera.position.y,z:camera.position.z},disposed});
  canvas.spriteSetRinneSnapshot=()=>remoteSnapshot;
  function frame(now){
    if(disposed)return;const dt=Math.min(.05,(now-last)/1000);last=now;controls.update();sandbox?.update(dt,camera);renderer.render(scene,camera);readoutTime+=dt;
    if(actor&&readoutTime>.1){
      readoutTime=0;const state=actor.snapshot();find('[data-sprite-readout]').textContent=`${state.action} · ${state.view} · frame ${state.frame+1}/${actor.manifest.actions[state.action].columns} · ${state.completed?'終端':state.paused?'停止':state.loop?'loop':'one-shot'}`;
      for(const item of host.querySelectorAll('[data-sprite-view]'))item.dataset.active=String(item.dataset.spriteView===state.view);
      for(const item of host.querySelectorAll('[data-sprite-action]'))item.setAttribute('aria-pressed',String(item.dataset.spriteAction===state.action));
      find('[data-sprite-events]').textContent=eventRows.join('\n');
    }
    raf=requestAnimationFrame(frame);
  }
  raf=requestAnimationFrame(frame);
  function dispose(){if(disposed)return;disposed=true;abort.abort();clearTimeout(transferTimeout);pending=null;observer.disconnect();cancelAnimationFrame(raf);sandbox?.dispose();actor?.dispose();controls.dispose();for(const item of owned)item.dispose();renderer.dispose();delete canvas.spriteSetSnapshot;delete canvas.spriteSetRinneSnapshot;}
  addEventListener('pagehide',dispose,{once:true});return {host,dispose};
}
