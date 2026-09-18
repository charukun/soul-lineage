import test from 'node:test';
import assert from 'node:assert/strict';
import {createCreature,animateCreature} from '../src/web/creatures.js';

const combatPose={phase:.3,pitch:.42,twist:-.24,roll:.08,crouch:-.12,lift:.06,hand:[.72,.88,.18],left:[-.58,.96,.12],tip:[.86,1.72,.42]};

test('night creature blends locomotion into and out of combat pose',()=>{
 const creature=createCreature(true),base={x:0,z:0,yaw:0,speed:2,walk:1.2,dead:false};
 animateCreature(creature,base,1,{dt:1/60,form:'hollow'});assert.equal(creature.userData.combatBlend,0);
 animateCreature(creature,{...base,pose:combatPose},1+1/60,{dt:1/60,form:'hollow'});
 assert.ok(creature.userData.combatBlend>0&&creature.userData.combatBlend<1);
 const firstHand=creature.userData.limbs.find(({arm})=>arm.s===1)?.arm.hand.position.x;
 assert.ok(firstHand>.47&&firstHand<combatPose.hand[0]);
 for(let i=0;i<16;i++)animateCreature(creature,{...base,pose:combatPose},1+(i+2)/60,{dt:1/60,form:'hollow'});
 assert.equal(creature.userData.combatBlend,1);
 animateCreature(creature,base,2,{dt:1/60,form:'hollow'});assert.ok(creature.userData.combatBlend>0&&creature.userData.combatBlend<1);
 for(let i=0;i<16;i++)animateCreature(creature,base,2+(i+1)/60,{dt:1/60,form:'hollow'});
 assert.equal(creature.userData.combatBlend,0);
 creature.updateMatrixWorld(true);creature.traverse(node=>assert.ok(node.matrixWorld.elements.every(Number.isFinite),node.name));
});
