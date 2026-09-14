import test from 'node:test';
import assert from 'node:assert/strict';
import {Story} from '../src/game/story.js';
import {LifeClock} from '../public/simulator/src/life-clock.js';
import {createStorySkills} from '../public/simulator/src/story-skills.js';
import {defaultMuraLayout} from '@soul/world/mura';
import {storyRoute,clearStorySegment} from '../src/game/story-route.js';

test('real activities expose progress, unlock once, and old saves gain journey records',()=>{
 const story=new Story(),clock=new LifeClock();story.release();clock.setRate(20);
 const hero={hp:340,maxhp:340,dead:false,x:0,z:0};
 for(const [kind,place] of [['observe','field'],['observe','field'],['study','school'],['study','school']]){
  const p=story.places.find(p=>p.id===place);if(p)Object.assign(hero,{x:p.x,z:p.z});
  assert.ok(story.startActivity(kind,place,{hero}));
  for(let i=0;i<8;i++){clock.advance(1);story.tick(1,{hero,life:clock.snapshot(),enemies:[]});}
 }
 const discovery=story.learning()[0];assert.deepEqual(discovery.progress.map(p=>p.count),[2,2]);assert.ok(discovery.pending);assert.equal(discovery.learned,false);
 story.tick(0,{hero,life:clock.snapshot(),enemies:[]});assert.deepEqual(story.state.pendingDiscoveries,['attention']);
 const old=story.snapshot();delete old.skillUses;delete old.returns;const restored=new Story(old);assert.deepEqual(restored.state.skillUses,[]);assert.equal(restored.state.returns,0);
 assert.equal(story.recordSkill('story-1-attention'),false);story.state.zone='frontier';assert.equal(story.recordSkill('story-1-attention'),true);assert.equal(story.recordSkill('story-1-attention'),false);assert.equal(story.recordSkill('unknown'),false);
 assert.deepEqual(new Story(story.snapshot()).state.skillUses,['story-1-attention']);
});

test('learned skill assignment uses the native setter and reports actual ratios and active recipe',()=>{
 const recipe={id:'story-1-attention',name:'見切りの一閃',weapon:'sword'},library=[{id:'demo',name:'other'},recipe],pools={jo:[{id:'a'},{id:'b'},{id:'c'}],ha:[],kyu:[]};let editable=true,run=null,calls=0;
 const port=createStorySkills({readLibrary:()=>library,readPools:()=>pools,weights:()=>[70,30,0],identity:r=>({jp:r?.name||'空'}),assign:(stage,index,r)=>{calls++;pools[stage][index]=structuredClone(r);return true;},active:()=>run,canEdit:()=>editable});
 assert.equal(port.learnedSkills().length,1);assert.equal(port.assignLearnedSkill('demo','jo',0),false);assert.equal(port.assignLearnedSkill(recipe.id,'mind',0),false);assert.equal(port.assignLearnedSkill(recipe.id,'jo',3),false);
 editable=false;assert.equal(port.assignLearnedSkill(recipe.id,'jo',0),false);editable=true;assert.equal(port.assignLearnedSkill(recipe.id,'jo',1),true);assert.equal(calls,1);assert.equal(pools.jo[0].id,'a');assert.equal(pools.jo[2].id,'c');assert.deepEqual(port.learnedSkills()[0].slots,[{stage:'jo',index:1,weight:30}]);
 assert.equal(port.activeLearnedSkill(),null);run={recipe,slot:'jo'};assert.deepEqual(port.activeLearnedSkill(),{id:recipe.id,name:recipe.name,stage:'jo'});
});

test('port guidance crosses current MURA dry ground and follows revised buildings',()=>{
 const layout=defaultMuraLayout(),start={x:5,z:12},target={x:166,z:0};assert.equal(clearStorySegment(layout,start,target),false);
 const check=world=>{const route=storyRoute(world,start,target);assert.ok(route?.length>1);let previous=start;for(const p of route){assert.ok(clearStorySegment(world,previous,p));previous=p;}assert.deepEqual(previous,target);return route;};
 const first=check(layout);assert.ok(first.some(p=>Math.abs(p.z)>35));
 const changed=structuredClone(layout);changed.revision++;changed.objects.push({...changed.objects[0],id:'new-building',x:first[0].x,z:first[0].z});const second=check(changed);assert.notDeepEqual(second,first);
 assert.equal(storyRoute(layout,start,{x:200,z:0}),null);
});
