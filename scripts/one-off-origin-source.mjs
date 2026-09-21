import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

// Task-scoped bulk-source transformer. No branch/ref writes and no test bypass.
// Both inputs are immutable blobs previously read through the GitHub Connector.
const blobHash = text => createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
function replaceOnce(source, before, after) {
  assert.equal(source.split(before).length, 2, `Expected exactly one source anchor: ${before.slice(0, 90)}`);
  return source.replace(before, after);
}
const runtimePath = 'packages/tidebreak-combat/index.js';
const corePath = 'apps/rinne/src/rebuild/combat-core.js';
let runtime = await readFile(runtimePath, 'utf8');
let core = await readFile(corePath, 'utf8');
assert.equal(blobHash(runtime), '6f12cf9c61f594d06de3c76ddb868f5635bacf61');
assert.equal(blobHash(core), 'c84b0b5bc14f1b06d6b53ab9ea8a1b1a583cf8dc');
const policy = `// Live intent changes must not replay draw/spawn or erase committed motion.
// Weapon/arena identity changes still use configure(); policies update the next
// authored sequence while an existing sequence, contact and recovery keep time.
function updatePolicy(v={}){
 if(v.weapon!=null&&v.weapon!==equippedWeapon)throw Error('Live policy cannot replace a weapon');
 if(v.loadout){
  for(const k of [...ATTACK_KEYS,'uke'])if(v.loadout[k])loadout[k]=normalizeRecipe({...v.loadout[k],weapon:equippedWeapon});
  drafts=copy(loadout);poolReady=false;initPools();hero.plan=null;
 }
 if(v.mindset&&Object.hasOwn(MINDS,v.mindset)){mindset=v.mindset;fixedMindset=v.mindset;}
 if(Object.hasOwn(v,'heroPassive'))sharedFacade.setHeroPassive(v.heroPassive);
 if(Object.hasOwn(v,'enemyLoadout'))for(const e of enemies){if(v.enemyLoadout)e.sharedLoadout=copy(v.enemyLoadout);else delete e.sharedLoadout;}
 return state();
}
`;
runtime = replaceOnce(runtime, 'function configure(v={}){', policy + 'function configure(v={}){');
runtime = replaceOnce(runtime, 'return {\n configure,\n step(dt=1/60)', 'return {\n configure,updatePolicy,\n step(dt=1/60)');
const oldSession = 'function sessionFor(state,target,front,options={}){const signature=combatSignature(state,target,front,options),existing=sessionMap(state).get(target.id);return !existing||existing.signature!==signature||existing.secondary!==Boolean(options.secondary)||existing.enemyCanHit!==Boolean(options.enemyCanHit)||existing.invalid||sessionDrift(existing,state,target)>1.15?createSession(state,target,front,signature,options):existing;}';
const newSession = `function sessionFor(state,target,front,options={}){
 const signature=combatSignature(state,target,front,options),existing=sessionMap(state).get(target.id);
 const secondary=Boolean(options.secondary),enemyCanHit=options.enemyCanHit!==false;
 // Direction, body intent and stamina change continuously during one encounter.
 // Recreating the executor for those policies restarts weapon draw indefinitely.
 // Only identity, health scaling, explicit invalidation or a teleport starts anew.
 if(!existing||existing.invalid||sessionDrift(existing,state,target)>1.15||existing.last.hero.weapon!==tidebreakWeaponFor(state.equipment.weapon)||existing.last.enemy.weapon!==enemyWeapon(front,target)||existing.heroHpScale!==heroHpScale(state)||existing.enemyHpScale!==enemyHpScale(state))return createSession(state,target,front,signature,options);
 if(existing.signature!==signature||existing.secondary!==secondary||existing.enemyCanHit!==enemyCanHit){
  const loadout=secondary?defensiveLoadoutFor(state,target):tidebreakLoadoutFor(state,state?.combat?.comboId,target);
  existing.runtime.updatePolicy({loadout,mindset:tidebreakMindsetFor(state),enemyLoadout:enemyCanHit?null:passiveEnemyLoadout(enemyWeapon(front,target))});
  Object.assign(existing,{signature,secondary,enemyCanHit,loadout,last:existing.runtime.state()});
 }
 return existing;
}`;
core = replaceOnce(core, oldSession, newSession);
await writeFile(runtimePath, runtime);
await writeFile(corePath, core);
await writeFile('/tmp/origin-materialized-paths.json', JSON.stringify([runtimePath, corePath]));
console.log(JSON.stringify({inputs:{runtime:'6f12cf9c61f594d06de3c76ddb868f5635bacf61',core:'c84b0b5bc14f1b06d6b53ab9ea8a1b1a583cf8dc'},outputs:{runtime:blobHash(runtime),core:blobHash(core)}}));
