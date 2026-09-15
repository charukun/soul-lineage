import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Bone,Mesh,BoxGeometry,MeshStandardMaterial,Vector3} from 'three';
import {createReaperPlayer} from '../src/web/reaper-player.js';
import {createTidebreakRuntime} from '@soul/tidebreak-combat';

// App-owned humanoid fixture: the actual shipped model was also checked locally.
// CI tests do not import another app's asset or depend on its deployment.
async function model(){
  const scene=new Group(),humanoid={};
  function bone(name,parent,position){const b=new Bone();b.name=name;b.position.fromArray(position);parent.add(b);humanoid[name]=b;return b;}
  const hips=bone('hips',scene,[0,.93,0]),spine=bone('spine',hips,[0,.06,0]),chest=bone('chest',spine,[0,.12,0]);
  bone('head',chest,[0,.31,0]);
  for(const side of ['left','right']){const sign=side==='left'?1:-1;
    const arm=bone(side+'UpperArm',chest,[sign*.18,.17,0]),forearm=bone(side+'LowerArm',arm,[sign*.22,0,0]);bone(side+'Hand',forearm,[sign*.215,0,0]);
    const thigh=bone(side+'UpperLeg',hips,[sign*.078,-.04,0]),calf=bone(side+'LowerLeg',thigh,[0,-.366,0]);bone(side+'Foot',calf,[0,-.428,0]);
  }
  const geometry=new BoxGeometry(.5,1.62,.3);geometry.translate(0,.81,0);const material=new MeshStandardMaterial();material.name='Tops_CLOTH';scene.add(new Mesh(geometry,material));
  return {gltf:{scene},rig:{humanoid,expressions:[],springs:[],warnings:[]}};
}
test('MasterCharacter rig carries the wardrobe through locomotion, combat, devour and death without mutating source',async()=>{
  const template=await model(),sourceMaterials=[];template.gltf.scene.traverse(n=>{if(n.isMesh)sourceMaterials.push(n.material);});
  const sourceVisibility=sourceMaterials.map(m=>m.visible),reaper=createReaperPlayer(template);
  const p={x:2,z:3,yaw:.4,speed:2,walk:1.4,hp:230};
  function finite(){reaper.root.traverse(n=>assert.ok(n.matrixWorld.elements.every(Number.isFinite),n.name));}
  reaper.update(p,1,1/60);finite();
  assert.equal(reaper.wardrobe.scythe.visible,true);
  assert.ok(reaper.wardrobe.scythe.getWorldPosition(new Vector3()).distanceTo(reaper.actor.bones.leftHand.getWorldPosition(new Vector3()))<1e-5);
  const core=createTidebreakRuntime({seed:3});core.configure({weapon:'fist',hp:230,enemyHp:120});
  let poses=0;
  for(let i=0;i<240;i++){const state=core.step(1/60);if(state.hero.pose){const hero={...p,pose:state.hero.pose};const before=JSON.stringify(hero);reaper.update(hero,i/60,1/60);finite();assert.equal(JSON.stringify(hero),before);poses++;}}
  assert.ok(poses>0,'sampled actual combat poses');
  for(const devourProgress of [0,.2,.5,.8,1]){reaper.update({...p,devourProgress},5+devourProgress,1/60,{eating:true});finite();assert.equal(reaper.wardrobe.scythe.visible,false);}
  reaper.update(p,7,1/60);assert.equal(reaper.wardrobe.scythe.visible,true);
  reaper.update(p,8,1/60,{dead:true});finite();assert.equal(reaper.wardrobe.scythe.visible,false);
  assert.deepEqual(sourceMaterials.map(m=>m.visible),sourceVisibility);
  const geo=reaper.wardrobe.scythe.children[0].geometry;let disposed=false;geo.addEventListener('dispose',()=>{disposed=true;});reaper.dispose();assert.equal(disposed,true);
});
