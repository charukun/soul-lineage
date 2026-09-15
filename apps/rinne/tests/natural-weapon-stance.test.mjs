import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../public/simulator/vendor/three.js';

async function stanceModule(){
  globalThis.window??={};
  return import('../public/simulator/src/humanoid-natural-stance.js');
}

function syntheticArmedRig(){
  const root=new T.Group(),upperChest=new T.Bone();
  upperChest.position.set(0,1.28,0);root.add(upperChest);
  const bones={upperChest};
  for(const side of ['right','left']){
    const sign=side==='right'?-1:1;
    const upper=new T.Bone(),lower=new T.Bone(),hand=new T.Bone();
    upper.position.set(sign*.24,.14,0);
    lower.position.set(sign*.035,-.24,.09);
    hand.position.set(sign*.045,-.025,.31);
    hand.quaternion.setFromEuler(new T.Euler(.08*sign,.12,-.06*sign));
    upperChest.add(upper);upper.add(lower);lower.add(hand);
    bones[side+'UpperArm']=upper;bones[side+'LowerArm']=lower;bones[side+'Hand']=hand;
  }
  root.updateMatrixWorld(true);
  return {root,bones};
}

test('weapon stance pole keeps elbows outside the torso instead of pulling them straight down',async()=>{
  const {naturalArmPole}=await stanceModule();
  const points={
    upperChest:new T.Vector3(0,1.30,0),
    rightUpperArm:new T.Vector3(-.24,1.43,0),rightLowerArm:new T.Vector3(-.18,1.16,.10),rightHand:new T.Vector3(-.08,1.20,.46),
    leftUpperArm:new T.Vector3(.24,1.43,0),leftLowerArm:new T.Vector3(.18,1.16,.10),leftHand:new T.Vector3(.08,1.20,.46)
  };
  const runtime={point:(_c,name)=>points[name].clone()};
  const c={bones:{upperChest:{},rightUpperArm:{},rightLowerArm:{},rightHand:{},leftUpperArm:{},leftLowerArm:{},leftHand:{}}};
  for(const side of ['right','left']){
    const pole=naturalArmPole(runtime,c,side);
    assert.ok(pole.toArray().every(Number.isFinite));
    assert.ok(Math.abs(pole.length()-1)<1e-6);
    const shoulder=points[side+'UpperArm'],hand=points[side+'Hand'];
    const reach=hand.clone().sub(shoulder).normalize();
    const outward=shoulder.clone().sub(points.upperChest);outward.addScaledVector(reach,-outward.dot(reach)).normalize();
    const fixed=new T.Vector3(side==='right'?-.55:.55,-.95,-.12);fixed.addScaledVector(reach,-fixed.dot(reach)).normalize();
    assert.ok(pole.dot(outward)>fixed.dot(outward),`${side} elbow should favor anatomical outward clearance`);
  }
  assert.ok(Math.sign(naturalArmPole(runtime,c,'right').x)!==Math.sign(naturalArmPole(runtime,c,'left').x),'mirrored shoulders need mirrored elbow escape');
});

test('natural stance preserves both hand contact transforms while changing arm bend',async()=>{
  const {HumanoidRuntime}=await stanceModule();
  const runtime=new HumanoidRuntime({}),c=syntheticArmedRig();
  const before=Object.fromEntries(['right','left'].map(side=>[side,{
    position:runtime.point(c,side+'Hand'),
    quaternion:c.bones[side+'Hand'].getWorldQuaternion(new T.Quaternion())
  }]));
  const elbowBefore=runtime.point(c,'rightLowerArm');
  const report=runtime.naturalizeHeldWeapon(c,'sword');
  assert.equal(report.sides.length,2);
  assert.ok(report.maxHandDisplacement<2e-4,`hand contact drifted ${report.maxHandDisplacement}`);
  assert.ok(report.maxHandAngleError<1e-5,`wrist orientation drifted ${report.maxHandAngleError}`);
  for(const side of ['right','left']){
    const afterPosition=runtime.point(c,side+'Hand');
    const afterQuaternion=c.bones[side+'Hand'].getWorldQuaternion(new T.Quaternion());
    assert.ok(afterPosition.distanceTo(before[side].position)<2e-4,`${side} hand endpoint moved`);
    assert.ok(afterQuaternion.angleTo(before[side].quaternion)<1e-5,`${side} wrist world orientation moved`);
  }
  assert.ok(runtime.point(c,'rightLowerArm').distanceTo(elbowBefore)>1e-4,'elbow should actually be re-solved, not leave the old bend untouched');
});

test('natural stance only touches visibly held-weapon guard windows, never the authored strike body',async()=>{
  const {shouldNaturalizeWeaponStance}=await stanceModule();
  const base={weapon:'sword',weaponDraw:1,combatReady:true,weaponTransition:false,attack:null,reaction:null,recovery:null,dead:false,zanshin:null};
  assert.equal(shouldNaturalizeWeaponStance(base,null),true,'ready stance should be corrected');
  assert.equal(shouldNaturalizeWeaponStance({...base,attack:{}},.08),true,'opening guard may be corrected');
  assert.equal(shouldNaturalizeWeaponStance({...base,attack:{}},.50),false,'authored strike body must remain untouched');
  assert.equal(shouldNaturalizeWeaponStance({...base,attack:{}},.90),true,'return-to-guard may be corrected');
  assert.equal(shouldNaturalizeWeaponStance({...base,weapon:'fist'},null),false,'unarmed motion is out of scope');
  assert.equal(shouldNaturalizeWeaponStance({...base,weaponDraw:.1,combatReady:false},null),false,'sheathed weapon must not pull the arms');
  assert.equal(shouldNaturalizeWeaponStance({...base,weaponDraw:.1,combatReady:true,weaponTransition:true},null),false,'draw transition must not pull arms before the weapon clears the scabbard');
  assert.equal(shouldNaturalizeWeaponStance({...base,weaponDraw:.26,combatReady:true,weaponTransition:true},null),true,'draw transition may naturalize once the weapon is visibly held');
  assert.equal(shouldNaturalizeWeaponStance({...base,reaction:{}},null),false,'hit reaction must not be overwritten');
});

test('ready-body support blends through draw and guard seams without touching the strike body',async()=>{
  const {readyBodyStrength,readyBaseStrength}=await stanceModule();
  const base={weapon:'sword',weaponDraw:1,combatReady:true,weaponTransition:false,vx:0,vz:0,air:0,attack:null,reaction:null,recovery:null,dead:false,zanshin:null};
  assert.equal(readyBodyStrength(base),1,'settled static guard should receive full supporting torso posture');
  assert.equal(readyBaseStrength(base,{type:'combat'}),1,'settled combat guard should receive a grounded base');
  assert.equal(readyBaseStrength({...base,vz:1},{type:'combat'}),0,'moving guard must leave locomotion feet alone');
  assert.equal(readyBaseStrength({...base,air:1},{type:'combat'}),0,'airborne guard must leave the base alone');
  assert.equal(readyBaseStrength(base,{type:'attack'}),0,'attack footwork stays authored');
  assert.equal(readyBodyStrength({...base,weaponDraw:.25,weaponTransition:true}),0,'torso must remain idle until the blade clears the hip');
  assert.ok(Math.abs(readyBodyStrength({...base,weaponDraw:.625,weaponTransition:true})-.5)<1e-9,'draw midpoint should blend torso support smoothly');
  assert.equal(readyBodyStrength({...base,weaponDraw:.1,weaponTransition:true}),0,'sheathed draw frame must not lean');
  const attack={...base,attack:{}};
  assert.equal(readyBodyStrength(attack),0,'an attack without a resolved progress must not guess a support amount');
  assert.equal(readyBodyStrength(attack,0),1,'attack starts in the same supported guard');
  assert.ok(Math.abs(readyBodyStrength(attack,.06)-.5)<1e-9,'opening guard fades support smoothly');
  assert.equal(readyBodyStrength(attack,.12),0,'authored strike body owns the motion after the opening guard');
  assert.equal(readyBodyStrength(attack,.5),0,'contact body remains entirely authored');
  assert.equal(readyBodyStrength(attack,.82),0,'recovery support starts from zero');
  assert.ok(Math.abs(readyBodyStrength(attack,.91)-.5)<1e-9,'recovery blends back toward the ready torso');
  assert.equal(readyBodyStrength(attack,1),1,'attack endpoint must meet the settled guard torso');
  assert.equal(readyBodyStrength({...base,vz:1}),0,'moving guard keeps locomotion body motion');
  assert.equal(readyBodyStrength({...base,reaction:{}}),0,'hit reaction must stay untouched');
  assert.equal(readyBodyStrength({...base,combatReady:false,weaponTransition:false}),0,'ordinary idle must stay untouched');
  assert.equal(readyBodyStrength({...base,weapon:'fist'}),0,'unarmed combat is outside this weapon stance layer');
});

test('the live humanoid entrypoint retains natural stance in the final runtime chain',async()=>{
  const stance=await stanceModule();
  const live=await import('../public/simulator/src/humanoid.js');
  let ctor=live.HumanoidRuntime,found=false;
  while(typeof ctor==='function'&&ctor!==Function.prototype){if(ctor===stance.HumanoidRuntime){found=true;break;}ctor=Object.getPrototypeOf(ctor);}
  assert.equal(found,true,'final simulator runtime must inherit the natural-stance correction layer');
  assert.equal(Object.hasOwn(stance.HumanoidRuntime.prototype,'sample'),true,'natural-stance layer must still own its renderer/collision sampler correction');
  assert.equal(typeof live.HumanoidRuntime.prototype.sample,'function','final runtime must expose the composed sampler');
});

test.after(()=>{delete globalThis.window;});
