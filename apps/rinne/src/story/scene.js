import {defs,muraBlocked,safeMuraPosition,LIMIT} from '@soul/world/mura';
import {createMuraModels} from '@soul/rendering/mura';
import {createMuraTerrain,flattenMuraModel} from '@soul/rendering/mura/terrain';
import {storyPlaces} from '../game/story-world.js';

/** Reuses the live Tidebreak Three scene and the bundled humanoid renderer. */
export async function createStoryScene(port,doc,initialLayout){
  const view=port.view(),T=view.THREE,root=new T.Group(),village=new T.Group(),field=new T.Group();
  root.name='RinneStoryWorld';root.add(village,field);view.scene.add(root);
  const disposables=[];
  function box(parent,w,h,d,x,y,z,color){const geometry=new T.BoxGeometry(w,h,d),material=new T.MeshStandardMaterial({color,roughness:.95});disposables.push(geometry,material);const m=new T.Mesh(geometry,material);m.position.set(x,y,z);parent.add(m);return m;}
  function label(parent,text,x,y,z){const canvas=doc.createElement('canvas');canvas.width=512;canvas.height=96;const ctx=canvas.getContext('2d');ctx.fillStyle='#112b29dd';ctx.fillRect(0,0,512,96);ctx.font='36px "Noto Sans CJK JP", "Noto Sans JP", sans-serif';ctx.textAlign='center';ctx.fillStyle='#f4e6bc';ctx.fillText(text,256,61);const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;const material=new T.SpriteMaterial({map:texture,depthTest:false});const sprite=new T.Sprite(material);sprite.position.set(x,y,z);sprite.scale.set(1.6,.3,1);sprite.renderOrder=25;parent.add(sprite);disposables.push(texture,material);return sprite;}
  const models=createMuraModels(T,{createCanvas:()=>doc.createElement('canvas')}),cache=new Map(),objects=new T.Group(),land=new T.Group();village.add(land,objects);
  const getProp=kind=>{if(!cache.has(kind))cache.set(kind,flattenMuraModel(T,models.prop(kind,14)));return cache.get(kind);};
  const terrain=createMuraTerrain({THREE:T,scene:root,outside:land,getProp,mat:models.mat,createCanvas:()=>doc.createElement('canvas')});
  let layout=initialLayout,layoutSignature='';
  function updateLayout(next){if(next===layout&&layoutSignature)return;const signature=JSON.stringify(next);if(signature===layoutSignature)return;layoutSignature=signature;layout=next;
    objects.traverse(o=>{if(o.userData.label){o.material.map.dispose();o.material.dispose();}});objects.clear();
    const node=o=>{const key=`${o.kind}:${o.material}:${o.level}`;if(!cache.has(key))cache.set(key,flattenMuraModel(T,defs[o.kind].building?models.building(o.kind,o.material,o.level):models.prop(o.kind)));
      const n=cache.get(key).clone();n.position.set(o.x,.025,o.z);n.rotation.y=o.rot;n.userData.entityId=o.id;n.userData.assetId=o.assetId;
      if(o.phase!=='built')n.visible=false;return n;};
    for(const o of layout.objects){const n=node(o);objects.add(n);if(o.phase==='built'){const l=label(objects,defs[o.kind].label,o.x,6,o.z);l.scale.set(3,.56,1);l.userData.label=true;}
      if(o.room?.length){const room=new T.Group();room.position.set(o.x,.035,o.z);room.rotation.y=o.rot;for(const f of o.room)room.add(node(f));objects.add(room);}
    }
    const shore=storyPlaces(layout).find(p=>p.id==='port'),ship=models.sailingShip();ship.position.set(shore.x+12,.05,shore.z);objects.add(ship);const l=label(objects,'出航・東海岸',shore.x,3,shore.z);l.scale.set(3,.56,1);l.userData.label=true;
  }
  updateLayout(layout);
  box(field,18,.18,13,0,-.03,0,0x847b6e);box(field,2.4,.18,2.4,-5,.08,3,0x82968a);label(field,'帰還船・救護所',-5,1.5,3);
  for(const [x,z] of [[-6,-4],[-2,-4],[5,4],[6,-3]]){const wall=box(field,1.4,1.1,.6,x,.6,z,0x616963);wall.rotation.y=x;}
  const frontLabel=label(field,'前線',0,2.5,-4.5);
  const resident=await port.resident();let state=null,lastZone='',clock=0;
  const motherLabel=label(root,'母',0,2.4,0),rescueLabel=label(root,'倒れた村人',0,.8,0);
  view.background([.35,.46,.47]);
  view.onDraw(()=>{
    if(!state)return;clock+=1/60;const hero=view.hero(),c=view.humanoid();village.visible=state.zone==='village';field.visible=!village.visible;
    if(hero.dead)c.root.visible=true;
    const birth=state.phase==='birth',r=state.rescue,visible=birth||state.zone==='frontier'&&r&&r.status!=='safe';
    for(const p of resident.runtime.current.shadowMeshes)p.visible=!!visible;resident.runtime.current.root.visible=!!visible;motherLabel.visible=birth;rescueLabel.visible=!!visible&&!birth;
    if(visible){const carried=birth||r.status==='carried',x=carried?hero.x:r.x,z=carried?hero.z:r.z;
      resident.render({x,z,yaw:hero.yaw,dead:!birth,clock});const adult=resident.runtime.current;
      adult.root.visible=true;
      if(birth){
        // A distinct adult pose; the newborn keeps the current age/body proportions.
        for(const side of ['left','right']){const b=adult.bones[side+'LowerArm'];b.quaternion.multiply(new T.Quaternion().setFromEuler(new T.Euler(-1.25,0,0)));}
        adult.vrm.update(0);adult.root.updateMatrixWorld(true);
        c.root.position.x+=Math.sin(hero.yaw)*.26;c.root.position.z+=Math.cos(hero.yaw)*.26;c.root.position.y+=1.04;c.root.updateMatrixWorld(true);
        motherLabel.position.set(x,2.5,z);
      }else if(carried){adult.root.position.y+=.95;adult.root.updateMatrixWorld(true);}
      rescueLabel.position.set(x,carried?2.25:.65,z);
      for(const model of [c,adult])for(const p of model.shadowMeshes){p.matrix.copy(p.userData.source.matrixWorld);p.matrixWorldNeedsUpdate=true;}
    }
    if(lastZone!==state.zone){lastZone=state.zone;view.colliders([]);port.world({zone:state.zone,bounds:state.zone==='village'?{x:LIMIT-.4,z:LIMIT-.4}:{x:7.6,z:5.4},canEnter:state.zone==='village'?(x,z,r)=>!muraBlocked(layout,x,z,r):null});}
    terrain.waterMat.uniforms.time.value=clock;terrain.motes.visible=state.zone==='village';
    frontLabel.visible=state.zone==='frontier';
  });
  return{sync(next,world=layout){state=next;updateLayout(world);},relocate(){const p=safeMuraPosition(layout,view.hero());port.position(p.x,p.z);},dispose(){view.onDraw(null);resident.dispose();root.removeFromParent();const resources=new Set(disposables);for(const group of [root,...cache.values()])group.traverse(o=>{if(o.isMesh){resources.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){resources.add(m);if(m.map)resources.add(m.map);}}});for(const item of resources)item.dispose();}};
}
