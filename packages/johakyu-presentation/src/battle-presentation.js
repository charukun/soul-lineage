import {resolveJohakyuMotion,resolveJohakyuLocomotion} from '@soul/johakyu-presentation/motion-bindings';
import {resolveTechniquePresentation} from './technique-presentation.js';
const STAGE_OVERRIDES=Object.freeze({
 'action.counter:0':{archetype:'counter',trailScale:.25,impactScale:.72,role:'blade-spark'},
 'action.counter:1':{archetype:'counter',trailScale:.5,impactScale:.86,role:'counter-turn'},
 'action.counter:2':{archetype:'precision',trailScale:.42,impactScale:.95,role:'forward-pierce'},
 'action.crash:0':{archetype:'heavy',trailScale:.32,impactScale:.72,role:'bash-shock'},
 'action.crash:1':{archetype:'heavy',trailScale:.92,impactScale:1.2,role:'posture-break'},
 'action.crash:2':{archetype:'sweep',trailScale:.98,impactScale:1.08,role:'diagonal-release'}
});
/** Technique/stage override -> kind binding -> archetype styling. Unsupported stays unsupported. */
export function resolveBattlePresentation({techniqueId,stageIndex=0,weapon='sword',phase='jo',kind,footwork='stay',charge='none',grade='normal',choreography=null}={}){
 const motion=resolveJohakyuMotion({weapon,kind,charge,phase:phase==='finisher'?'finisher':phase});
 if(!motion.supported)return {supported:false,reason:motion.reason,techniqueId,stageIndex,motion};
 const standard=resolveTechniquePresentation({techniqueId,weapon,phase,grade,steps:[{kind,footwork,charge}]}),specific=STAGE_OVERRIDES[`${techniqueId}:${stageIndex}`];
 const profile=structuredClone(standard);
 if(specific){profile.archetype=specific.archetype;profile.vfx.trail.scale=specific.trailScale;profile.vfx.impact.scale=specific.impactScale;profile.contact.role=specific.role;}
 // Defense never borrows an archetype's unrelated attack clip. The full authored
 // sample and shared pose progress retain exactly the same contact anchor.
 return {supported:true,...profile,techniqueId,stageIndex,kind,footwork,charge,clip:motion.clip,
   segment:{...profile.motion.segments[0],sampleStart:0,sampleEnd:1},motion:{...motion,...(choreography||{})},
   contact:{...profile.contact,contactProgress:choreography?.contactProgress??motion.contactProgress}};
}
export function presentBattleAction(action){
 if(!action)return null;
 let presentation=action.choreography&&presentationCache.get(action.choreography);
 if(!presentation){presentation=resolveBattlePresentation({...action,weapon:action.weapon||action.motion?.weapon,kind:action.kind||action.motion?.kind,grade:action.technique?.grade,phase:action.phase});if(action.choreography)presentationCache.set(action.choreography,presentation);}
 return {...action,motion:presentation.motion,legal:action.legal&&presentation.supported,presentation,presentationClip:presentation.clip};
}
const presentationCache=new WeakMap();
const PHASE_PRESENTATION={jo:{clip:'Jump_Start',poseStart:.04,poseEnd:.56,glow:'#ff8f32'},ha:{clip:'Blocking',poseStart:.08,poseEnd:.76,glow:'#ffa447'},kyu:{clip:'Spellcast_Raise',poseStart:.1,poseEnd:.7,glow:'#ffbb63'},zanshin:{clip:'Idle',poseStart:.08,poseEnd:.34,glow:'#e4c984'}};
export function presentPhaseCue(cue){return cue?{...cue,...PHASE_PRESENTATION[cue.phase]}:null;}
export function presentBattleFrame(frame){return {...frame,actors:frame.actors.map(row=>({...row,phaseCue:presentPhaseCue(row.phaseCue),action:presentBattleAction(row.action),locomotion:row.locomotion?{...row.locomotion,...resolveJohakyuLocomotion({footwork:row.locomotion.kind})}:null}))};}
export function presentBattleEvents(events){return events.map(event=>{if(!event.techniqueId||!event.kind)return event;const presentation=resolveBattlePresentation(event),otherPresentation=event.type==='clash'&&event.otherTechniqueId&&event.otherKind?resolveBattlePresentation({techniqueId:event.otherTechniqueId,stageIndex:event.otherStageIndex??0,weapon:event.otherWeapon||'sword',phase:event.otherPhase||'ha',kind:event.otherKind,footwork:'stay',charge:'none'}):null;return {...event,presentation,...(otherPresentation?{otherPresentation}:{})};});}
