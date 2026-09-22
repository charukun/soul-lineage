// One-shot source migration. Never called by dev/build or the Fast DEV gate.
// Keeps the pinned NOCTURNE combat/forest/animation implementation, removes its UI.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const base='a923fcc02dfef9a57aad00001bd3daab8786fc07';
const source=execFileSync('git',['show',base+':apps/review/src/nocturne-stage.js'],{encoding:'utf8'});
const digest=createHash('sha1').update(`blob ${Buffer.byteLength(source)}\0`).update(source).digest('hex');
assert.equal(digest,'11c667ea69302f87a925e03317b849969f83e6dd','Pinned source changed');
const dir='apps/review/src/nocturne';mkdirSync(dir,{recursive:true});
if(existsSync(dir+'/runtime.js')){console.log('Native source already materialized; preserving subsequent edits');process.exit(0);}
const between=(a,b)=>{const start=source.indexOf(a),end=source.indexOf(b,start+1);assert.ok(start>=0&&end>start,`${a} -> ${b}`);return source.slice(start,end);};
function change(text,from,to){assert.ok(text.includes(from),'Missing source anchor: '+from);return text.replace(from,to);}
const imports=between("import * as THREE",'const NOCTURNE_ASSET_ORIGIN');
let head=between('const clamp =','// Sound synthesis');
head=change(head,"const show = (id,on=true) => $(id).classList.toggle('hidden',!on);",'');
head=change(head,"const fx=$('effects'),ctx=fx.getContext('2d');","const fx=effects,ctx=fx.getContext('2d');if(!ctx)throw Error('2D effect canvas unavailable');");
head=change(head,'high:innerWidth>720','high:stage.clientWidth>720');
head=change(head,'let W=innerWidth,H=innerHeight','let W=Math.max(1,stage.clientWidth),H=Math.max(1,stage.clientHeight)');
let rendererCode=between('function resize(){','async function loadAssets(){');
rendererCode=change(rendererCode,'W=innerWidth;H=innerHeight;','W=Math.max(1,stage.clientWidth);H=Math.max(1,stage.clientHeight);');
rendererCode=rendererCode.split('\n').filter(line=>!line.includes("addEventListener('webglcontextlost'")&&!line.includes("addEventListener('resize',resize)")).join('\n');
const environment=between('function tintMaterial','function actor(');
writeFileSync(dir+'/environment.js',`// Original NOCTURNE environment from ${base}; geometry and lighting layout preserved.\nexport function buildNocturneEnvironment(env){\nconst {THREE,V,TAU,models,scene,environmentMeshes,torches,rand,randRange}=env;\n${environment}\nbuildForest();\n}\n`);
let actors=between('function actor(','function startAttack(');
actors=change(actors,"const clip=a.clips.get(name)||a.clips.get('Idle');if(!clip)return;","const clip=a.clips.get(name);if(!clip)throw Error('Missing NOCTURNE animation: '+a.kind+'/'+name);");
actors=change(actors,"a.actionName=name;","a.actionName=name;record('animation',{kind:a.kind,name,once});");
let combat=between('function startAttack(','function spawnEnemy(');
combat=combat.split('\n').map(line=>line.trimStart().startsWith('numbers.push(')?' randRange(-15,15); // Preserve the original RNG stream without drawing damage numbers.':line).join('\n');
combat=change(combat,'game.kills++;','game.kills++;allKills++;');
const rules=`
function spawnEnemy(){
 const a=rand()*TAU,r=randRange(6.8,8.5),kind=game.wave>1&&game.spawned%4===3?'mage':game.spawned%3===0?'warrior':'minion';
 const boss=game.wave===5&&game.spawned===game.waveCount-1;
 const unit=actor(boss?'warrior':kind,new V(Math.cos(a)*r,0,Math.sin(a)*r),boss);
 if(boss){game.boss=unit;record('boss-spawn');}
 game.spawned++;record('spawn',{kind:unit.kind,boss});
}
function wave(){game.wave++;game.waveCount=[0,6,8,10,12,10][game.wave];game.spawned=0;game.spawnTimer=.8;game.phase='battle';record('wave',{wave:game.wave});notify('BATTLE');}
function toast(){} // Combat cue only; no text HUD in this stage.
function start(){
 for(const a of actors)removeActor(a);actors=[];particles=[];projectiles=[];arcs=[];rings=[];numbers=[];
 rounds++;Object.assign(game,{phase:'battle',time:0,wave:0,kills:0,damage:0,received:0,bursts:0,energy:0,level:1,moveTarget:null,moveTime:0,boss:null,shake:0,hitstop:0,resetSeconds:0});
 hero=actor('hero',new V(0,0,2.5));hero.object.rotation.y=Math.PI;cameraTarget.copy(hero.pos).multiplyScalar(.15);wave();record('start',{round:rounds});
}
function chooseUpgrade(choice){
 if(game.phase!=='upgrade')return;
 if(choice==='power')hero.damage*=1.22;
 else if(choice==='vitality'){hero.maxHp+=40;hero.hp=Math.min(hero.maxHp,hero.hp+85);}else hero.attackSpeed*=1.15;
 hero.hp=Math.min(hero.maxHp,hero.hp+25);game.level++;record('upgrade',{choice});wave();
}
function ending(win){game.phase=win?'victory':'defeat';game.resetSeconds=3.2;notify('RESETTING');record(win?'victory':'defeat');if(win)play(hero,'Cheer');}
`;
let simulation=between('function simulate(dt){','function project(');
simulation=change(simulation,"function simulate(dt){","function simulate(dt){\n if((game.phase==='victory'||game.phase==='defeat')&&(game.resetSeconds-=dt)<=0)start();");
simulation=change(simulation,"game.upgradeTime=6;show('upgrade');","game.upgradeTime=3.2;");
simulation=change(simulation,"game.upgradeTime-=dt;$('upgrade-countdown').textContent=`${Math.max(0,Math.ceil(game.upgradeTime))}秒後に自動選択`;","game.upgradeTime-=dt;");
simulation=simulation.split('\n').filter(line=>!line.includes("$('wave-banner')")&&!line.includes("$('toast')")).join('\n');
simulation=change(simulation,";if(game.time>10)$('move-hint').style.opacity='0';",';');
let effectsCode=between('function project(','function updateUI(){');
const hudStart=effectsCode.indexOf(" if(game.phase!=='title')for(const a of actors){"),hudEnd=effectsCode.indexOf(' const mist=',hudStart);
assert.ok(hudStart>0&&hudEnd>hudStart);effectsCode=effectsCode.slice(0,hudStart)+effectsCode.slice(hudEnd);
effectsCode=effectsCode.split('\n').filter(line=>!line.includes('if(hero&&!hero.dead){groundPath(hero.pos,.85)')).join('\n');
const cameraCode=between('function renderCamera(dt){','function loop(now){');
const lifecycle=`
function fail(error){game.ready=false;game.phase='error';renderer?.setAnimationLoop(null);sound.pause();record('error',{message:String(error?.message||error)});notify('ERROR',String(error?.message||error));}
function draw(){renderCamera(1/60);renderer.info.autoReset=false;renderer.info.reset();if(game.high)composer.render();else renderer.render(scene,camera);drawEffects();if(actors.some(a=>a.dead&&a.deathTime>0&&a.deathTime<1.3))renderedDeaths++;}
function frame(now){
 if(disposed||!game.ready)return;
 const elapsed=previous?(now-previous)/1000:1/60;previous=now;if(document.hidden)return;
 const realDt=Math.max(0,Math.min(.05,elapsed));clock+=realDt;let dt=realDt;
 if(game.hitstop>0){game.hitstop=Math.max(0,game.hitstop-realDt);dt*=.12;}
 try{simulate(dt);draw();frameCount++;frameTime+=elapsed;if(frameTime>.5){fps=Math.round(frameCount/frameTime);frameCount=0;frameTime=0;}}catch(error){fail(error);}
}
async function prepare(){
 makeRenderer();notify('ASSET_LOADING');
 const loaded=await loadNocturneAssets({loader:new GLTFLoader(),signal,onProgress:(completed,total)=>notify('ASSET_LOADING',completed+'/'+total)});
 if(disposed||signal.aborted)return;
 models=loaded.models;loadedBytes=loaded.byteLength;for(const key of models.keys())usedModels.add(key);
 for(const [key,gltf] of models){gltf.scene.updateMatrixWorld(true);gltf.scene.traverse(o=>{if(o.isMesh){o.userData.assetSource=key;o.castShadow=true;o.receiveShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m?.map)m.map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());}});}
 buildNocturneEnvironment({THREE,V,TAU,models,scene,environmentMeshes,torches,rand,randRange});
 game.ready=true;start();renderCamera(0);await withTimeout(renderer.compileAsync(scene,camera),20000,'Shader preparation timed out');
 if(disposed||signal.aborted)return;
 notify('READY');draw();notify('BATTLE');previous=performance.now();renderer.setAnimationLoop(frame);record('ready',{models:usedModels.size});
}
function metrics(){return {ready:game.ready,phase:game.phase,rounds,totalKills:allKills,kills:game.kills,damage:game.damage,received:game.received,wave:game.wave,time:game.time,hp:hero?.hp,models:usedModels.size,loadedBytes,actors:actors.length,activeAnimations:actors.filter(a=>a.action?.isRunning()).length,renderedDeaths,frames:renderer?.info.render.frame||0,drawCalls:renderer?.info.render.calls||0,triangles:renderer?.info.render.triangles||0,fps,audio:sound.metrics(),webgl2:!!renderer?.getContext().texStorage2D};}
function inspectActors(){return actors.map(a=>({kind:a.kind,hp:a.hp,dead:a.dead,deathTime:a.deathTime,position:a.pos.toArray(),animation:a.actionName,animationTime:a.action?.time||0,attack:a.attack?.time||0}));}
function advance(seconds){if(!game.ready||disposed||!Number.isFinite(seconds)||seconds<=0||seconds>30)throw Error('Invalid evidence advancement');for(let i=0;i<Math.ceil(seconds*60);i++){simulate(1/60);clock+=1/60;}draw();return metrics();}
function destroy(){
 if(disposed)return;disposed=true;game.ready=false;renderer?.setAnimationLoop(null);
 for(const a of actors)removeActor(a);actors=[];
 const geometries=new Set(),materials=new Set(),textures=new Set();
 const gather=root=>root?.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}});
 gather(scene);for(const gltf of models.values())gather(gltf.scene);for(const r of [...textures,...materials,...geometries])r.dispose();
 for(const p of composer?.passes||[])p.dispose?.();composer?.dispose();renderer?.dispose();models.clear();
}
return Object.freeze({prepare,resize,metrics,inspectActors,advance,destroy,fail,trace});
`;
const runtime=imports+"import {loadNocturneAssets,withTimeout} from './assets.js';\nimport {buildNocturneEnvironment} from './environment.js';\n\nexport function createBattleRuntime({world,effects,stage,sound,notify,signal}){\nconst V=THREE.Vector3,TAU=Math.PI*2;let disposed=false,rounds=0,allKills=0,renderedDeaths=0;\n"+head+change(rendererCode,"canvas:$('world')",'canvas:world')+'\n'+actors+'\n'+combat+'\n'+rules+'\n'+simulation+'\n'+effectsCode+'\n'+cameraCode+'\n'+lifecycle+'\n}\n';
assert.ok(!runtime.includes('$('),'UI DOM leaked into native runtime');
assert.ok(!runtime.includes('nocturne-autobattle.c-okamoto.workers.dev'),'Legacy origin leaked');
assert.ok(!runtime.includes('setTimeout(()=>{if(game.ready)start()'),'Unowned reset timer leaked');
assert.ok(!runtime.includes('ctx.fillText(')&&!runtime.includes('ctx.strokeText('),'Canvas HUD leaked');
writeFileSync(dir+'/runtime.js',runtime);
writeFileSync(dir+'/source-receipt.json',JSON.stringify({sourceCommit:base,sourcePath:'apps/review/src/nocturne-stage.js',sourceGitBlob:digest,migration:'headless-nocturne-library-v1',preserved:['forest geometry and placement','actor rigs and clips','attack and death timing','combat rules and hit effects','camera and lighting'],changes:['shared library assets','no HUD or input controls','owned restart lifecycle','audio gesture and visibility lifecycle','observable startup and errors']},null,2)+'\n');
const mainPath='apps/review/src/main.js';writeFileSync(mainPath,readFileSync(mainPath,'utf8').replace("new URL('./battle2.html',location.href)","new URL('./battle2',location.href)"));
// Both dependencies already exist in this workspace lock; only declare the app's closure.
const pkgPath='apps/review/package.json',pkg=JSON.parse(readFileSync(pkgPath,'utf8'));
pkg.dependencies['@soul/assets']='*';pkg.dependencies.three='0.186.0';writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+'\n');
const lockPath='package-lock.json',lock=JSON.parse(readFileSync(lockPath,'utf8'));assert.equal(lock.packages['node_modules/three'].version,'0.186.0');lock.packages['apps/review'].dependencies=pkg.dependencies;writeFileSync(lockPath,JSON.stringify(lock,null,2)+'\n');
for(const file of ['runtime.js','environment.js'])execFileSync(process.execPath,['--check',dir+'/'+file],{stdio:'inherit'});
console.log('Generated native NOCTURNE modules from pinned Git blob',digest);
