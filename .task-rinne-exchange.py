# Task-scoped transparent source patch; removed from the product tree.
import pathlib, hashlib

def edit(path, before, after, rows):
    p=pathlib.Path(path)
    text=p.read_text()
    assert hashlib.sha256(text.encode()).hexdigest()==before, path+' base drift'
    for lo,hi,new in reversed(rows):
        text=text[:lo]+new+text[hi:]
    assert hashlib.sha256(text.encode()).hexdigest()==after, path+' output mismatch'
    p.write_text(text)

edit('packages/johakyu-combat/src/exchange-policy.js','1b9e009de34eefe9c0ccec314ad5c4f32af2298fe522a6107069863fe70a7a47','d5156f462407ab5e6a1f5b8d748df44d926ab95621f22e604b22f3aa978eda0a',[(6185,6185,"""
/** A finished secondary pair must not rewind another pair's normal offense.
 * Decisive physical interruptions still request restart after native cleanup. */
export function johakyuExchangeRestartActors(before,after,exchanges=[]){
  if(!before||!after||(before.mode===after.mode&&before.serial===after.serial)||!['read','reversal','zanshin'].includes(after.mode))return freeze([]);
  const decisive=['strong-parry','deep-hit','incapacitation'].includes(after.lastReason);
  return freeze(after.pair.filter(actorId=>decisive||!exchanges.some(row=>row.mode==='pressure'&&row.initiativeId===actorId&&!samePair(row.pair,...after.pair))));
}
""")])
edit('packages/tidebreak-combat/index.js','06b1f67f2bec369c32fb7a7b80388ace924101bbb1e93028bc0b36f45f14d4b2','1246873c23ebdeb68fec1a6650874d082efa8831740f59a06c6c732e67a67364',[
(0,75,"import {classifyJohakyuParry,johakyuExchangeRestartActors} from '@soul/johakyu-combat/exchange-policy';\n"),
(474977,475273," for(const id of johakyuExchangeRestartActors(before,row.exchange,exchangeObserver.snapshot().exchanges)){const a=exchangeActor(id);if(a)a.exchangeRestartPending=true;}\n"),
(479405,479681," const parry=classifyJohakyuParry({authored:defense==='parry'&&target.attack?.targetId===source.id,counter:defense==='counter',slip:defense==='slip',responding:pair.initiativeId!==String(target.id),phase:execution?.phase,impact:{heavy:decisiveContact(target,attack),power:attack.power}});\n")])
edit('apps/review/src/nocturne/johakyu-p7-review.js','21d2ed03d4869dc81731df095610b45fa9aec9dcbca2ac52e6dab5c83b3fb085','822a76fbbaf439d2471a5cc7931d8f92c04568e5a2864c22086cb230f50ed159',[
(512,684,"import {classifyJohakyuParry,johakyuExchangeRestartActors,createJohakyuExchangeState,johakyuExchangeSnapshot,johakyuExchangeHudState,reduceJohakyuExchange} from '@soul/johakyu-combat/exchange-policy';\n"),
(14292,14483,"    for(const id of johakyuExchangeRestartActors(before,after,[...exchangeStates.values()]))normalPending.add(id);\n"),
(15208,15499,"    return classifyJohakyuParry({authored:!reaction&&targetState?.targetId===source.id,counter:reaction&&fresh&&defenseNode?.phase==='kyu',phase:defenseNode?.phase??'uke',responding:exchangeFor(source,target).initiativeId!==target.id,capable:johakyuStageCapability(target,{weapon:'sword',kind:'parry',phase:'uke'}).allowed});\n")])
edit('packages/tidebreak-combat/test/exchange-runtime.test.mjs','76c1068ae07d129cb421e44106b32006dd0ee10de972c242da89cc91068af801','838c8842412673c0f6857d41fa53a5e8c9b98807e203951206eddc35e9bea3e7',[(5151,5151,"""
test('a secondary pair completion cannot interrupt the real primary attack',()=>{
 const r=fixture();r.configure({encounterReady:true,weapon:'sword',opponent:'group',hp:1000,enemyHp:1000,positions:{hero:{x:0,z:0,yaw:0},enemies:[{x:0,z:1.6},{x:3,z:3},{x:-3,z:3}]}});
 r._test.start('hero',recipe(r,'primary-slash','slash'));const before=r.state(),id=String(before.hero.id),secondary=String(before.enemies[1].id);
 assert.equal(before.exchanges.find(e=>e.initiativeId===id)?.mode,'pressure');
 r.observeExchange({type:'normal-start',sourceId:secondary,targetId:id,phase:'enemy'});r.observeExchange({type:'offense-complete',sourceId:secondary,targetId:id,phase:'enemy'});
 assert.equal(r.state().hero.normalRestartPending,false);
 const after=r.step(1/60);assert.equal(after.hero.execution.attackId,before.hero.execution.attackId);assert.equal(after.exchanges.find(e=>e.initiativeId===id)?.mode,'pressure');
});
""")])
edit('apps/review/tests/exchange-initiative.test.mjs','fef7097693cf0f795f7f1fe1e69214b96246e70dd5f757ccd7995656c18b9ee5','958351626a0c4e57a429fbc84136f4e35139ee534fcafa06f11a412f90c7b886',[(4821,4821,"""
test('secondary enemy completion cannot rewind the hero primary initiative',()=>{
 const scenario=create({mode:'oneVsThree'}),phases=new Map(),rank={jo:0,ha:1,kyu:2};let secondaryComplete=false,afterCompletion=false;
 for(let i=0;i<640;i++){
  const {meta:m}=scenario.step(1/60);
  secondaryComplete ||= scenario.inspect().trace.some(e=>e.type==='exchange'&&['enemy-b','enemy-c'].includes(e.sourceId)&&e.mode==='zanshin');
  if(m.exchangeMode==='pressure'&&m.initiativeId==='hero'&&m.hudState!=='maai'){
   assert.ok(rank[m.hudState]>=(phases.get(m.exchangeSerial)??-1),`secondary pair rewound primary serial ${m.exchangeSerial}`);phases.set(m.exchangeSerial,rank[m.hudState]);
   afterCompletion ||= secondaryComplete&&rank[m.hudState]>=1;
  }
 }
 assert.ok(secondaryComplete&&afterCompletion);
});
""")])
edit('apps/rinne/docs/COMBAT_EVOLUTION.md','10b92710d445c2a9d9f45cdc82ac61185d9cde7d14d378393f17ba4561b28c59','f6453d7f2b3f278ed86fda5219e53f9a48797d9886baa56f815311a44f5645d4',[(3518,3518,"""
Secondary pair completion/failure must not request a cursor restart for an actor who is still pressing in another pair. The shared restart-participant policy enforces this for native Tidebreak and the review adapter. An authored parry intent is directed at the executor's actual target lock: incidental blade contact from another opponent is a light deflection, not an invented strong reversal toward an unauthored target. Real decisive interruptions remain executor cleanup events.
""")])
