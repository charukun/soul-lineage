import * as THREE from 'three';
export class Actors {
  constructor(scene,assets){this.scene=scene;this.assets=assets;this.items=new Map();this.animationClips=new Set();}
  add(unit){
    if(this.items.has(unit.id))return this.items.get(unit.id);
    const key='pirate/'+unit.model,root=this.assets.instance(key),box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3());
    const holder=new THREE.Group();holder.name=unit.kind;root.position.y=-box.min.y;holder.add(root);const scale=unit.height/size.y;holder.scale.setScalar(scale);holder.position.set(unit.x,0,unit.z);this.scene.add(holder);
    const materials=[];root.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.roughness=.68;materials.push(o.material);}});
    const mixer=new THREE.AnimationMixer(root),clips=this.assets.models.get(key).animations,actions={};
    for(const clip of clips){actions[clip.name]=mixer.clipAction(clip);this.animationClips.add(clip.name);}
    const item={unit,root,holder,mixer,actions,materials,current:null,phase:0,scale};this.items.set(unit.id,item);this.play(item,unit.kind==='tentacle'?'Tentacle_Idle':'Idle');mixer.update(.13+(unit.id%5)*.07);return item;
  }
  play(item,name){
    if(item.current===name)return;
    const action=item.actions[name]||item.actions.Idle||item.actions.Tentacle_Idle||Object.values(item.actions)[0];if(!action)return;
    const old=item.current&&item.actions[item.current];
    const oneShot=/Sword|Punch|Death|Attack/.test(name);action.reset().setLoop(oneShot?THREE.LoopOnce:THREE.LoopRepeat,oneShot?1:Infinity);action.clampWhenFinished=oneShot;action.timeScale=/Sword|Punch/.test(name)?1.45:1;action.fadeIn(.1).play();if(old&&old!==action)old.fadeOut(.1);item.current=name;
  }
  update(units,dt){
    const ids=new Set(units.map(u=>u.id));
    for(const [id,item] of this.items){if(!ids.has(id)){this.remove(id);continue;}}
    for(const u of units){
      const item=this.items.get(u.id)||this.add(u);this.play(item,u.action);
      item.holder.position.x=u.x;item.holder.position.z=u.z;
      const delta=Math.atan2(Math.sin(u.angle-item.holder.rotation.y),Math.cos(u.angle-item.holder.rotation.y));item.holder.rotation.y+=delta*Math.min(1,dt*15);
      item.holder.visible=!u.dead||u.deathTime<2.5;
      item.holder.position.y=u.dead?-Math.max(0,u.deathTime-1)*.55:0;
      for(const mat of item.materials){mat.emissive.set(u.team==='hero'?'#b7a574':'#ffab8f');mat.emissiveIntensity=u.hit>0?.48:0;}
      item.mixer.update(dt);
    }
  }
  remove(id){const item=this.items.get(id);if(!item)return;this.scene.remove(item.holder);item.mixer.stopAllAction();item.mixer.uncacheRoot(item.root);for(const m of item.materials)m.dispose();this.items.delete(id);}
  clear(){for(const id of [...this.items.keys()])this.remove(id);}
}
