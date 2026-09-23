import {createJohakyuBattleRuntime,PHASES,PHASE_LABELS,compileBattleLoadout,johakyuExchangeCue,FIRST_INSPIRATION_PRESENTATION} from '@soul/johakyu-battle';
import {NOCTURNE_FIELD_BOUNDS} from '@soul/johakyu-presentation';
import {CAUSAL_ANSWER_BY_ID} from '@soul/game-data';
import {BATTLE2_LOADOUT_DEFAULT,BATTLE2_BODY_OPTIONS,normalizeBattle2Loadout,battle2LoadoutKey} from './battle2-loadout.js';
import {battle2TechniqueDefinition,BATTLE2_TECHNIQUE_CATALOG,pickBattle2Inspiration} from './battle2-technique-catalog.js';
const hash=key=>{let h=2166136261;for(const c of key){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0)/4294967295;};
const PARTS={head:'頭',torso:'胴',leftArm:'左腕',rightArm:'右腕',leftLeg:'左脚',rightLeg:'右脚'};
const FINISHER_RESPAWN_SECONDS=4;
/** Lab-only encounter/selection harness. All combat is the production shared runtime. */
export function createJohakyuP7ReviewScenario({mode='duel',duelGap=2.18,enemyLeadSeconds=0,heroStartPhase='jo',heroStartTechniqueIndex=0,checkpointSeconds=0,actorOverrides={},loadout=null,settings=null,learnedTechniqueIds=[],comboStyle='composed',fixture=null}={}){
 if(!['duel','oneVsThree'].includes(mode)||!PHASES.includes(heroStartPhase)||!Number.isFinite(duelGap)||duelGap<1||duelGap>5)throw new RangeError('Invalid battle review fixture');
 if(fixture!==null&&fixture!=='clash')throw new RangeError('Invalid battle review fixture');
 const clashFixture=fixture==='clash',fixtureLoadout=clashFixture&&!loadout?{...BATTLE2_LOADOUT_DEFAULT,technique:{jo:'basic.sword',ha:'basic.sword',kyu:'basic.sword'}}:loadout;
 const config=normalizeBattle2Loadout(fixtureLoadout||BATTLE2_LOADOUT_DEFAULT),weapon=config.equipment.weapon,known=[...new Set(learnedTechniqueIds)],knownSet=new Set(known),reviewSettings={techniqueMode:settings?.techniqueMode==='random'?'random':'set',inspirationRate:settings?.inspirationRate==='high'?'high':settings?.inspirationRate==='off'?'off':'normal'},inspirationChance=reviewSettings.inspirationRate==='high'?.45:reviewSettings.inspirationRate==='off'?0:.035;
 const mind={attack:.25,guard:.25,counter:.25,mobility:.25,survival:.25,spacing:.25},heartEffects={damage:0,mitigation:0};
 for(const id of config.heart.active){const row=CAUSAL_ANSWER_BY_ID[id];for(const [key,value]of Object.entries(row?.intent||{}))if(key in mind)mind[key]+=value;for(const key of Object.keys(heartEffects))heartEffects[key]+=Number(row?.effects?.[key])||0;}
 let encounter=1,epoch=1,serial=1,elapsed=0,nextInspirationAt=0,defeats=0,finishers=0,resumes=0,restartedAt=null,runtime,last=null,activeHeroLoadout,activity=[],history=[],replacements=[];
 const slots=mode==='duel'?['enemy-a']:['enemy-a','enemy-b','enemy-c'];
 const heroLoadout=()=>reviewSettings.techniqueMode==='random'?Object.fromEntries(PHASES.map(phase=>{const pool=[...BATTLE2_TECHNIQUE_CATALOG.map(t=>t.id),...known].filter(id=>battle2TechniqueDefinition(id,{weapon}));return[phase,pool[Math.min(pool.length-1,Math.floor(hash(encounter+':'+phase+':'+serial)*pool.length))]];})):config.technique;
 function enemyRow(slot,index,id=slot){return {id,side:'enemy',kind:'enemy',hp:46,maxHp:46,stamina:100,staminaCap:100,seed:8101+index,position:{x:index===0?0:index===1?-1.75:1.75,z:.35+duelGap},equipment:{weapon:'sword',armor:'cloth',shield:false},loadout:{jo:'basic.sword',ha:'basic.sword',kyu:'basic.sword'},staminaMultiplier:.12,damageScale:.45,mind:clashFixture?'aggressive':index%2?'counter':'balanced',readyDelay:(clashFixture?.5:.82)-enemyLeadSeconds,spawnSeconds:.7,spawnStyle:'battlebk-ground',canFinish:true,scope:'review-trial',...actorOverrides[slot]};}
 function reset(){
   activeHeroLoadout=heroLoadout();
   runtime=createJohakyuBattleRuntime({battleId:`review-battle:${battle2LoadoutKey(config)}:${encounter}`,bounds:NOCTURNE_FIELD_BOUNDS,actors:[
     {id:'hero',side:'party',self:true,kind:'hero',hp:125,maxHp:125,stamina:100,staminaCap:100,seed:73917,position:{x:0,z:.35},equipment:{weapon,armor:'heavy',shield:config.equipment.shield},loadout:activeHeroLoadout,staminaMultiplier:.12,damageScale:1.09*(1+Math.min(.7,heartEffects.damage)),mitigation:Math.min(.58,heartEffects.mitigation),mind:clashFixture?'aggressive':mind,pursuit:config.heart.active.includes('skill.pursuer'),stance:config.body.stance,zanshin:config.body.zanshin,nonlethal:config.heart.active.includes('skill.nonlethal'),finisherProfile:config.body.finisher,readyDelay:clashFixture?.5:.82,scope:'review-trial',...actorOverrides.hero},...slots.map((slot,i)=>enemyRow(slot,i))]});
   runtime.actor('hero').cursor.phaseIndex=PHASES.indexOf(heroStartPhase);runtime.actor('hero').cursor.techniqueIndex=heroStartTechniqueIndex;replacements=[];restartedAt=null;
 }
 reset();
 function record(row){activity.push(row);history.push(row);history=history.slice(-200);}
 function frame(raw){return {...raw,epoch,result:{cleared:false,defeats,returns:resumes}};}
 function meta(snapshot){const hero=snapshot.actors.find(a=>a.self),actor=runtime.actor('hero'),n=actor.loadout[PHASES[actor.cursor.phaseIndex]][actor.cursor.techniqueIndex]||actor.loadout.jo[0],action=hero.action,activeTargetId=action?.targetId||actor.targetId,exchange=snapshot.exchanges.find(e=>e.pair.includes('hero')&&e.pair.includes(activeTargetId)),
   phase=action?.phase==='uke'?PHASES[actor.cursor.phaseIndex]:action?.phase==='finisher'?'kyu':action?.phase||PHASES[actor.cursor.phaseIndex],cue=johakyuExchangeCue(exchange,{actorId:'hero',phase,reaction:!!action?.reaction}),worst=Object.entries(hero.body).sort((a,b)=>b[1].severity-a[1].severity)[0];
   return {comboStyle,sharedRuntime:'johakyu-battle',techniqueMode:reviewSettings.techniqueMode,inspirationRate:reviewSettings.inspirationRate,learnedTechniqueIds:known.slice(),mode,modeLabel:mode==='duel'?'1v1':'1v3',phase,phaseCueKey:hero.phaseCue?.key||null,phaseCuePhase:hero.phaseCue?.phase||null,phaseCueProgress:hero.phaseCue?.progress||null,phaseLabel:PHASE_LABELS[phase],hudState:hero.downed?'idle':action?.finisher?'kyu':hero.phaseCue?.phase==='zanshin'?'zanshin':cue.hudState,
     finisherName:action?.finisher?BATTLE2_BODY_OPTIONS.finisher.find(row=>row.id===(typeof actor.finisherProfile==='string'?actor.finisherProfile:actor.finisherProfile?.id))?.label||'葬焉':null,
     exchangeCue:action?.finisher?'トドメ':cue.label,exchangeIntent:hero.exchange?.intent||cue.intent,exchangeHistoryKey:cue.historyKey,exchangeMode:exchange?.mode||'read',initiativeId:exchange?.initiativeId||null,exchangeSerial:exchange?.serial||0,completedBy:exchange?.completedBy||null,
     actionId:action?.id||null,actionName:action?.name||null,actionMotion:action?.kind||null,actionKind:action?.finisher?'finisher':action?.reaction?'reaction':action?.phase||null,techniqueSelection:action&&!action.finisher&&!action.reaction&&action.phase!=='one'?activeHeroLoadout[phase]:null,techniqueId:action?.techniqueId||n.id,techniqueName:action?.name||n.name,techniqueIndex:action?.techniqueIndex??actor.cursor.techniqueIndex,chainLength:action?.chainLength||actor.loadout[phase]?.length||1,chainLabel:action?.chainLabel||`${PHASE_LABELS[phase]} · 1連`,stageIndex:action?.stageIndex??actor.cursor.stageIndex,stageLabel:action?.stageLabel||n.stages[actor.cursor.stageIndex]?.label,
     cycle:actor.cursor.cycle,stamina:Math.round(hero.stamina.value),injuryPart:PARTS[worst[0]],injuryPercent:Math.round(worst[1].severity*100),party:1,enemies:snapshot.actors.filter(a=>a.side==='enemy'&&!a.dead&&!a.downed).length,defeats,finishers,pendingFinishers:snapshot.actors.filter(a=>a.side==='enemy'&&a.downed).length,resumes,encounter,epoch,battleId:snapshot.battleId,activity:activity.slice(),respawnIn:replacements.length?Math.max(0,Math.min(...replacements.map(r=>r.at))-elapsed):null};
 }
 function heroRespawnPoint(){
   const bounds=NOCTURNE_FIELD_BOUNDS,margin=1.5,enemies=runtime.snapshot().actors.filter(row=>row.side==='enemy'&&!row.dead&&!row.downed);let best=null;
   for(let i=0;i<12;i++){
     const key=`hero-respawn:${encounter+1}:${i}`,x=bounds.minX+margin+hash(key+':x')*(bounds.maxX-bounds.minX-margin*2),z=bounds.minZ+margin+hash(key+':z')*(bounds.maxZ-bounds.minZ-margin*2);
     const nearest=enemies.length?Math.min(...enemies.map(row=>Math.hypot(x-row.position.x,z-row.position.z))):99,score=nearest+hash(key+':tie')*.15;if(!best||score>best.score)best={x,z,score};
   }
   return{x:Number(best.x.toFixed(3)),z:Number(best.z.toFixed(3))};
 }
 function enemyRespawnPoint(slot,index,id){
   const bounds=NOCTURNE_FIELD_BOUNDS,margin=1.35,hero=runtime.actor('hero'),others=runtime.snapshot().actors.filter(row=>row.side==='enemy'&&!row.dead&&!row.downed&&row.id!==id),candidates=[];
   for(let i=0;i<24;i++){
     const key=`enemy-respawn:${slot}:${id}:${serial}:${i}`,t=.08+hash(key+':t')*.84,inset=margin+hash(key+':inset')*.7,side=i%4;
     let x,z;if(side===0){x=bounds.minX+inset;z=bounds.minZ+(bounds.maxZ-bounds.minZ)*t;}else if(side===1){x=bounds.maxX-inset;z=bounds.minZ+(bounds.maxZ-bounds.minZ)*t;}else if(side===2){z=bounds.minZ+inset;x=bounds.minX+(bounds.maxX-bounds.minX)*t;}else{z=bounds.maxZ-inset;x=bounds.minX+(bounds.maxX-bounds.minX)*t;}
     const heroDistance=hero?Math.hypot(x-hero.position.x,z-hero.position.z):0,nearestOther=others.length?Math.min(...others.map(row=>Math.hypot(x-row.position.x,z-row.position.z))):8,score=heroDistance+Math.min(8,nearestOther)*.22+hash(key+':tie')*.08;candidates.push({x,z,score});
   }
   const best=candidates.sort((a,b)=>b.score-a.score)[0];return{x:Number(best.x.toFixed(3)),z:Number(best.z.toFixed(3))};
 }
 function lifecycle(){
  for(const entry of replacements.filter(r=>r.at<=elapsed)){
    const hero=runtime.actor('hero');
    if(hero?.phaseCue?.phase==='zanshin'&&!hero.downed&&!hero.dead){entry.at=elapsed+.2;continue;}
    const rows=runtime.snapshot().actors.filter(a=>a.id!==entry.id).map(a=>runtime.actor(a.id)),index=slots.indexOf(entry.slot),id=entry.recover?entry.id:entry.slot+'#'+(++serial);const revived=enemyRow(entry.slot,index,id);if(entry.recover){revived.spawnSeconds=0;revived.spawnStyle=null;revived.hp=revived.maxHp*.28;revived.injuries=Object.fromEntries(Object.keys(PARTS).map(p=>[p,{severity:0,at:0}]));revived.downed=false;revived.dead=false;}else revived.position=enemyRespawnPoint(entry.slot,index,id);runtime.sync([...rows,revived]);record({type:entry.recover?'enemy-recovered':'enemy-spawn',actorId:id,slot:entry.slot,position:{...revived.position}});
  }replacements=replacements.filter(r=>r.at>elapsed);
  const hero=runtime.actor('hero'),enemyFinishingHero=runtime.snapshot().actors.some(row=>row.side==='enemy'&&row.action?.finisher&&row.action.targetId==='hero');if(hero.downed||hero.dead){restartedAt??=elapsed+3;if(!enemyFinishingHero&&elapsed>=restartedAt){
    // Recover this actor in place: a fresh battle identity teleports the player and resets the camera.
    const at=heroRespawnPoint();hero.hp=hero.maxHp;hero.dead=false;hero.downed=false;hero.incapacitated=false;
    hero.injuries=Object.fromEntries(Object.keys(PARTS).map(p=>[p,{severity:0,at:0}]));hero.action=null;hero.phaseCue=null;hero.pendingZanshin=false;
    hero.cursor={phaseIndex:0,techniqueIndex:0,stageIndex:0,cycle:hero.cursor.cycle+1};hero.decision=null;hero.chainTargetId=null;hero.chainLastAt=null;
    hero.readyAt=runtime.snapshot().time+.6;hero.position=at;restartedAt=null;encounter++;record({type:'hero-recovered',encounter,position:at});
  }}else restartedAt=null;
 }
 function step(dt=1/60,physicalContacts=[],movement=null){
   activity=[];elapsed+=dt;lifecycle();runtime.setMovement('hero',movement);if(checkpointSeconds>0&&!resumes&&elapsed>=checkpointSeconds){const saved=runtime.snapshot().actors.map(a=>structuredClone(runtime.actor(a.id)));runtime=createJohakyuBattleRuntime({battleId:runtime.snapshot().battleId+':resume',bounds:NOCTURNE_FIELD_BOUNDS,actors:saved});resumes++;epoch++;record({type:'resume',epoch});}const result=runtime.step(dt,physicalContacts||[]);
   for(const event of result.events){record(event);
     if(event.type==='actor-downed'&&event.targetId!=='hero'){defeats++;if(config.heart.active.includes('skill.nonlethal'))replacements.push({id:event.targetId,slot:event.targetId.split('#')[0],at:elapsed+6.5,recover:true});}
     if(event.type==='finisher'&&event.sourceId==='hero')finishers++;
     if(event.type==='finisher-complete'&&event.sourceId==='hero'&&!replacements.some(r=>r.id===event.targetId))replacements.push({id:event.targetId,slot:event.targetId.split('#')[0],at:elapsed+FINISHER_RESPAWN_SECONDS});
     if(event.type==='player-hit'&&elapsed>=nextInspirationAt&&hash(event.id)<inspirationChance){
       const hero=runtime.actor('hero'),phase=PHASES.includes(event.phase)?event.phase:PHASES[hero.cursor.phaseIndex],targetId=event.targetId||hero.targetId;let draw=0;
       const picked=pickBattle2Inspiration({weapon,phase,seenIds:known,encounterMode:mode==='oneVsThree'?'one-v-three':'duel',spectacle:reviewSettings.inspirationRate==='high',mastered:PHASES.every(slot=>!String(config.technique[slot]).startsWith('basic.')),seed:Math.floor(hash(event.id+':name')*0xffffffff)},()=>hash(`${event.id}:pick:${draw++}`));
       const definition=picked&&battle2TechniqueDefinition(picked.id,{weapon});
       if(picked&&definition&&targetId&&runtime.inspire('hero',{...definition,name:picked.name},targetId,phase)){
         known.push(picked.id);knownSet.add(picked.id);nextInspirationAt=elapsed+FIRST_INSPIRATION_PRESENTATION.inspirationCooldownSeconds;config.technique[phase]=picked.id;activeHeroLoadout={...activeHeroLoadout,[phase]:picked.id};hero.loadout=compileBattleLoadout(activeHeroLoadout,weapon);
         record({id:`${event.id}:inspiration:${picked.id}`,time:elapsed,type:'inspiration',actorId:'hero',sourceId:'hero',targetId,firstInspirationPresentation:FIRST_INSPIRATION_PRESENTATION,techniqueId:picked.id,techniqueName:picked.name,phase,grade:picked.grade,equipped:true,firstCast:true,triggerEventId:event.id,scope:'review-trial'});
       }
     }
   }
   const snapshot=frame(result.frame);last={frame:snapshot,events:[...result.events,...activity.filter(row=>row.type==='inspiration')],meta:meta(snapshot)};return last;
 }
 function inspect(){const snapshot=last?.frame||frame(runtime.snapshot());return {...(last||{frame:snapshot,events:[],meta:meta(snapshot)}),trace:history.slice(),exchanges:runtime.inspect().exchanges};}
 return Object.freeze({step,inspect,composition:{hero:compileBattleLoadout(config.technique,weapon),enemy:compileBattleLoadout({},'sword')},loadout:config,settings:reviewSettings,get learnedTechniqueIds(){return known.slice();}});
}
