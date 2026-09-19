function actor(kind,position,boss=false){
 const key=kind==='hero'?'adventurers/Knight':kind==='mage'?'skeletons/Skeleton_Mage':kind==='minion'?'skeletons/Skeleton_Minion':'skeletons/Skeleton_Warrior';
 const asset=models.get(key),root=cloneSkeleton(asset.scene),container=new THREE.Group();
 if(kind==='hero')for(const name of ['1H_Sword_Offhand','Rectangle_Shield','Round_Shield','Spike_Shield','2H_Sword']){const o=root.getObjectByName(name);if(o)o.visible=false;}
 if(kind!=='hero'&&kind!=='mage'){
  const sword=models.get('adventurers/Knight').scene.getObjectByName(boss?'2H_Sword':'1H_Sword');
  const socket=root.getObjectByName('handslotr')||root.getObjectByName('handslot.r');
  if(sword&&socket){const weapon=sword.clone(true);weapon.visible=true;weapon.traverse(o=>{if(o.isMesh)o.userData.assetSource='adventurers/Knight';});socket.add(weapon);}
 }
 const box=new THREE.Box3().setFromObject(root),height=kind==='hero'?2.95:boss?4.25:kind==='mage'?2.55:2.45;
 const scale=height/Math.max(.1,box.max.y-box.min.y);container.scale.setScalar(scale);container.add(root);container.position.copy(position);scene.add(container);
 const mats=[];
 root.traverse(o=>{if(o.isMesh){
  o.castShadow=true;o.receiveShadow=true;o.userData.assetSource=o.userData.assetSource||key;o.frustumCulled=false;
  const list=Array.isArray(o.material)?o.material:[o.material];
  const next=list.map(m=>{const n=m.clone();n.roughness=.74;n.metalness=.08;n.emissive=new THREE.Color('#000000');if(/Eyes/.test(o.name)){n.emissive.set(kind==='mage'?'#b870f1':'#c97450');n.emissiveIntensity=1.2;}mats.push({mat:n,base:n.emissive.clone(),power:n.emissiveIntensity});return n;});
  o.material=Array.isArray(o.material)?next:next[0];
 }});
 const a={kind,boss,root,object:container,pos:container.position,height,hp:kind==='hero'?220:boss?620:38+game.wave*8,maxHp:kind==='hero'?220:boss?620:38+game.wave*8,mixer:new THREE.AnimationMixer(root),clips:new Map(asset.animations.map(c=>[c.name,c])),action:null,actionName:'',attack:null,cd:randRange(.4,1.3),dead:false,deathTime:0,flash:0,showHp:0,mats,damage:kind==='hero'?27:boss?18:kind==='mage'?10:7,speed:kind==='hero'?2.7:boss?1.2:kind==='mage'?1.1:1.55,attackSpeed:1,combo:0,spawn:kind==='hero'?0:.7,trail:[]};
 actors.push(a);play(a,'Idle');if(kind!=='hero'){ring(a.pos,1.1,'#bf7dcb',.6);play(a,'Spawn_Ground_Skeletons',true,.8);}return a;
}
function play(a,name,once=false,duration=0){
 const clip=a.clips.get(name)||a.clips.get('Idle');if(!clip)return;if(a.actionName===name&&!once)return;
 const next=a.mixer.clipAction(clip);next.reset();next.enabled=true;next.setEffectiveWeight(1);next.setEffectiveTimeScale(duration?clip.duration/duration:1);next.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,once?1:Infinity);next.clampWhenFinished=once;
 if(a.action&&a.action!==next)a.action.fadeOut(.13);next.fadeIn(.12).play();a.action=next;a.actionName=name;
}
function removeActor(a){a.mixer.stopAllAction();a.mixer.uncacheRoot(a.root);scene.remove(a.object);for(const {mat} of a.mats)mat.dispose();}
function face(a,target,dt){const yaw=Math.atan2(target.x-a.pos.x,target.z-a.pos.z);const delta=Math.atan2(Math.sin(yaw-a.object.rotation.y),Math.cos(yaw-a.object.rotation.y));a.object.rotation.y+=delta*Math.min(1,dt*12);}
function move(a,target,dt,mult=1){
 const d=new V().subVectors(target,a.pos);d.y=0;const distance=d.length();if(distance<.08)return false;face(a,target,dt);d.multiplyScalar(Math.min(distance,a.speed*dt*mult)/distance);a.pos.add(d);const r=Math.hypot(a.pos.x,a.pos.z);if(r>8.75)a.pos.multiplyScalar(8.75/r);play(a,a.kind==='hero'?'Running_A':'Walking_D_Skeletons');return true;
}
