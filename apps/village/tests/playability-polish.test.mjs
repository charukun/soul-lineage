import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 ENTRY_SEEN_KEY,TUTORIAL_REASONS,feedbackTone,nearestProjectedObject,objectTapRadius,shouldCelebrate,shouldSkipEntry,tutorialReason,
} from '../src/web/playability.js';

test('return flow only skips entry after the first acknowledged visit',()=>{
 assert.equal(ENTRY_SEEN_KEY,'mura.village.entry-seen.v1');
 assert.equal(shouldSkipEntry(null),false);
 assert.equal(shouldSkipEntry('0'),false);
 assert.equal(shouldSkipEntry('1'),true);
});

test('all authored onboarding steps explain why the action matters',()=>{
 for(const kind of ['tent','logging','wheat','carpenter','guardpost']){
  assert.ok(TUTORIAL_REASONS[kind]?.length>18,kind);
  assert.equal(tutorialReason({kind,text:'fallback'}),TUTORIAL_REASONS[kind]);
 }
 assert.equal(tutorialReason({kind:'future',text:'future reason'}),'future reason');
});

test('mobile object targets are forgiving without becoming screen-wide',()=>{
 const def={w:12,d:10,building:true};
 const mobile=objectTapRadius({viewportWidth:390,viewportHeight:844,span:40,def});
 const desktop=objectTapRadius({viewportWidth:1280,viewportHeight:850,span:65,def});
 assert.ok(mobile>=38&&mobile<=62,mobile);
 assert.ok(desktop>=28&&desktop<=50,desktop);
 assert.ok(mobile>desktop);
});

test('fallback picking selects a nearby projected object and ignores distant objects',()=>{
 const objects=[{id:'near',kind:'home',x:10,z:10},{id:'far',kind:'home',x:80,z:80}];
 const defs={home:{w:12,d:12,building:true}};
 const picked=nearestProjectedObject({
  objects,defs,x:103,y:202,viewportWidth:390,viewportHeight:844,span:40,
  project:(x,_y,z)=>({x:x===10?100:330,y:z===10?200:700}),
 });
 assert.equal(picked,'near');
 const none=nearestProjectedObject({objects,defs,x:5,y:500,viewportWidth:390,viewportHeight:844,span:40,project:(x,_y,z)=>({x:x===10?100:330,y:z===10?200:700})});
 assert.equal(none,null);
});

test('meaningful village changes are promoted while routine chatter stays quiet',()=>{
 assert.equal(feedbackTone('丸太を発見しました','life'),'unlock');
 assert.equal(feedbackTone('空きテントを建てました','life'),'growth');
 assert.equal(feedbackTone('魔王軍の襲撃が近い','threat'),'danger');
 assert.equal(shouldCelebrate('今日はいい天気です','life'),false);
 assert.equal(shouldCelebrate('寝床が2床増えました','life'),true);
});

test('post-boot enhancement graph preserves first-run before playability',()=>{
 const source=readFileSync(new URL('../src/mura-enhancements.js',import.meta.url),'utf8');
 const firstRun=source.indexOf("import './mura-first-run-autoplay.js';");
 const director=source.indexOf("import './mura-director-touch-fix.js';");
 const playability=source.indexOf("import './mura-playability-polish.js';");
 assert.ok(firstRun>0&&firstRun<director);
 assert.ok(playability>director);
});

test('browser polish keeps the full first-play interaction contract',()=>{
 const source=readFileSync(new URL('../src/mura-playability-polish.js',import.meta.url),'utf8');
 for(const contract of ['muraFindPlacement','cancelPlace','muraEnterVillage','nearestProjectedObject','world.notify','view.pickPerson','dragThreshold=10','AudioContext','residentReaction','__MURA_PLAYABILITY_POLISH__'])assert.ok(source.includes(contract),contract);
});
