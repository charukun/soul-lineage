import test from 'node:test';
import assert from 'node:assert/strict';
import {applyTidebreakPose,tidebreakFrameFromSnapshot} from '../src/rebuild/tidebreak-pose.js';

const bone=()=>({rotation:{x:0,y:0,z:0}});
const bones=()=>({spine:bone(),hips:bone(),head:bone(),leftUpperLeg:bone(),rightUpperLeg:bone(),leftLowerLeg:bone(),rightLowerLeg:bone(),leftUpperArm:bone(),rightUpperArm:bone(),leftLowerArm:bone(),rightLowerArm:bone()});

test('Tidebreak snapshot preserves attack progress and authored pose channels',()=>{
  const frame=tidebreakFrameFromSnapshot({attack:'slash',progress:.46,slot:'jo',skill:'初太刀',guarding:false,stun:0,pose:{pitch:.18,twist:.32,roll:.04,pelvisYaw:.16,headPitch:-.05,headLag:-.1,headRoll:.02,crouch:-.12,hand:[.28,1.2,.32],tip:[.9,1.5,1.7],left:[-.28,1.42,.48]}},{targetId:'enemy',intent:'attack',sector:'front'});
  assert.equal(frame.attack,'slash');assert.equal(frame.progress,.46);assert.equal(frame.targetId,'enemy');assert.equal(frame.intent,'attack');assert.deepEqual(frame.pose.tip,[.9,1.5,1.7]);
});

test('Rinne skeleton is retargeted from the same Tidebreak combat frame',()=>{
  const rig=bones(),frame={attack:'thrust',progress:.5,pose:{pitch:.2,twist:.3,roll:.08,pelvisYaw:.12,headPitch:-.04,headLag:-.1,headRoll:.02,crouch:-.14,hand:[.25,1.3,.3],tip:[.25,1.45,2],left:[-.3,1.5,.5]}};
  assert.equal(applyTidebreakPose(rig,frame),true);
  assert.notEqual(rig.spine.rotation.x,0);assert.notEqual(rig.spine.rotation.y,0);assert.notEqual(rig.rightUpperArm.rotation.x,0);assert.notEqual(rig.rightUpperArm.rotation.y,0);
});
