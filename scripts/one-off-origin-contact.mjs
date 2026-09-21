import { readFile, mkdir, writeFile, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { resolve, relative, dirname } from 'node:path';

const hash = value => createHash('sha1').update(`blob ${Buffer.byteLength(value)}\0`).update(value).digest('hex');
const root=process.cwd(),output='/tmp/origin-contact-probe',files=new Map(),manifest=[];
await mkdir(output,{recursive:true});await mkdir(output+'/original',{recursive:true});
const actor = `a=>({id:a.id,x:a.x,z:a.z,yaw:a.yaw,hp:a.hp,cool:a.cool,stun:a.stun,combatReady:a.combatReady,weaponDraw:a.weaponDraw,weaponTransition:a.weaponTransition,attack:a.attack&&{kind:a.attack.kind,t:a.attack.t,anim:a.attack.anim},plan:a.plan&&{slot:a.plan.slot,name:a.plan.recipe?.name},run:a.run&&{slot:a.run.slot,i:a.run.i,t:a.run.t,name:a.run.recipe?.name},recovery:a.recovery,pendingReceive:a.pendingReceive,endlag:a.endlag,parry:a.parry,evasion:a.evasion,tactics:a.tactics})`;
async function materialize(path){
 path=await realpath(path);if(files.has(path))return files.get(path);
 assert.ok(path.startsWith(root+'/'),'Only repository source modules may be materialized');
 const name=`module-${files.size}.mjs`;files.set(path,name);let text=await readFile(path,'utf8');
 const record={path:relative(root,path),file:name,sha:hash(text)};manifest.push(record);
 await writeFile(output+'/original/'+name,text);
 if(path.endsWith('/combat-core.js')){assert.equal(hash(text),'dfcbbc87ff26f93f9a0a221f6a6e9bafc0c9fe71');text+='\nexport const probeSessions = state => [...(SESSIONS.get(state)?.values() || [])];\n';}
 if(path.endsWith('/tidebreak-combat/index.js')){assert.equal(hash(text),'1a34365140657dd1c8f349139ebbfe207bbbe45f');const anchor="_test:{generateSkill(weapon='sword'";assert.equal(text.split(anchor).length,2);text=text.replace(anchor,`_test:{inspect(){const snapshot=${actor};return {time,hero:snapshot(hero),enemies:enemies.map(snapshot)};},generateSkill(weapon='sword'`);}
 const pattern=/\b(from\s*|import\s*)(['"])([^'"]+)\2/g,edits=[];
 for(const match of text.matchAll(pattern)){const specifier=match[3];if(specifier.startsWith('node:'))continue;if(!specifier.startsWith('.')&&!specifier.startsWith('@soul/'))continue;const dep=createRequire(path).resolve(specifier),next=await materialize(dep);edits.push({index:match.index,length:match[0].length,value:`${match[1]}'./${next}'`});}
 for(const edit of edits.sort((a,b)=>b.index-a.index))text=text.slice(0,edit.index)+edit.value+text.slice(edit.index+edit.length);
 await writeFile(output+'/'+name,text);return name;
}
const domain=await materialize(resolve('apps/rinne/src/rebuild/domain.js')),core=await materialize(resolve('apps/rinne/src/rebuild/combat-core.js')),runtime=await materialize(resolve('packages/tidebreak-combat/index.js'));
await writeFile(output+'/contact.mjs',`export {createLife,setMoving,tickLife} from './${domain}';export {createFront,tickFront,tidebreakLoadoutFor,probeSessions} from './${core}';export {createTidebreakRuntime} from './${runtime}';`);
await writeFile(output+'/provenance.json',JSON.stringify({sourceHead:process.env.GITHUB_SHA,modules:manifest,purpose:'Read-only encounter observation; not merge-owning validation'},null,2));
const {createLife,setMoving,tickLife,createFront,tickFront,probeSessions}=await import(output+'/contact.mjs');
const state=createLife({seed:6});Object.assign(state,{phase:'living',ageSeconds:1200,ageYears:20,zone:'frontier',position:{x:0,z:0}});state.equipment.weapon='sword';state.knownSkills.push('basic.sword');state.skillWeights.jo={'basic.sword':100};
const front=createFront(0,6);front.enemies[0].x=.5;front.enemies[0].z=.5;const events=[],frames=[];
for(let frame=0;frame<150;frame++){
 setMoving(state,false);tickLife(state,{realDelta:1/60});const current=tickFront(state,front,1/60);events.push(...current.map(event=>({frame,...event})));
 if(frame%15===0||current.length)frames.push({frame,intent:state.combat?.bodyIntent,hp:state.hp,stamina:state.stamina,sessions:probeSessions(state).map(session=>({target:session.targetId,secondary:session.secondary,invalid:session.invalid,...session.runtime._test.inspect()}))});
}
await writeFile(output+'/trace.json',JSON.stringify({events,frames},null,2));
console.log('CONTACT_TRACE '+JSON.stringify({events:events.map(row=>({frame:row.frame,type:row.type})),frames:frames.map(row=>({frame:row.frame,intent:row.intent,hero:row.sessions[0]?.hero,enemy:row.sessions[0]?.enemies[0]}))}));
