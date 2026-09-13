import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../public/simulator/vendor/three.js';

test('weapon stance pole keeps elbows outside the torso instead of pulling them straight down',async()=>{
  globalThis.window={};
  const {naturalArmPole}=await import('../public/simulator/src/humanoid-natural-stance.js');
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
  delete globalThis.window;
});