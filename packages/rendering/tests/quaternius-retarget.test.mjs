import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Group,Bone,AnimationClip,QuaternionKeyframeTrack,VectorKeyframeTrack,Quaternion,Vector3,AnimationMixer} from 'three';
import {SOURCE_HUMANOID,createQuaterniusRetargeter} from '../src/quaternius-retarget.js';
// Mathematical fixtures only. These are never shipped as visual-review content.
function rig(source=false){
  const scene=new Group(),byHuman={},nodes=[],humanBones={};
  const aliases=Object.fromEntries(Object.entries(SOURCE_HUMANOID).map(([s,h])=>[h,s]));
  const add=(name,parent,position)=>{const node=new Bone();node.name=source?aliases[name]:name;node.position.fromArray(position);(parent?byHuman[parent]:scene).add(node);byHuman[name]=node;humanBones[name]={node:nodes.length};nodes.push(node);};
  add('hips',null,[0,1.05,0]);add('spine','hips',[0,.2,0]);add('head','spine',[0,.5,0]);
  for(const [side,d]of [['left',1],['right',-1]]){
    add(side+'UpperArm','spine',[d*.2,.3,0]);add(side+'LowerArm',side+'UpperArm',[d*.3,0,0]);add(side+'Hand',side+'LowerArm',[d*.3,0,0]);
    add(side+'UpperLeg','hips',[d*.15,-.05,0]);add(side+'LowerLeg',side+'UpperLeg',[0,-.45,0]);add(side+'Foot',side+'LowerLeg',[0,-.45,0]);
  }
  if(!source){const spacer=new Group();spacer.rotation.y=.3;const hand=byHuman.rightHand,parent=hand.parent;parent.remove(hand);parent.add(spacer);spacer.add(hand);}
  return {scene,byHuman,parser:{json:{extensions:{VRMC_vrm:{humanoid:{humanBones}}}},getDependency:async(_,index)=>nodes[index]}};
}
function library(){
  const r=rig(true),tracks=Object.values(r.byHuman).map(node=>new QuaternionKeyframeTrack(`${node.name}.quaternion`,[0,1],[0,0,0,1,0,0,0,1]));
  const rest=new AnimationClip('A_TPose',1,tracks);
  const q=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),.7);
  const motion=tracks.map(track=>track.clone());motion[0]=new QuaternionKeyframeTrack('DEF-hips.quaternion',[0,1],[0,0,0,1,...q.toArray()]);
  motion.push(new VectorKeyframeTrack('DEF-hips.position',[0,1],[0,1.05,0,.8,1.05,1.2]));
  return {...r,animations:[rest,new AnimationClip('MotionFixture',1,motion)]};
}
test('raw retarget keeps unmapped parent nodes and does not mutate bind pose',async()=>{
  const target=rig(),source=library(),before=target.byHuman.rightHand.quaternion.toArray();
  const retarget=await createQuaterniusRetargeter(source,target),clip=retarget.getClip('MotionFixture');
  assert.deepEqual(target.byHuman.rightHand.quaternion.toArray(),before);
  assert.ok(clip.tracks.every(track=>Array.from(track.values).every(Number.isFinite)));
  const hip=clip.tracks.find(track=>track.name===target.byHuman.hips.uuid+'.position');assert.equal(hip.values[3],0);assert.equal(hip.values[5],0);
  const raw=retarget.getClip('MotionFixture',{inPlace:false}).tracks.find(track=>track.name.endsWith('.position'));assert.ok(raw.values[3]>.7);
  const restWorld=target.byHuman.rightHand.getWorldQuaternion(new Quaternion());
  const mixer=new AnimationMixer(target.scene);const action=mixer.clipAction(clip).play();action.time=.5;mixer.update(0);target.scene.updateMatrixWorld(true);
  const wanted=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),.35).multiply(restWorld);
  assert.ok(target.byHuman.rightHand.getWorldQuaternion(new Quaternion()).angleTo(wanted)<.001);
  mixer.stopAllAction();retarget.dispose();
});
test('retarget refuses a missing authored rest pose instead of guessing',async()=>{
  const source=library();source.animations=source.animations.filter(c=>c.name!=='A_TPose');
  await assert.rejects(()=>createQuaterniusRetargeter(source,rig()),/A_TPose/);
});
