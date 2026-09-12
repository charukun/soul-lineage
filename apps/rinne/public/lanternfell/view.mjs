import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {MODELS,TEXTURES,UI_FILES,CLASS_MODEL,assetURL,sourceURL} from './assets.mjs';
import {NPCS,CLOAK_COLORS,FURNITURE} from './game.mjs';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const timeout=(promise,label)=>Promise.race([promise,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('素材の読み込みがタイムアウトしました: '+label)),90000);promise.finally(()=>clearTimeout(timer)).catch(()=>{});})]);
export class Renderer{
 constructor(canvas){
  this.canvas=canvas;this.gpu=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});this.gpu.outputColorSpace=T.SRGBColorSpace;this.gpu.toneMapping=T.ACESFilmicToneMapping;this.gpu.toneMappingExposure=1.05;this.gpu.shadowMap.enabled=true;this.gpu.shadowMap.type=T.PCFSoftShadowMap;
  this.world=new T.Scene();this.world.background=new T.Color('#bdd4d0');this.world.fog=new T.Fog('#bdd4d0',36,85);this.camera=new T.PerspectiveCamera(43,1,.1,160);this.environment=new T.Group();this.dynamic=new T.Group();this.actorLayer=new T.Group();this.effectLayer=new T.Group();this.world.add(this.environment,this.dynamic,this.actorLayer,this.effectLayer);
  this.world.add(new T.HemisphereLight('#d0e3ed','#666849',2.1));this.sun=new T.DirectionalLight('#ffe6bd',2.2);this.sun.position.set(-14,32,18);this.sun.castShadow=true;this.sun.shadow.mapSize.set(1024,1024);Object.assign(this.sun.shadow.camera,{left:-33,right:33,top:33,bottom:-33,near:1,far:90});this.sun.shadow.bias=-.0004;this.sun.shadow.normalBias=.06;this.world.add(this.sun);
  this.localLights=[new T.PointLight('#ffb86a',30,12,2),new T.PointLight('#ffcf88',20,9,2)];this.localLights.forEach(l=>this.world.add(l));
  T.Cache.enabled=true;this.loader=new GLTFLoader();this.models=new Map();this.textures=new Map();this.tints=new Map();this.actors=new Map();this.fx=new Map();this.resources=new Map();this.farms=[];this.furniture=new T.Group();this.dynamic.add(this.furniture);this.sceneKey='';this.furnitureKey='';this.actorKey='';this.focus=V(0,1,3);this.yaw=.25;this.pitch=.80;this.distance=18;this.time=0;this.renderCount=0;this.loadedAssets=[];this.error=null;this.ready=false;this.lastSize='';this.ray=new T.Raycaster();this.groundPlane=new T.Plane(V(0,1,0),0);this.ghost=null;
 }
 async init(progress=()=>{}){
  const tasks=[...Object.entries(MODELS).map(([id,spec])=>({id,type:'model',url:assetURL(spec)})),...Object.entries(TEXTURES).map(([id,spec])=>({id,type:'texture',url:assetURL(spec)})),...UI_FILES.map(name=>({id:name,type:'ui',url:sourceURL('uiIcons',name)}))];let done=0,next=0;
  const work=async()=>{while(next<tasks.length){const task=tasks[next++];try{if(task.type==='model'){const model=await timeout(this.loader.loadAsync(task.url),task.id);if(!model.scene)throw new Error('glTF scene missing');model.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.userData.source=task.url;o.geometry.userData.source=task.url;}});this.models.set(task.id,model);}else if(task.type==='texture'){const tx=await timeout(new T.TextureLoader().loadAsync(task.url),task.id);tx.colorSpace=T.SRGBColorSpace;this.textures.set(task.id,tx);}else{await timeout(new Promise((resolve,reject)=>{const image=new Image();image.onload=resolve;image.onerror=()=>reject(new Error('UI画像の読み込み失敗'));image.src=task.url;}),task.id);}this.loadedAssets.push({id:task.id,type:task.type,url:task.url});progress(++done,tasks.length,task.id);}catch(e){this.error=new Error(`${task.id}: ${e.message}\n${task.url}`);throw this.error;}}};
  await Promise.all(Array.from({length:5},work));this.ready=true;return this;
 }
 material(source,tint){if(!tint)return source;const key=source.uuid+':'+tint;if(!this.tints.has(key)){const mat=source.clone();mat.color.multiply(new T.Color(tint));this.tints.set(key,mat);}return this.tints.get(key);}
 prop(id,x,z,{width,height,depth,y=0,rot=0,tint,top=false,parent=this.environment}={}){
  const source=this.models.get(id);if(!source)throw new Error('未取得のモデル: '+id);const item=source.scene.clone(true);item.updateMatrixWorld(true);const box=new T.Box3().setFromObject(item),size=box.getSize(V()),center=box.getCenter(V());
  const uniform=height?height/Math.max(size.y,.001):width?width/Math.max(size.x,.001):1;item.scale.multiplyScalar(uniform);if(depth)item.scale.z*=depth/(size.z*uniform);if(width&&height)item.scale.x*=width/(size.x*uniform);item.position.set(-center.x*item.scale.x,-(top?box.max.y:box.min.y)*item.scale.y,-center.z*item.scale.z);
  if(id==='grass'&&!tint)tint='#9ccb8c';item.traverse(o=>{if(o.isMesh){if(Array.isArray(o.material))o.material=o.material.map(m=>this.material(m,tint));else o.material=this.material(o.material,tint);}});
  const root=new T.Group();root.userData.source=assetURL(MODELS[id]);root.userData.asset=id;root.add(item);root.position.set(x,y,z);root.rotation.y=rot;parent.add(root);return root;
 }
 // Reuse imported geometry and its authored UV atlas for every GPU instance.
 instanceEnvironment(){this.environment.updateMatrixWorld(true);const buckets=new Map();this.environment.traverse(o=>{if(!o.isMesh||o.isSkinnedMesh)return;const material=Array.isArray(o.material)?o.material.map(m=>m.uuid).join(','):o.material.uuid;const key=o.geometry.uuid+material;if(!buckets.has(key))buckets.set(key,{geometry:o.geometry,material:o.material,source:o.userData.source,matrices:[]});buckets.get(key).matrices.push(o.matrixWorld.clone());});this.environment.clear();for(const b of buckets.values()){const mesh=new T.InstancedMesh(b.geometry,b.material,b.matrices.length);b.matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.source=b.source;mesh.computeBoundingSphere();this.environment.add(mesh);}}
 actor(id,key,height=2.4,tint){
  const source=this.models.get(id);if(!source?.animations.length)throw new Error('人物または既存モーションがありません: '+id);
  const model=cloneSkeleton(source.scene);model.updateMatrixWorld(true);const box=new T.Box3().setFromObject(model),size=box.getSize(V());const scale=height/Math.max(size.y,.1);model.scale.setScalar(scale);model.position.y=-box.min.y*scale;const group=new T.Group();group.add(model);this.actorLayer.add(group);
  model.traverse(o=>{o.userData.source=assetURL(MODELS[id]);if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(tint&&/body|cape|robe|hat/i.test(o.name))o.material=Array.isArray(o.material)?o.material.map(m=>this.material(m,tint)):this.material(o.material,tint);}});
  // The actual GLTFLoader node names and all alternative meshes are recorded in QA.
  const selected={knight:['1H_Sword','Round_Shield'],rogue:['2H_Crossbow'],mage:['1H_Wand','Spellbook_open'],barbarian:['2H_Axe']}[id]||[];
  const desired=key==='npc:mina'?['Spellbook_open']:key==='npc:gardener'?[]:key==='npc:smith'?['1H_Axe']:selected;
  const equipment=[];model.traverse(o=>{if(o.isMesh&&/^handslot[lr]$/.test(o.parent?.name||'')){o.visible=desired.includes(o.name);if(o.visible)equipment.push({object:o,kind:/shield/i.test(o.name)?'armor':'weapon'});}});
  if(id==='skeleton'||id==='skeletonMage'){
   const donor=id==='skeleton'?'knight':'mage',name=id==='skeleton'?'1H_Sword':'1H_Wand',hand=model.getObjectByName('handslotr');
   const original=this.models.get(donor).scene.getObjectByName(name);if(!hand||!original)throw new Error('既存武器の接続点がありません: '+id);
   const weapon=original.clone(true);weapon.userData.source=assetURL(MODELS[donor]);hand.add(weapon);equipment.push({object:weapon,kind:'weapon'});
  }
  const mixer=new T.AnimationMixer(model),actions=new Map(source.animations.map(clip=>[clip.name,mixer.clipAction(clip)]));const a={key,id,group,model,mixer,actions,equipment,state:'',lastAttack:0,lastWindup:0,previous:V(),dead:false};this.actors.set(key,a);this.animate(a,'Idle');return a;
 }
 animate(a,name,once=false,restart=false,duration){
  const next=a.actions.get(name);if(!next)throw new Error('既存モーションが見つかりません: '+a.id+' / '+name);
  if(a.state===name&&!restart)return;const previous=a.actions.get(a.state);next.reset().setEffectiveWeight(1).setEffectiveTimeScale(duration?next.getClip().duration/duration:1);next.setLoop(once?T.LoopOnce:T.LoopRepeat,once?1:Infinity);next.clampWhenFinished=once;next.play();if(previous&&previous!==next)next.crossFadeFrom(previous,.14,false);a.state=name;
 }
 discardActor(key){const a=this.actors.get(key);if(a){a.mixer.stopAllAction();a.mixer.uncacheRoot(a.model);this.actorLayer.remove(a.group);this.actors.delete(key);}}
 buildScene(game){
  this.sceneKey=game.scene;this.environment.clear();this.dynamic.clear();this.furniture=new T.Group();this.dynamic.add(this.furniture);this.resources.clear();this.farms=[];this.furnitureKey='';this.ghost=null;for(const key of [...this.actors.keys()])if(key!=='player')this.discardActor(key);
  this.localLights.forEach(l=>{l.visible=false;});const s=game.scene;
  if(s==='home'){
   for(let x=-3.75;x<5;x+=2.5)for(let z=-2.5;z<4;z+=2.5)this.prop('woodFloor',x,z,{width:2.52,depth:2.52,top:true});
   for(let x=-4;x<=4;x+=2)this.prop('wall',x,-4,{width:2,height:2.5});for(let z=-2;z<=2;z+=2)this.prop('wall',-5,z,{width:2,height:1.4,rot:Math.PI/2});
   this.prop('lantern',-4,-3,{height:1.7});this.prop('chest',4,-3,{height:.65});this.localLights[0].position.set(-3,2,-2);this.localLights[0].visible=true;
  }else if(s==='ruins'){
   for(let x=-18;x<=18;x+=4)for(let z=-18;z<=18;z+=4)this.prop('stone',x,z,{width:4.03,depth:4.03,top:true,tint:'#b0bcc5'});
   for(let i=-4;i<=4;i++){this.prop('wall',i*4,-20,{width:4,height:3});this.prop('wall',-20,i*4,{width:4,height:3,rot:Math.PI/2});this.prop('wall',20,i*4,{width:4,height:3,rot:Math.PI/2});}
   for(const x of [-12,12])for(const z of [-12,-2,8]){this.prop('pillar',x,z,{height:4});this.prop('lantern',x+.8,z,{height:2});}this.prop('arch',0,-15,{width:9,height:6});this.prop('chest',0,-18,{height:1.2});this.localLights[0].position.set(-10,3,0);this.localLights[1].position.set(10,3,-10);this.localLights.forEach(l=>{l.visible=true;});
  }else{
   // The source tile points along Z: width 2, depth 2.3094, top Y=0.
   for(let r=-7;r<=7;r++)for(let q=-7;q<=7;q++){const x=q*6+(Math.abs(r)%2)*3,z=r*5.196152;if(Math.hypot(x,z)<39)this.prop('grass',x,z,{width:6.015,top:true});}
   for(let i=0;i<40;i++){const angle=i*2.399963,r=31+(i%4)*2;this.prop(i%3?'tree':'pine',Math.sin(angle)*r,Math.cos(angle)*r,{height:4+i%5,rot:angle});}
   for(let i=0;i<8;i++){const a=i*Math.PI/4;this.prop(i%2?'hill':'mountain',Math.sin(a)*49,Math.cos(a)*49,{width:22,height:8+i%3*2,rot:a});}
   if(s==='town'){
    for(let z=-24;z<=24;z+=4)this.prop('stone',0,z,{width:4.05,depth:4.05,top:true,y:.045});for(let x=-12;x<=12;x+=4)this.prop('stone',x,4,{width:4.05,depth:4.05,top:true,y:.05});
    this.prop('tavern',-12,-10,{width:6,depth:5,height:6.3});this.prop('smith',12,-10,{width:6,depth:5,height:5.5});this.prop('house',-12,5,{width:5,depth:5,height:5.4});this.prop('house',12,5,{width:6,depth:5,height:5.5});this.prop('well',0,-4,{width:5,height:4});
    this.prop('crates',9,-7,{height:1.3});this.prop('barrel',15,-6.5,{height:1.2});this.prop('table',-8,8,{height:1});this.prop('chair',-8,10,{height:1});
    for(const [x,z]of [[-5,-20],[5,-20],[-5,6],[5,6]])this.prop('lantern',x,z,{height:2.3});
    for(const [i,n]of NPCS.entries()){const a=this.actor(['mage','barbarian','rogue','knight'][i],'npc:'+n.id,2.35,['#d8b990','#ce9a76','#bdcc8e','#abbcc4'][i]);a.group.position.set(n.x,0,n.z);a.group.rotation.y=.3+i*.65;}
    for(let i=0;i<4;i++){const x=8+(i%2)*2.2,z=15+Math.floor(i/2)*2.2;this.prop('dirt',x,z,{width:1.9,depth:1.9,top:true,y:.06});const crop=this.prop('grain',x,z,{width:1.6,height:1,parent:this.dynamic});this.farms.push(crop);}
    for(let z=13;z<=20;z+=2)this.prop('fence',14,z,{width:2,height:.9,rot:Math.PI/2});this.localLights[0].position.set(1,3,-4);this.localLights[0].visible=true;
   }else{
    for(let r=-5;r<=5;r++)this.prop('river',24,r*5.196152,{width:6,top:true,y:.055});this.prop('bridge',21,0,{width:5,height:.75,rot:Math.PI/2});
    for(const r of game.resources){let object;if(r.type==='herb')object=this.prop('plant',r.x,r.z,{height:.75,width:.85,parent:this.dynamic});else if(r.type==='ore')object=this.prop('rock',r.x,r.z,{height:1.3,width:1.6,tint:'#b1bbd9',parent:this.dynamic});else object=this.prop('tree',r.x,r.z,{height:4,parent:this.dynamic});this.resources.set(r.id,object);}
    for(let i=0;i<12;i++){const a=i*2.4;this.prop('rock',Math.sin(a)*27,Math.cos(a)*27,{height:.8+i%3*.4,rot:a});}this.prop('arch',0,-24,{width:7,height:5});
   }
  }
  this.decorateScene?.(game);this.instanceEnvironment();this.focus.set(game.player.x,1,game.player.z);this.refreshFurniture(game);
 }
 furnitureObject(type,x,z,rot,parent){
  const dim=FURNITURE[type]?.size||[1,1];if(type==='rug'){const g=this.prop('cloth',x,z,{width:dim[0],height:dim[1],parent});g.children[0].rotation.x=-Math.PI/2;g.position.y=.035;g.rotation.y=rot*Math.PI/2;return g;}
  if(type==='planter'){const g=this.prop('barrel',x,z,{width:.65,height:.5,parent});this.prop('plant',0,0,{width:.7,height:.75,y:.3,parent:g});g.rotation.y=rot*Math.PI/2;return g;}
  const h={bed:.32,table:.85,chair:1.1,lantern:1.4,shelf:2}[type];return this.prop(type,x,z,{width:dim[0],depth:dim[1],height:h,rot:rot*Math.PI/2,parent});
 }
 refreshFurniture(game){const key=JSON.stringify(game.save.furniture);if(this.furnitureKey===key)return;this.furnitureKey=key;this.furniture.clear();if(game.scene==='home')for(const f of game.save.furniture)this.furnitureObject(f.type,f.x,f.z,f.rot,this.furniture);}
 updateGhost(build){const key=build?.type||'';if(!build){if(this.ghost)this.dynamic.remove(this.ghost);this.ghost=null;return;}if(!this.ghost||this.ghost.userData.type!==key){if(this.ghost){this.ghost.traverse(o=>{if(o.isMesh){const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose());}});this.dynamic.remove(this.ghost);}this.ghost=this.furnitureObject(build.type,build.x,build.z,build.rot,this.dynamic);this.ghost.userData.type=key;this.ghost.traverse(o=>{if(o.isMesh){const ghost=m=>{const n=m.clone();n.transparent=true;n.opacity=.55;n.depthWrite=false;return n;};o.material=Array.isArray(o.material)?o.material.map(ghost):ghost(o.material);}});}this.ghost.position.x=build.x;this.ghost.position.z=build.z;this.ghost.rotation.y=build.rot*Math.PI/2;}
 syncActors(game,dt,mode,creation){
  const config=mode==='create'?creation:{classId:game.save.classId,appearance:game.save.appearance};const id=CLASS_MODEL[config.classId]||'knight',look=config.appearance||{},key=id+':'+look.cloak+':'+look.body;let a=this.actors.get('player');if(this.actorKey!==key||!a){this.discardActor('player');a=this.actor(id,'player',2.45*(.9+(look.body??1)*.1),CLOAK_COLORS[look.cloak??0]);this.actorKey=key;}
  for(const e of a.equipment)e.object.visible=mode==='create'||game.save.equipped[e.kind]!==false;
  const p=game.player;a.group.position.set(p.x,0,p.z);a.group.rotation.y=mode==='create'?this.time*.22:p.rot;const attackClip=id==='mage'?'Spellcast_Shoot':id==='rogue'?'2H_Ranged_Shoot':id==='barbarian'?'2H_Melee_Attack_Chop':'1H_Melee_Attack_Slice_Diagonal';
  if(game.downed)this.animate(a,'Death_A',true);else if(p.attack>0&&mode==='play')this.animate(a,attackClip,true,p.attack>a.lastAttack+.01,.70);else if(game.fishing)this.animate(a,'Interact');else this.animate(a,game.moving&&mode==='play'?'Running_A':'Idle');a.lastAttack=p.attack;
  const active=new Set(game.enemies.map(e=>'enemy:'+e.id));for(const key of [...this.actors.keys()])if(key.startsWith('enemy:')&&!active.has(key))this.discardActor(key);
  for(const e of game.enemies){const key='enemy:'+e.id;let enemy=this.actors.get(key);if(!enemy)enemy=this.actor(e.type==='boss'||e.type==='moth'?'skeletonMage':'skeleton',key,e.type==='boss'?4.2:2.3,e.type==='boss'?'#b4bdde':undefined);const moved=Math.hypot(enemy.group.position.x-e.x,enemy.group.position.z-e.z)>.001;enemy.group.position.set(e.x,0,e.z);enemy.group.rotation.y=e.rot;enemy.group.visible=e.hp>0||e.dead<3.2;
   if(e.hp<=0)this.animate(enemy,'Death_A',true);else if(e.windup>0)this.animate(enemy,enemy.id==='skeletonMage'?'Spellcast_Shoot':'1H_Melee_Attack_Chop',true,e.windup>enemy.lastWindup+.01,e.type==='boss'?1.25:.7);else if(e.stun>0)this.animate(enemy,'Hit_A',true);else this.animate(enemy,moved?'Walking_A':'Idle');enemy.lastWindup=e.windup;
  }
  for(const actor of this.actors.values())actor.mixer.update(game.hitstop>0?0:dt);
 }
 syncEffects(game){
  const keep=new Set(game.effects);for(const [e,sprite]of this.fx)if(!keep.has(e)){this.effectLayer.remove(sprite);sprite.material.dispose();this.fx.delete(e);}
  for(const e of game.effects){if(e.type==='damage')continue;let sprite=this.fx.get(e);const heal=e.type==='heal',warn=e.type==='warning'||e.type==='enemyHit';if(!sprite){const id=e.type==='slash'?'slash':e.type==='hit'||e.type==='enemyHit'?'spark':e.type==='warning'?'circle':e.type==='burst'?'smoke':e.type==='gather'?'star':'magic';sprite=new T.Sprite(new T.SpriteMaterial({map:this.textures.get(id),color:heal?'#beffc4':warn?'#ff715b':game.job.color,transparent:true,opacity:1,depthWrite:false,blending:T.AdditiveBlending}));sprite.userData.source=assetURL(TEXTURES[id]);this.effectLayer.add(sprite);this.fx.set(e,sprite);}
   const t=clamp(e.age/e.life,0,1);let x=e.x,y=e.y+.8,z=e.z;if(e.type==='projectile'){const target=game.enemies.find(v=>v.id===e.to);if(target){x=T.MathUtils.lerp(e.x,target.x,t);z=T.MathUtils.lerp(e.z,target.z,t);y=1.4+Math.sin(t*Math.PI)*.4;}}
   sprite.position.set(x,y,z);let size=e.scale*(e.type==='projectile'?.6:.5+t*1.1);if(e.type==='storm')size*=1.2;sprite.scale.set(size,size,1);sprite.material.opacity=(1-t)*.85;sprite.material.rotation=(e.rot||0)+(e.type==='slash'?t*1.2:0);
  }
 }
 orbit(dx,dy){this.yaw-=dx*.007;this.pitch=clamp(this.pitch+dy*.004,.45,1.15);}
 zoomBy(amount){this.distance=clamp(this.distance+amount,9,31);}
 screen(x,y,z){const v=V(x,y,z).project(this.camera);return{x:(v.x*.5+.5)*this.canvas.clientWidth,y:(-.5*v.y+.5)*this.canvas.clientHeight,visible:v.z>-1&&v.z<1&&Math.abs(v.x)<1.1&&Math.abs(v.y)<1.1};}
 pick(x,y){const r=this.canvas.getBoundingClientRect();this.ray.setFromCamera(new T.Vector2((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1),this.camera);return this.ray.ray.intersectPlane(this.groundPlane,V())||V();}
 render(game,dt,mode='play',creation={},build=null){if(!this.ready)return;this.time+=dt;const w=this.canvas.clientWidth,h=this.canvas.clientHeight,quality=game.save.settings.quality,ratio=Math.min(devicePixelRatio||1,quality==='low'?1:1.5),sizeKey=`${w},${h},${ratio}`;if(this.lastSize!==sizeKey){this.lastSize=sizeKey;this.gpu.setPixelRatio(ratio);this.gpu.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
  if(this.sceneKey!==game.scene)this.buildScene(game);this.refreshFurniture(game);for(const r of game.resources){const o=this.resources.get(r.id);if(o){o.visible=r.type==='wood'||r.ready<=0;o.children[0].visible=r.ready<=0||r.type==='wood';}}
  this.farms.forEach((o,i)=>{const at=game.save.farm[i];o.visible=at!==null;if(o.visible){const k=.3+.7*clamp((game.save.playTime-at)/30,0,1);o.scale.setScalar(k);}});this.syncActors(game,dt,mode,creation);this.updateGhost(build);this.syncEffects(game);
  const target=this.frameTarget?.(game,mode,build)||V(game.player.x,1,game.player.z);let yaw=this.yaw,pitch=this.pitch,distance=game.scene==='home'?12:this.distance;
  if(w<h)distance=game.scene==='home'?28:this.distance*1.26;
  if(build)target.set(0,.3,0);
  if(mode==='title'){target.set(0,1,0);yaw=.4+Math.sin(this.time*.05)*.16;distance=30;pitch=.67;}if(mode==='create'){target.y=1.3;yaw=.28;pitch=.34;distance=7.5;}
  this.focus.lerp(target,1-Math.exp(-dt*7));if((mode==='create'||build)&&w<h)this.camera.setViewOffset(w,h,0,h*(build?.16:.21),w,h);else this.camera.clearViewOffset();this.camera.position.copy(this.focus).add(V(Math.sin(yaw)*Math.cos(pitch)*distance,Math.sin(pitch)*distance,Math.cos(yaw)*Math.cos(pitch)*distance));this.camera.lookAt(this.focus);this.camera.updateMatrixWorld();
  if(this.updateLighting)this.updateLighting(game,dt);else{const dark=game.scene==='ruins';this.world.background.set(dark?'#394c61':'#bdd4d0');this.world.fog.color.copy(this.world.background);}if(this.drawFrame)this.drawFrame(dt);else this.gpu.render(this.world,this.camera);this.renderCount++;
 }
 get metrics(){return{frames:this.renderCount,drawCalls:this.gpu.info.render.calls,triangles:this.gpu.info.render.triangles,models:this.models.size,assets:this.loadedAssets.length,actors:[...this.actors.values()].map(a=>({id:a.id,key:a.key,clip:a.state,time:a.mixer.time,equipment:a.equipment.filter(e=>e.object.visible).map(e=>e.object.name)}))};}
}
