import test from 'node:test';
import assert from 'node:assert/strict';
import {impactReactionEnvelope,impactReactionProfile} from '../src/impact-reaction.js';

test('body-part reactions propagate from the contact area into adjacent bones',()=>{
 const head=impactReactionProfile({bodyPart:'head',phase:'ha',strength:1}),arm=impactReactionProfile({bodyPart:'rightArm',phase:'ha',strength:1}),leg=impactReactionProfile({bodyPart:'leftLeg',phase:'ha',heavy:true,strength:1});
 assert.deepEqual(head.bones.slice(0,3).map(row=>row.kind),['head','neck','spine']);assert.ok(head.bones[0].delay<head.bones[2].delay);
 assert.equal(arm.limbSide,1);assert.ok(arm.bones.some(row=>row.kind==='upperArm'&&row.side==='impact'));assert.ok(arm.bones.some(row=>row.kind==='spine'));
 assert.equal(leg.limbSide,-1);assert.ok(leg.bones.some(row=>row.kind==='hips'));assert.ok(leg.bones.some(row=>row.kind==='foot'));assert.ok(leg.root.drop>arm.root.drop);
});
test('kyu and heavy impacts move the stance more than a sharp jo contact without ragdoll-scale values',()=>{
 const jo=impactReactionProfile({bodyPart:'torso',phase:'jo',heavy:false,strength:1}),kyu=impactReactionProfile({bodyPart:'torso',phase:'kyu',heavy:true,strength:1});
 assert.ok(kyu.root.push>jo.root.push);assert.ok(kyu.root.pitch>jo.root.pitch);assert.ok(kyu.root.push<.2);
 assert.equal(impactReactionEnvelope(0),0);assert.ok(impactReactionEnvelope(.12)>.5);assert.ok(impactReactionEnvelope(.95)<.08);
});
