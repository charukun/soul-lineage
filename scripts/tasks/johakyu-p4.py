from pathlib import Path
import json, hashlib
root=Path.cwd()
def rep(p,a,b):
 path=root/p;s=path.read_text();assert s.count(a)==1,(p,a[:70],s.count(a));path.write_text(s.replace(a,b))
p=root/'packages/johakyu-combat/package.json';d=json.loads(p.read_text());d['exports']['./motion-contract']='./src/motion-contract.js';p.write_text(json.dumps(d,indent=2)+'\n')
p='packages/tidebreak-combat/shared-runtime-facade.js'
rep(p,'  function snapshotActor(actor){', '''  function execution(actor,segment=null){
    const attack=actor?.attack,run=actor?.run;
    if(!attack)return null;
    return Object.freeze({attackId:attack.id,kind:attack.kind,weapon:actor.weapon,
      recipeId:run?.recipe?.id??null,recipeName:run?.recipe?.name??null,phase:run?.slot??null,
      stepIndex:Number.isInteger(run?.index)?run.index:null,targetId:attack.targetId??null,
      progress:attackProgress(actor),motionDuration:attack.motionDuration??attack.duration,
      elapsed:attack.t,duration:attack.duration,chargeTime:attack.chargeTime??0,
      charge:run?.recipe?.steps?.[run.index]?.charge??'none',contactActive:(segment??weaponSegment(actor)).active});
  }
  function snapshotActor(actor){
    const segment=weaponSegment(actor);''')
rep(p,'return{id:actor.id,x:actor.x,','return{id:actor.id,execution:execution(actor,segment),x:actor.x,')
rep(p,'weaponSegment:weaponSegment(actor)};','weaponSegment:segment};')
rep(p,'attack:attack?.kind??null,knockback:', 'attack:attack?.kind??null,attackId:attack?.id??null,execution:execution(source),knockback:')
p='apps/rinne/src/rebuild/tidebreak-pose.js'
rep(p,"if(!actor)return null;return{attack:actor.attack||null,", "if(!actor)return null;return{execution:actor.execution?structuredClone(actor.execution):null,weapon:actor.weapon||null,attack:actor.attack||null,")
p='apps/rinne/src/rebuild/combat-core.js'
rep(p,"import { CAUSAL_ANSWER_BY_ID } from '@soul/game-data';", "import { resolveInspirationAnswer } from '@soul/game-data';\nimport {executedTechniqueId,readJohakyuTechniqueTruth} from './johakyu-technique-contract.js';")
rep(p,'const SESSIONS=new WeakMap();','const SESSIONS=new WeakMap(),SESSION_SERIALS=new WeakMap();')
rep(p,'const session={runtime,loadout,targetId:target.id,',"const ordinal=(SESSION_SERIALS.get(state)||0)+1;SESSION_SERIALS.set(state,ordinal);\n  const session={id:`${state.id}:${state.generation}:${front.stage}:${ordinal}`,runtime,loadout,targetId:target.id,")
rep(p,"function causalTechnique(session,actor){const recipe=session.loadout?.[actor?.slot];if(!recipe||recipe.name!==actor?.skill)return null;const id=recipe.id.replace(/^rinne-(?:jo|ha|kyu)-/,'');return Object.hasOwn(CAUSAL_ANSWER_BY_ID,id)?{id,row:CAUSAL_ANSWER_BY_ID[id]}:null;}","function causalTechnique(session,actor){const id=executedTechniqueId(actor),row=resolveInspirationAnswer(id);return row?{id,row}:null;}")
rep(p,"const key=next.hero.attack?`${next.hero.slot||''}:${next.hero.attack}`:null;let paid=true;", "const key=next.hero.execution?String(next.hero.execution.attackId):null;let paid=true;")
rep(p,"lastAttackKey:snapshot.hero.attack?`${snapshot.hero.slot||''}:${snapshot.hero.attack}`:null", "lastAttackKey:snapshot.hero.execution?String(snapshot.hero.execution.attackId):null")
rep(p,"state.attacking=Boolean(state.combat?.tidebreakPose?.attack);", "if(state.combat?.tidebreakPose)state.combat.tidebreakPose.johakyu=readJohakyuTechniqueTruth(state,state.combat.tidebreakPose,{sessionId:session.id});state.attacking=Boolean(state.combat?.tidebreakPose?.attack);")
rep(p,"techniqueId:armed?null:causal?.id||null,skill:", "techniqueId:armed?armed:executedTechniqueId(executedActor),attackId:outgoingImpact?.attackId!=null?`${session.id}:${outgoingImpact.attackId}`:null,sourceId:state.id,skill:")
rep(p,"events.push({type:'enemy-hit',sourceId:target.id,damage:taken,", "events.push({type:'enemy-hit',sourceId:target.id,targetId:state.id,attackId:incomingImpact?.attackId!=null?`${session.id}:${incomingImpact.attackId}`:null,damage:taken,")
p='apps/review/src/nocturne/johakyu-rules.js'
rep(p,"export function createJohakyuReviewRules({mind='balanced',loadout}={}){\n  const sequence=compileJohakyuSequence({weapon:'sword',loadout});", "export function createJohakyuReviewRules({mind='balanced',loadout,sequence:acceptedSequence=null}={}){\n  const sequence=acceptedSequence??compileJohakyuSequence({weapon:'sword',loadout});")
p='apps/review/src/nocturne/johakyu-physiology.js'
rep(p,"{mind='balanced',loadout,initialBody={}}={}","{mind='balanced',loadout,sequence=null,initialBody={}}={}")
rep(p,'createJohakyuReviewRules({mind,loadout})','createJohakyuReviewRules({mind,loadout,sequence})')
p='apps/review/src/nocturne-stage.js'
rep(p,"const rules=parameters.get('johakyu')==='p3'?", "const rules=parameters.get('johakyu')==='p4'?(await import('./nocturne/johakyu-catalog.js')).createJohakyuCatalogRules({mind:parameters.get('mind')||'balanced'}):parameters.get('johakyu')==='p3'?")
expected={
 'packages/johakyu-combat/src/motion-contract.js':'39cc0c32677bb2acac3efc80b3280ac98e9b332f2d0844fee0b2712d3e3e1ba6',
 'packages/johakyu-combat/package.json':'c89367d459ef5b633dea0e97f4e8721b830e606a1e450264da43b1abdfa290a1',
 'packages/tidebreak-combat/shared-runtime-facade.js':'bbfa8fd735c19375ee160b9d121c151093db755a8a4e0fc6b00eb33eeef9e52c',
 'apps/rinne/src/rebuild/tidebreak-pose.js':'41930d60ec3371960651c0e445a5b3e4cea47cef926f1613e3ac12432da318ca',
 'apps/rinne/src/rebuild/johakyu-technique-contract.js':'3dccaefe8d3bf9f89f1367aede42ac408a7d52b50f012a68e1b8bfd2b7957505',
 'apps/rinne/src/rebuild/combat-core.js':'e4447686577346222c796216d9179ea8dba2365153c90dce5866e01c504c8bd4',
 'apps/review/src/nocturne/johakyu-rules.js':'6ff437804fc33a5d7616c62a9a8d55a3a01d8a9c0bdc9408444acf7d3583acf9',
 'apps/review/src/nocturne/johakyu-physiology.js':'c7fd5418a392c92358e09f12156c49546ee41628f8a31d37fa8ac06e8f53c97e',
 'apps/review/src/nocturne-stage.js':'075553a9c6f6966df98e1725e1a43f3c67498f93564f1d0fae9cb2d6e0a60225',
 'apps/review/src/nocturne/johakyu-catalog.js':'9992139cf1a3efe2b44861cf22d1607d9f1809d264e8a40db44086ca9a7bf0a0',
 'packages/johakyu-combat/test/motion-contract.test.mjs':'27fd81001d9ca3e33185ea71f50dab32e7733217acd57dca65bb477d83d08e29',
 'apps/rinne/tests/johakyu-technique-contract.test.mjs':'dbf7e6b2e4dc908cd7ee4e892beb7a0b4a043f365425c5d222e0472d86919f25',
 'apps/review/tests/johakyu-catalog.test.mjs':'5dce6aaf46cf53067515a57965b6ef00ebe2af9c339c5b4bed22ab5c1a3927ea',
 'docs/rinne/JOHAKYU_P4_ACCEPTANCE.md':'172780d4342b5579e921400f66336220aabd0e5a490c3be6376b592a8e8323a4'
}
for p,digest in expected.items():
 actual=hashlib.sha256((root/p).read_bytes()).hexdigest()
 assert actual==digest,(p,actual,digest)
print('Verified exact content of',len(expected),'P4 implementation files.')
