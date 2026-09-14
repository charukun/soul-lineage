import {validateMotionReviewPlan} from './motion-review-planner.js';

const freeze=value=>Object.freeze(value);
const finite=(...values)=>values.every(Number.isFinite);
const slug=value=>String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)||'motion';

export const MOTION_REPAIR_ALLOWLIST=freeze({
 'foot-slide':freeze({target:'ground-contact',parameter:'footLockDamping',range:[.72,1],step:.04,requiresRecapture:true}),
 'motion-jerk':freeze({target:'transition',parameter:'inertializationDamping',range:[.65,1.35],step:.08,requiresRecapture:true}),
 'device-motion-budget':freeze({target:'lod',parameter:'presentationTier',range:['full','near','mid','far'],requiresRecapture:true}),
 'trajectory-jitter':freeze({target:'transition',parameter:'trajectorySmoothing',range:[.6,1],step:.05,requiresRecapture:true}),
 'support-balance':freeze({target:'body-adaptation',parameter:'supportBlend',range:[.7,1],step:.04,requiresRecapture:true})
});

function metricScore(evidence={}){
 let score=0,known=0;
 const foot=evidence.footSliding;if(foot){known++;score+=(Number(foot.failed)||0)*12+(Number(foot.warnings)||0)*4+Math.max(0,Number(foot.worst?.maxDisplacement)||0)*100;}
 const jerk=evidence.jerk;if(jerk){known++;score+=(jerk.spikes?.length||0)*2+Math.min(12,Number(jerk.spikes?.[0]?.value)||0)*.02;}
 const balance=evidence.balance;if(balance){known++;score+=balance.inside===false?8+Math.max(0,-Number(balance.margin)||0)*20:0;}
 const frame=evidence.frameSummary;if(frame){known++;score+=frame.diagnosticPass===false?10+(Number(frame.worstChangedRatio)||0)*10:0;}
 const device=evidence.deviceCalibration;if(device?.measuredHardware){known++;score+=Math.max(0,(Number(device.totalMeanMs)||0)-(Number(evidence.deviceBudgetMs)||5.5));}
 return{known,score};
}

export function proposeMotionRepair(plan,{revision=plan?.revision,parameterSnapshot={}}={}){
 validateMotionReviewPlan(plan);if(typeof revision!=='string'||!revision||!parameterSnapshot||typeof parameterSnapshot!=='object')throw Error('Invalid motion repair proposal input');const task=plan.next;if(!task)return freeze({schema:'motion-repair-proposal',version:1,action:'none',reason:'no-diagnostic-findings',visualApprovalRequired:true,autoApproveAllowed:false});
 const policy=MOTION_REPAIR_ALLOWLIST[task.kind];if(!policy)return freeze({schema:'motion-repair-proposal',version:1,action:'human-review',reason:'task-not-safe-for-parameter-repair',task,visualApprovalRequired:true,autoApproveAllowed:false});
 const current=parameterSnapshot[policy.parameter]??null;let proposed=current;
 if(Array.isArray(policy.range)&&policy.range.every(Number.isFinite)&&Number.isFinite(current)){const [lo,hi]=policy.range,step=policy.step??0;proposed=Math.min(hi,Math.max(lo,current+(task.kind==='foot-slide'||task.kind==='motion-jerk'||task.kind==='trajectory-jitter'?step:-step)));}
 else if(policy.parameter==='presentationTier'){const tiers=policy.range,index=Math.max(0,tiers.indexOf(String(current)));proposed=tiers[Math.min(tiers.length-1,index+1)];}
 else if(current===null&&policy.parameter==='footLockDamping')proposed=.88;
 else if(current===null&&policy.parameter==='inertializationDamping')proposed=1.08;
 else if(current===null&&policy.parameter==='trajectorySmoothing')proposed=.82;
 else if(current===null&&policy.parameter==='supportBlend')proposed=.88;
 if(proposed===null||proposed===undefined)return freeze({schema:'motion-repair-proposal',version:1,action:'human-review',reason:'missing-current-parameter',task,visualApprovalRequired:true,autoApproveAllowed:false});
 return freeze({schema:'motion-repair-proposal',version:1,action:'parameter-repair',revision,task,change:freeze({target:policy.target,parameter:policy.parameter,before:current,after:proposed}),requiresRecapture:true,draftOnly:true,mayEditSource:true,mayEditGameplay:false,mayChangeContactTiming:false,visualApprovalRequired:true,autoApproveAllowed:false});
}

export function compareMotionRepairEvidence(before,after){
 if(!before||!after||typeof before!=='object'||typeof after!=='object')throw Error('Motion repair comparison evidence required');const a=metricScore(before),b=metricScore(after);if(!a.known||!b.known)throw Error('Motion repair comparison needs comparable diagnostics');const improvement=a.score-b.score,improved=improvement>1e-6;return freeze({version:1,beforeScore:a.score,afterScore:b.score,improvement,improved,regressed:improvement<0,visualApprovalRequired:true});
}

export function createMotionRepairDispatch({proposal,beforeEvidence,afterEvidence,sourceRevision,afterRevision}={}){
 if(!proposal||proposal.schema!=='motion-repair-proposal'||proposal.action!=='parameter-repair'||proposal.draftOnly!==true||proposal.mayChangeContactTiming!==false)throw Error('Invalid repair proposal');if(typeof sourceRevision!=='string'||!sourceRevision||typeof afterRevision!=='string'||!afterRevision||sourceRevision===afterRevision)throw Error('Distinct repair revisions required');const comparison=compareMotionRepairEvidence(beforeEvidence,afterEvidence);if(!comparison.improved)throw Error('Repair evidence did not improve');
 const target=proposal.task.kind,branch=`repair/motion-${slug(target)}-${slug(afterRevision).slice(0,10)}`,request=[`Apply the bounded motion repair already proven by deterministic recapture evidence.`,`Target diagnostic: ${target}.`,`Only change ${proposal.change.target}.${proposal.change.parameter} from ${JSON.stringify(proposal.change.before)} to ${JSON.stringify(proposal.change.after)} or the smallest equivalent implementation.`,`Preserve authored contact timing, gameplay/world/network/save authority, and existing visual approval state.`,`Re-run the same deterministic capture and Motion QA. If evidence regresses or becomes incomparable, do not mark Ready.`].join('\n');
 return freeze({schema:'motion-repair-dispatch',version:1,branch,title:`fix(motion): repair ${target}`,draft:true,request,sourceRevision,afterRevision,comparison,requiresRecapture:true,visualApprovalRequired:true,autoApproveAllowed:false,readyAllowedOnlyAfterSameConditionRecapture:true});
}
