import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RaidSession} from '@soul/raid/single-session';
import {freshProfile} from '@soul/raid/profile';
import {pickRandomRaid} from '../src/web/raid-routes.js';
import {sampleDevourMotion,DEVOUR_PHASES} from '../src/web/devour-motion.js';
import {growthCameraFrame} from '../src/web/view.js';
const profile={visits:{},unlocked:[],hunts:0};
const offers=['small','medium','large'].map((raidScale,i)=>({id:'route:'+i,seed:i+1,name:'村'+i,target:'traveller',raidScale,source:'generated'}));

test('each hunt chooses one generated village directly from the random roll',()=>{
 assert.equal(pickRandomRaid(offers,profile,()=>0).id,'route:0');
 assert.equal(pickRandomRaid(offers,profile,()=>.4).id,'route:1');
 assert.equal(pickRandomRaid(offers,profile,()=>.999999).id,'route:2');
});
test('random hunt never chooses a village that already has a scar',()=>{
 const p={...profile,visits:{'route:0':{status:'escaped'},'route:2':{status:'defeated'}}};
 for(const roll of [0,.2,.9])assert.equal(pickRandomRaid(offers,p,()=>roll).id,'route:1');
});
test('random hunt returns null when no unvisited village remains in the offer set',()=>{
 const visits=Object.fromEntries(offers.map(v=>[v.id,{status:'escaped'}]));
 assert.equal(pickRandomRaid(offers,{...profile,visits},()=>.5),null);
});
test('normal hunt flow contains no village selection presentation',()=>{
 const main=readFileSync(new URL('../src/web/main.js',import.meta.url),'utf8');
 assert.match(main,/pickRandomRaid\(offers,profile\)/);assert.match(main,/async function randomHunt/);
 assert.doesNotMatch(main,/renderRaidRoutes|CHOOSE YOUR HUNT|data-village|raid-routes\.css/);
});
test('devour animation has reach, pull, asymmetric bites, swallowing and recovery',()=>{
 const phases=new Set(Array.from({length:101},(_,i)=>sampleDevourMotion(i/100).phase));
 assert.deepEqual([...phases],DEVOUR_PHASES);
 const reach=sampleDevourMotion(.30),pull=sampleDevourMotion(.44),bite=sampleDevourMotion(.51),swallow=sampleDevourMotion(.84);
 assert.ok(reach.drop<-.3);assert.ok(reach.pitch>.9);assert.ok(reach.handY<.3);
 assert.ok(pull.preyLift>reach.preyLift);assert.ok(pull.jaw>.8);assert.ok(bite.jaw<.05);
 assert.ok(swallow.throat>.9);assert.ok(swallow.headPitch<-.3);
 assert.notEqual(sampleDevourMotion(.59).twist,bite.twist);
});
test('feeding action stays committed for more than four seconds and carries growth into capture',()=>{
 const game=new RaidSession(offers[0],freshProfile('presentation-feeding',1));
 const prey=game.village.npcs[0];game.village.colliders=[];game.village.gate.broken=true;
 Object.assign(prey,{dead:true,eaten:false,x:0,z:0});Object.assign(game.player,{x:0,z:.7});game.devour={npc:prey,t:0};
 game.tick(1/30,{x:0,z:0,amount:0});assert.equal(prey.capturedBy.growthScale,game.player.growthScale);
 for(let i=1;i<120;i++)game.tick(1/30,{x:0,z:0,amount:0});
 assert.equal(prey.eaten,false);assert.ok(game.devour);
 for(let i=0;i<7&&!prey.eaten;i++)game.tick(1/30,{x:0,z:0,amount:0});
 assert.equal(prey.eaten,true);assert.equal(game.devour,null);
});
test('camera framing expands smoothly from tiny body to giant body',()=>{
 const tiny=growthCameraFrame(.28,false),mid=growthCameraFrame(1,false),giant=growthCameraFrame(3.2,false);
 assert.equal(tiny.scale,.28);assert.equal(giant.scale,3.2);
 assert.ok(tiny.zoom<mid.zoom&&mid.zoom<giant.zoom);assert.ok(giant.zoom>tiny.zoom*2);
 assert.ok(giant.lookY>mid.lookY&&mid.lookY>tiny.lookY);assert.ok(giant.shadow>mid.shadow&&mid.shadow>tiny.shadow);
 assert.deepEqual(growthCameraFrame(99,false),giant);
});
test('motion is continuous, finite, bounded, deterministic and clamps invalid input',()=>{
 for(let i=0;i<=1000;i++){
  const p=sampleDevourMotion(i/1000),prev=sampleDevourMotion(Math.max(0,i-1)/1000);
  assert.deepEqual(p,sampleDevourMotion(i/1000));
  for(const [k,v] of Object.entries(p))if(typeof v==='number'){assert.ok(Number.isFinite(v));assert.ok(Math.abs(v)<2);assert.ok(Math.abs(v-prev[k])<.1,`${k} discontinuity`);}
 }
 assert.deepEqual(sampleDevourMotion(-1),sampleDevourMotion(0));assert.deepEqual(sampleDevourMotion(NaN),sampleDevourMotion(0));
 assert.deepEqual(sampleDevourMotion(2),sampleDevourMotion(1));
});
test('start/end return the torso, jaw and planted feet to the resting pose',()=>{
 const a=sampleDevourMotion(0),b=sampleDevourMotion(1);
 for(const key of Object.keys(a).filter(k=>!['phase','progress'].includes(k)))assert.ok(Math.abs(a[key]-b[key])<1e-12,key);
});
test('UI uses lineage and adaptive combat instead of manual technique slots',()=>{
 const main=readFileSync(new URL('../src/web/main.js',import.meta.url),'utf8');
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(main,/renderLineage\(profile\)/);assert.match(main,/store\.learn\(role,move\)/);assert.match(main,/store\.consume\(role,options\)/);
 assert.ok(!main.includes('data-slot'));assert.ok(!main.includes('store.equip('));
 assert.ok(index.includes('転生史'));assert.ok(index.includes('放置すると徘徊'));assert.ok(!index.includes('二度と戻れない'));
 assert.ok(!index.includes('alarm-fill'));assert.ok(!index.includes('alarm-label'));assert.ok(!index.includes('class="danger"'));
});
test('real adapter and grouped session preserve devour, escape and random-route contracts',()=>{
 const creature=readFileSync(new URL('../src/web/creatures.js',import.meta.url),'utf8');
 const view=readFileSync(new URL('../src/web/view.js',import.meta.url),'utf8');
 const grouped=readFileSync(new URL(import.meta.resolve('@soul/raid')),'utf8');
 const single=readFileSync(new URL(import.meta.resolve('@soul/raid/single-session')),'utf8');
 const main=readFileSync(new URL('../src/web/main.js',import.meta.url),'utf8');
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(creature,/Number\.isFinite\(a\.devourProgress\)/);assert.match(creature,/applyCapturedPose\(g,a\.capturedBy\)/);assert.match(creature,/Math\.min\(3\.2/);
 assert.match(creature,/foot\.quaternion\.copy\(inverse\)/);assert.ok(!creature.includes('Math.sin(time*10)'));
 assert.match(view,/growthCameraFrame\(p\.growthScale/);assert.match(view,/growthFrame\.shadow/);
 assert.match(grouped,/extends SingleRaidSession/);assert.match(grouped,/combatants/);assert.match(grouped,/if\(this\.devour\)/);
 assert.match(single,/advanceDevour\(this,dt,v\.amount\)/);assert.match(single,/cancelDevour\(this\)/);assert.match(single,/escapePoints\(\)/);assert.match(single,/MONSTER_GROWTH_PROFILES/);assert.match(single,/feedingGrowth/);
 assert.match(main,/pickRandomRaid\(offers,profile\)/);assert.match(main,/huntUiState\(game/);assert.match(main,/game\.nearestEscape\?\.\(\)/);assert.match(main,/if\(game\?\.eaten>0\)guideState\.memorySeen=true/);
 for(const id of ['enemy-name','enemy-health-track','return-label'])assert.ok(index.includes(`id="${id}"`));
 assert.match(single,/autoRoam/);assert.match(single,/f\.retreat/);assert.doesNotMatch(single,/addGuard\(|this\.alarm/);
});
