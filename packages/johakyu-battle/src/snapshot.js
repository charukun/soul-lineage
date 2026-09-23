import {PHASE_LABELS,freeze} from './technique.js';
import {clamp,stagePoseProgress,timelinePhase,executionIdentity} from './choreography.js';
import {engagementReady} from './engagement.js';
import {readBattleActorState} from './state.js';
const clone=value=>structuredClone(value);

/** Immutable observation of one completed simulation step. No transitions here. */
export function createBattleSnapshot({actors,exchanges,battleId,clock,downedStateFor}){
  function actionView(a){
    const action=a.action;if(!action)return null;const progress=clamp(action.elapsed/action.duration);
    return {id:action.id,...executionIdentity(action),name:action.technique.name,targetId:action.targetId,step:action.stageIndex,stageLabel:action.technique.stages[action.stageIndex].label,
      chainLength:action.chainLength,chainLabel:`${PHASE_LABELS[action.phase]||'受'} · ${action.chainLength}連`,cycle:a.cursor.cycle,
      progress,poseProgress:stagePoseProgress(progress,action.choreography),duration:action.duration,choreography:action.choreography,timelinePhase:timelinePhase(progress,action.choreography),
      motion:{supported:true,kind:action.kind,weapon:action.weapon,phase:action.phase,charge:action.charge,footwork:action.footwork,...action.choreography},
      technique:action.technique,legal:true,scope:action.scope,reaction:action.reaction,finisher:action.finisher};
  }
  function snapshot(){
    const {time,revision,hitstop}=clock();
    const rows=[...actors.values()].map(a=>({id:a.id,side:a.side,self:Boolean(a.self),kind:a.kind|| (a.side==='party'?'hero':'enemy'),boss:Boolean(a.boss),position:{...a.position},yaw:a.yaw,state:readBattleActorState(a,time),
      hp:a.hp,maxHp:a.maxHp,body:Object.fromEntries(Object.entries(a.injuries).map(([part,row])=>[part,{severity:row.severity,durability:Math.round((1-row.severity)*100)}])),
      stamina:{value:a.stamina,cap:a.staminaCap},equipment:{...a.equipment},moving:a.moving,resting:false,dead:a.dead,downed:a.downed,executionState:a.executionLifecycle,executionSocket:a.executionSocket?clone(a.executionSocket):null,executorId:a.finisherClaimedBy||null,downedState:downedStateFor(a),spawnStyle:a.spawnStyle,
      phaseCue:a.phaseCue&&time<a.phaseCue.startedAt+a.phaseCue.duration?{...a.phaseCue,progress:clamp((time-a.phaseCue.startedAt)/a.phaseCue.duration)}:null,action:actionView(a),exchange:a.decision?{...a.decision}:null,cursor:{...a.cursor},posture:a.posture,engagement:{...a.engagement},combatReady:engagementReady(a.engagement),combatReadyRange:a.engagement?{ready:engagementReady(a.engagement),distance:a.engagement.distance,weaponReach:a.engagement.weaponReach,enterRange:a.engagement.enterRange,exitRange:a.engagement.exitRange}:null,combatReadyTargetId:a.engagement?.threatId||null,stagger:Math.max(0,a.staggerUntil-time),
      impulseVelocity:{...a.impulseVelocity},battleTime:time,hitstop,locomotion:a.decision?{kind:a.decision.footwork}:null,hit:time<a.staggerUntil}));
    return freeze({version:1,authority:'johakyu-battle',battleId,epoch:0,revision,time,hitstop,status:rows.some(a=>a.side==='party'&&!a.dead&&!a.downed)?'battle':'ended',actors:rows,obstacles:[],projectiles:[],exchanges:[...exchanges.values()]});
  }
  return snapshot;
}
