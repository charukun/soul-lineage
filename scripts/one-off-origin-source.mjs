import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

// Task-scoped transformation of Connector-verified source blobs. No ref writes.
const hash=text=>createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
const expected={
 'packages/tidebreak-combat/index.js':'1a34365140657dd1c8f349139ebbfe207bbbe45f',
 'packages/tidebreak-combat/facade.inc.txt':'1e7c309a512f50e3427043d4722952b5fb015f9a',
 'packages/tidebreak-combat/shared-runtime-facade.js':'fe661c31f1b1350f69032db002e96567c671b140',
 'apps/rinne/src/rebuild/combat-core.js':'dfcbbc87ff26f93f9a0a221f6a6e9bafc0c9fe71'
};
const once=(text,before,after)=>{assert.equal(text.split(before).length,2,`Unique anchor required: ${before.slice(0,80)}`);return text.replace(before,after);};
const outputs=[];
for(const [path,sha]of Object.entries(expected)){
 let text=await readFile(path,'utf8');assert.equal(hash(text),sha);
 if(path.endsWith('/index.js')||path.endsWith('/facade.inc.txt')){
  text=once(text,'if(v.positions?.hero){Object.assign(hero,v.positions.hero);hero.home=[hero.x,hero.z];initFeet(hero);}return state();',`if(v.positions?.hero){Object.assign(hero,v.positions.hero);hero.home=[hero.x,hero.z];initFeet(hero);}
 // An embedding game may already have selected a live contact target. Do not
 // roll another idle/probe decision; keep draw, startup and real contact intact.
 if(v.engaged===true&&!sharedFacade.shouldHoldHero(hero))hero.tactics={...hero.tactics,state:'commit',age:0,duration:1};
 return state();`);
 }else if(path.endsWith('/shared-runtime-facade.js')){
  text=once(text,'attack:actor.attack?.kind??null,progress:','attack:actor.attack?.kind??null,attackDamage:Math.max(0,Number(actor.attack?.damage)||0),progress:');
 }else{
  text=once(text,'runtime.configure({weapon,enemyWeapon:','runtime.configure({engaged:!secondary,weapon,enemyWeapon:');
  text=once(text,'function chargeAttackStamina(state,session,next){',`// A committed offensive motion still costs stamina after attention turns to a
// secondary threat. Pure defensive motions retain their existing cost policy.
function chargeAttackStamina(state,session,next){`);
  text=once(text,'!session.oneMotionArmed&&!session.secondary){','!session.oneMotionArmed&&(!session.secondary||next.hero.attackDamage>0)){');
 }
 await writeFile(path,text);outputs.push({path,input:sha,output:hash(text)});
}
await writeFile('/tmp/origin-materialized-paths.json',JSON.stringify(Object.keys(expected)));
console.log('ORIGIN_CONTACT_PATCH '+JSON.stringify(outputs));
