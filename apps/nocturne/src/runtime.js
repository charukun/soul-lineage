function updateUI(){
 if(!hero)return;const hp=clamp(hero.hp/hero.maxHp,0,1);$('health-fill').style.width=(hp*100)+'%';$('hp-label').textContent=`${Math.ceil(hero.hp)} / ${Math.round(hero.maxHp)}`;$('kills').textContent=game.kills;$('timer').textContent=formatTime(game.time);$('burst-icon').style.setProperty('--energy',game.energy+'%');$('burst-text').textContent=`${Math.floor(game.energy)}% · 自動発動`;if(game.boss)$('boss-fill').style.width=(game.boss.hp/game.boss.maxHp*100)+'%';
}
function renderCamera(dt){
 if(!hero)return;intro+=dt;const isTitle=game.phase==='title';
 const follow=W/H<.8?.9:.4;
 const desired=isTitle?new V(-2,.6,0):hero.pos.clone().multiplyScalar(follow).add(new V(0,.65,-.4));cameraTarget.lerp(desired,1-Math.exp(-dt*3.4));
 const baseAngle=isTitle?.62+Math.sin(intro*.045)*.08:.65,approach=isTitle?1+Math.max(0,1-intro/7)*.32:1;
 camera.position.set(cameraTarget.x+Math.sin(baseAngle)*23*approach,cameraTarget.y+22*approach,cameraTarget.z+Math.cos(baseAngle)*23*approach);
 if(game.shake>0){camera.position.x+=Math.sin(clock*93)*game.shake;camera.position.y+=Math.cos(clock*84)*game.shake*.6;}
 camera.lookAt(cameraTarget);camera.updateMatrixWorld();heroLight.position.copy(hero.pos).add(new V(0,3.5,0));for(const t of torches)t.light.intensity=30+Math.sin(clock*7+t.seed)*5;
}
function loop(now){
 try{
  const elapsed=(now-previous)/1000||1/60,realDt=Math.min(.05,elapsed);previous=now;clock+=realDt;
  const frozen=game.phase==='paused'||document.hidden;let dt=frozen?0:realDt*(game.phase==='title'?1:game.speed);
  if(game.hitstop>0){game.hitstop-=realDt;dt*=.12;}
  if(game.ready&&dt>0)simulate(dt);renderCamera(realDt);
  renderer.info.autoReset=false;renderer.info.reset();if(game.high)composer.render();else renderer.render(scene,camera);drawEffects();
  frameCount++;frameTime+=elapsed;if(frameTime>.5){fps=Math.round(frameCount/frameTime);frameTime=0;frameCount=0;updateUI();}
 }catch(error){console.error(error);fail(error.message);renderer.setAnimationLoop(null);}
}
function fail(message){$('fatal-detail').textContent=message;show('fatal');show('loader',false);record('error',{message});}
$('start').onclick=start;$('restart').onclick=start;$('pause').onclick=pause;$('resume').onclick=pause;$('back-title').onclick=title;$('end-title-button').onclick=title;
$('sound').onclick=()=>sound.toggle();$('credits-open').onclick=()=>$('credits').showModal();$('credits-close').onclick=()=>$('credits').close();
$('speed').onclick=()=>{game.speed=game.speed===1?2:1;$('speed').textContent=game.speed+'×';};
$('quality').onclick=()=>{game.high=!game.high;$('quality').textContent=game.high?'画質 高':'画質 標準';resize();};
for(const btn of document.querySelectorAll('[data-stance]'))btn.onclick=()=>{game.stance=btn.dataset.stance;document.querySelectorAll('[data-stance]').forEach(x=>x.classList.toggle('selected',x===btn));$('stance-label').textContent=styles[game.stance].name;toast(styles[game.stance].name);record('stance',{stance:game.stance});};
for(const btn of document.querySelectorAll('[data-upgrade]'))btn.onclick=()=>chooseUpgrade(btn.dataset.upgrade);
$('world').addEventListener('pointerdown',e=>{
 if(game.phase!=='battle')return;ndc.set(e.clientX/W*2-1,-e.clientY/H*2+1);ray.setFromCamera(ndc,camera);const pos=new V();
 if(ray.ray.intersectPlane(groundPlane,pos)){pos.y=0;const len=pos.length();if(len>8.5)pos.multiplyScalar(8.5/len);game.moveTarget=pos;game.moveTime=3;ring(pos,.55,'#d4c993',.8);record('waypoint',{x:pos.x,z:pos.z});}
});
addEventListener('keydown',e=>{if(e.code==='Space'||e.code==='Escape'){if($('credits').open)return;e.preventDefault();pause();}});
window.__NOCTURNE__={
 game,trace,
 get metrics(){
  let meshes=0,skinned=0,unattributed=0;scene?.traverse(o=>{if(o.isMesh){meshes++;if(o.isSkinnedMesh)skinned++;if(!o.userData.assetSource)unattributed++;}});
  return{ready:game.ready,phase:game.phase,wave:game.wave,kills:game.kills,damage:game.damage,received:game.received,bursts:game.bursts,time:game.time,hp:hero?.hp,maxHp:hero?.maxHp,models:[...usedModels],loadedBytes,meshes,skinned,unattributed,generatedModels:0,actors:actors.length,activeAnimations:actors.filter(a=>a.action?.isRunning()).length,drawCalls:renderer?.info.render.calls,triangles:renderer?.info.render.triangles,fps,webgl2:!!renderer?.getContext().texStorage2D};
 },
 inspectActors:()=>actors.map(a=>({kind:a.kind,hp:a.hp,pos:a.pos.toArray(),animation:a.actionName,attack:a.attack?.time,nodes:a.root.children.map(o=>o.name)})),
 advance(seconds){for(let i=0;i<seconds*60;i++){if(['paused','title','victory','defeat'].includes(game.phase))break;simulate(1/60);}updateUI();},start,title
};
try{
 makeRenderer();await loadAssets();buildForest();game.ready=true;title();$('quality').textContent=game.high?'画質 高':'画質 標準';
 await renderer.compileAsync(scene,camera);show('loader',false);previous=performance.now();renderer.setAnimationLoop(loop);record('ready',{models:usedModels.size});
}catch(error){console.error(error);fail(error.message);}
