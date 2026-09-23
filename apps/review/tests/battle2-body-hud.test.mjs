import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {johakyuSequenceMarkup} from '../../../packages/shared-ui/src/johakyu-hud.js';
import {createBodySilhouette} from '../../../packages/shared-ui/src/body-silhouette.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('both gameplay surfaces mount the same six-part body silhouette and phase track',()=>{
 const html=read('battle2.html'),stage=read('src/nocturne-stage.js'),battleHud=read('src/battle2-body-hud.js');
 const rinneHud=read('../../apps/rinne/src/combat-body-hud.js'),shared=read('../../packages/shared-ui/src/body-silhouette.js');
 const sharedCss=read('../../packages/shared-ui/src/body-silhouette.css');
 assert.match(html,/id="battle-sequence-mount"/);
 assert.match(stage,/johakyuSequenceMarkup\(\{battle2:true\}\)/);
 assert.match(battleHud,/createBodySilhouette\(\{parts:COMBAT_BODY_PARTS\}\)/);
 assert.match(rinneHud,/createBodySilhouette\(\{parts:COMBAT_BODY_PARTS,interactive:true\}\)/);
 assert.match(shared,/parts:nodes/);
 assert.match(sharedCss,/body-silhouette__figure/);
 for(const markup of [johakyuSequenceMarkup(),johakyuSequenceMarkup({battle2:true})]){
   for(const phase of ['jo','ha','kyu'])assert.match(markup,new RegExp('data-combat-phase="'+phase+'"'));
   assert.match(markup,/battle-sequence-hud__edge--zanshin/);
 }
 assert.match(johakyuSequenceMarkup({battle2:true}),/id="battle-sequence-finisher"/);
});

test('body silhouette preserves selectable parts and a read-only battle view',()=>{
 const doc={createElement(tag){return{tag,dataset:{},children:[],attributes:{},setAttribute(key,value){this.attributes[key]=value;},append(...nodes){this.children.push(...nodes);}};}};
 const ids=['head','torso','leftArm','rightArm','leftLeg','rightLeg'];
 const play=createBodySilhouette({parts:ids,interactive:true,doc});
 const review=createBodySilhouette({parts:ids,doc});
 assert.equal(play.parts.size,6);assert.equal(review.parts.size,6);
 assert.equal(play.parts.get('head').node.tag,'button');
 assert.equal(play.parts.get('head').node.attributes['aria-pressed'],'false');
 assert.equal(review.parts.get('head').node.tag,'i');
 assert.equal(review.figure.attributes.role,'img');
 assert.equal(play.parts.get('head').liquid.attributes['aria-hidden'],'true');
});
