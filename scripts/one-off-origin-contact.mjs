import { build } from 'esbuild';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';

const hash = value => createHash('sha1').update(`blob ${Buffer.byteLength(value)}\0`).update(value).digest('hex');
const root=process.cwd();
await mkdir('/tmp/origin-contact-probe',{recursive:true});
const actor = `a=>({id:a.id,x:a.x,z:a.z,yaw:a.yaw,hp:a.hp,cool:a.cool,stun:a.stun,combatReady:a.combatReady,weaponDraw:a.weaponDraw,weaponTransition:a.weaponTransition,attack:a.attack&&{kind:a.attack.kind,t:a.attack.t,anim:a.attack.anim},plan:a.plan&&{slot:a.plan.slot,name:a.plan.recipe?.name},run:a.run&&{slot:a.run.slot,i:a.run.i,t:a.run.t,name:a.run.recipe?.name},recovery:a.recovery,pendingReceive:a.pendingReceive,endlag:a.endlag,parry:a.parry,evasion:a.evasion,tactics:a.tactics})`;
await build({stdin:{contents:`export {createLife,setMoving,tickLife} from './apps/rinne/src/rebuild/domain.js';export {createFront,tickFront,tidebreakLoadoutFor,probeSessions} from './apps/rinne/src/rebuild/combat-core.js';export {createTidebreakRuntime} from './packages/tidebreak-combat/index.js';`,resolveDir:root,sourcefile:'contact-probe-entry.mjs'},bundle:true,platform:'node',format:'esm',outfile:'/tmp/origin-contact-probe/contact.mjs',sourcemap:true,plugins:[{name:'read-only-encounter-observer',setup(builder){builder.onLoad({filter:/(?:combat-core\.js|tidebreak-combat\/index\.js)$/},async args=>{
 let text=await readFile(args.path,'utf8');
 if(args.path.endsWith('/combat-core.js')){assert.equal(hash(text),'dfcbbc87ff26f93f9a0a221f6a6e9bafc0c9fe71');text+='\nexport const probeSessions = state => [...(SESSIONS.get(state)?.values() || [])];\n';}
 else {assert.equal(hash(text),'1a34365140657dd1c8f349139ebbfe207bbbe45f');const anchor="_test:{generateSkill(weapon='sword'";assert.equal(text.split(anchor).length,2);text=text.replace(anchor,`_test:{inspect(){const snapshot=${actor};return {time,hero:snapshot(hero),enemies:enemies.map(snapshot)};},generateSkill(weapon='sword'`);}
 return {contents:text,resolveDir:resolve(args.path,'..'),loader:'js'};
});}}]});
await writeFile('/tmp/origin-contact-probe/provenance.json',JSON.stringify({sourceHead:process.env.GITHUB_SHA,productionInputs:{core:'dfcbbc87ff26f93f9a0a221f6a6e9bafc0c9fe71',runtime:'1a34365140657dd1c8f349139ebbfe207bbbe45f'},purpose:'Read-only observation of the existing encounter; not merge-owning validation'},null,2));
const {createLife,setMoving,tickLife,createFront,tickFront,probeSessions}=await import('/tmp/origin-contact-probe/contact.mjs');
const state=createLife({seed:6});Object.assign(state,{phase:'living',ageSeconds:1200,ageYears:20,zone:'frontier',position:{x:0,z:0}});state.equipment.weapon='sword';state.knownSkills.push('basic.sword');state.skillWeights.jo={'basic.sword':100};
const front=createFront(0,6);front.enemies[0].x=.5;front.enemies[0].z=.5;const events=[],frames=[];
for(let frame=0;frame<150;frame++){
 setMoving(state,false);tickLife(state,{realDelta:1/60});const current=tickFront(state,front,1/60);events.push(...current.map(event=>({frame,...event})));
 if(frame%15===0||current.length)frames.push({frame,intent:state.combat?.bodyIntent,hp:state.hp,stamina:state.stamina,sessions:probeSessions(state).map(session=>({target:session.targetId,secondary:session.secondary,invalid:session.invalid,...session.runtime._test.inspect()}))});
}
await writeFile('/tmp/origin-contact-probe/trace.json',JSON.stringify({events,frames},null,2));
console.log('CONTACT_TRACE '+JSON.stringify({events:events.map(row=>({frame:row.frame,type:row.type})),frames:frames.map(row=>({frame:row.frame,intent:row.intent,hero:row.sessions[0]?.hero,enemy:row.sessions[0]?.enemies[0]}))}));
