import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderRaidRoutes,recommendRouteId} from '../src/web/raid-routes.js';
import {sampleDevourMotion,DEVOUR_PHASES} from '../src/web/devour-motion.js';
const profile={visits:{},unlocked:[],imported:null,hunts:0};
const offers=['small','medium','large'].map((raidScale,i)=>({id:'route:'+i,seed:i+1,name:'固有名はカードに表示しない',target:'traveller',raidScale,source:'generated'}));
test('raid choices use size, text risk, and actual counts instead of names',()=>{
 const html=renderRaidRoutes(offers,profile);
 for(const name of ['小規模の村','中規模の村','大規模の村'])assert.ok(html.includes(name));
 assert.equal((html.match(/危険度 <b>/g)||[]).length,3);
 assert.ok(!html.includes('固有名はカードに表示しない'));
 for(const count of [6,10,14])assert.ok(html.includes(`家屋 <b>${count}</b>棟`));
 for(const count of [8,12,16])assert.ok(html.includes(`住人 <b>${count}</b>人`));
 assert.ok(html.includes('討伐騎士'));
});
test('first hunt recommends exactly one safest generated route',()=>{
 assert.equal(recommendRouteId(offers,profile),'route:0');
 const html=renderRaidRoutes(offers,profile);assert.equal((html.match(/class="raid-recommended">推奨/g)||[]).length,1);
 assert.ok(html.indexOf('data-village="route:0"')<html.indexOf('class="raid-recommended">推奨'));
});
test('later hunts prioritize an unlearned memory before risk tie breakers',()=>{
 const sameRisk=[{...offers[0],id:'known',target:'traveller'},{...offers[0],id:'new',seed:9,target:'bellkeeper'}];
 assert.equal(recommendRouteId(sameRisk,{...profile,hunts:2,unlocked:['traveller']}),'new');
});
test('selection IDs are escaped and memory is secondary',()=>{
 const html=renderRaidRoutes([{...offers[0],id:'a" onclick="bad',name:'<script>bad</script>'}],{...profile,unlocked:['traveller']});
 assert.ok(html.includes('data-village="a&quot; onclick=&quot;bad"'));
 assert.ok(!html.includes('<script>'));assert.ok(html.includes('習得済み'));
 assert.ok(html.indexOf('小規模の村')<html.indexOf('命の余熱'));
});
test('imported visited village is disabled and reports simulated residents explicitly',()=>{
 const imported={...offers[0],source:'imported-local',entities:[]};
 const a=renderRaidRoutes([],{...profile,imported,visits:{[imported.id]:{}}});
 assert.match(a,/data-imported="1" disabled/);assert.ok(a.includes('再訪不可'));
 const b=renderRaidRoutes([],{...profile,imported});
 assert.ok(b.includes('住人と危険度は単独狩り用の生成値'));assert.ok(!b.includes('固有名はカードに表示しない'));
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
test('real adapter and session wire progress, cleanup and the new route renderer',()=>{
 const creature=readFileSync(new URL('../src/web/creatures.js',import.meta.url),'utf8');
 const session=readFileSync(new URL(import.meta.resolve('@soul/raid')),'utf8');
 const main=readFileSync(new URL('../src/web/main.js',import.meta.url),'utf8');
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(creature,/Number\.isFinite\(a\.devourProgress\)/);assert.match(creature,/applyCapturedPose\(g,a\.capturedBy\)/);
 assert.match(creature,/foot\.quaternion\.copy\(inverse\)/);assert.ok(!creature.includes('Math.sin(time*10)'));
 assert.match(session,/advanceDevour\(this,dt,v\.amount\)/);assert.match(session,/cancelDevour\(this\)/);
 assert.match(main,/renderRaidRoutes\(offers,profile\)/);assert.match(main,/huntUiState\(game/);assert.match(main,/import '\.\/raid-routes\.css'/);
 for(const id of ['enemy-name','enemy-health-track','return-label'])assert.ok(index.includes(`id="${id}"`));
});
