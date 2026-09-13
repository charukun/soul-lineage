import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../public/simulator/vendor/three.js';

async function stanceModule(){
  globalThis.window??={};
  return import('../public/simulator/src/humanoid-natural-stance.js');
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

test('natural stance only touches held-weapon guard windows, never the authored strike body',async()=>{
  const {shouldNaturalizeWeaponStance}=await stanceModule();
  const base={weapon:'sword',weaponDraw:1,combatReady:true,weaponTransition:false,attack:null,reaction:null,recovery:null,dead:false,zanshin:null};
  assert.equal(shouldNaturalizeWeaponStance(base,null),true,'ready stance should be corrected');
  assert.equal(shouldNaturalizeWeaponStance({...base,attack:{}},.08),true,'opening guard may be corrected');
  assert.equal(shouldNaturalizeWeaponStance({...base,attack:{}},.50),false,'authored strike body must remain untouched');
  assert.equal(shouldNaturalizeWeaponStance({...base,attack:{}},.90),true,'return-to-guard may be corrected');
  assert.equal(shouldNaturalizeWeaponStance({...base,weapon:'fist'},null),false,'unarmed motion is out of scope');
  assert.equal(shouldNaturalizeWeaponStance({...base,weaponDraw:.1,combatReady:false},null),false,'sheathed weapon must not pull the arms');
  assert.equal(shouldNaturalizeWeaponStance({...base,reaction:{}},null),false,'hit reaction must not be overwritten');
});

test.after(()=>{delete globalThis.window;});
