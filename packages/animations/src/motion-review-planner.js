const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const finite=(...v)=>v.every(Number.isFinite);
const freeze=o=>Object.freeze(o);
export const MOTION_BUDGET_TARGETS=freeze({desktop60:4,mobile30:6,'pixel-fold-class-30':5.5});

export function createMotionProfiler({budgetMs=MOTION_BUDGET_TARGETS.mobile30}={}){
 if(!Number.isFinite(budgetMs)||budgetMs<=0)throw Error('Invalid motion profiler budget');const rows=new Map();
 return freeze({
  record(layer,ms){if(typeof layer!=='string'||!layer||!finite(ms)||ms<0)throw Error('Invalid motion profiler sample');const row=rows.get(layer)??{count:0,total:0,max:0};row.count++;row.total+=ms;row.max=Math.max(row.max,ms);rows.set(layer,row);},
  reset(){rows.clear();},
  snapshot(){const layers=[...rows].map(([layer,r])=>freeze({layer,count:r.count,meanMs:r.count?r.total/r.count:0,maxMs:r.max})).sort((a,b)=>b.meanMs-a.meanMs||a.layer.localeCompare(b.layer)),totalMeanMs=layers.reduce((n,r)=>n+r.meanMs,0),overBudget=totalMeanMs>budgetMs,ratio=budgetMs>0?totalMeanMs/budgetMs:Infinity,lodRecommendation=ratio>1.6?'far':ratio>1.25?'mid':ratio>1?'near':'full';return freeze({version:1,budgetMs,totalMeanMs,overBudget,lodRecommendation,layers:freeze(layers),authority:'presentation-only',mayDisableGameplay:false});}
 });
}

function severityScore(item){return item?.severity==='error'?4:item?.severity==='warning'?2:item?.pass===false?3:1;}
export function buildMotionReviewPlan({revision,evidence={},issues=[]}={}){
 if(typeof revision!=='string'||!revision||!evidence||typeof evidence!=='object'||!Array.isArray(issues))throw Error('Invalid motion review inputs');const tasks=[];
 const push=(kind,priority,detail)=>tasks.push(freeze({kind,priority,detail}));
 const frame=evidence.frameSummary;if(frame&&frame.diagnosticPass===false)push('frame-regression',4,{failed:frame.failed,worstChangedRatio:frame.worstChangedRatio,worstJointDelta:frame.worstJointDelta});
 const perception=evidence.perception;if(perception?.readability?.weakestScore!==undefined&&perception.readability.weakestScore<.45)push('silhouette-readability',3,{score:perception.readability.weakestScore});
 if(perception?.trajectory?.jitterFrames?.length)push('trajectory-jitter',3,{frames:[...perception.trajectory.jitterFrames].slice(0,12)});
 const balance=evidence.balance;if(balance?.inside===false)push('support-balance',4,{margin:balance.margin});
 const collision=evidence.collision;if(collision?.penetration>0)push('collision-contact',4,{penetration:collision.penetration});
 const semantic=evidence.semantic;if(semantic?.contactMismatch===true)push('semantic-contact-mismatch',5,{expected:semantic.expected,actual:semantic.actual});
 for(const issue of issues)push('existing-issue',severityScore(issue),{id:issue.id??null,category:issue.category??'unknown',note:String(issue.note??'').slice(0,500)});
 tasks.sort((a,b)=>b.priority-a.priority||a.kind.localeCompare(b.kind));return freeze({schema:'motion-review-plan',version:1,revision,visualApprovalRequired:true,autoEditAllowed:false,autoApproveAllowed:false,tasks:freeze(tasks),next:tasks[0]??null});
}
export function validateMotionReviewPlan(plan){
 if(!plan||plan.schema!=='motion-review-plan'||plan.version!==1||typeof plan.revision!=='string'||!plan.revision||plan.visualApprovalRequired!==true||plan.autoEditAllowed!==false||plan.autoApproveAllowed!==false||!Array.isArray(plan.tasks))throw Error('Invalid motion review plan');
 for(const task of plan.tasks)if(!task||typeof task.kind!=='string'||!Number.isInteger(task.priority)||task.priority<1||task.priority>5||!task.detail||typeof task.detail!=='object')throw Error('Invalid motion review task');
 if(plan.next!==null&&plan.next!==undefined&&!plan.tasks.includes(plan.next)&&!plan.tasks.some(task=>task.kind===plan.next.kind&&task.priority===plan.next.priority))throw Error('Invalid motion review next task');return plan;
}
export function attachMotionReviewPlan(report,plan){
 if(!report||report.schema!=='character-motion-qa'||report.version!==1||!['pending','approved','changes-requested'].includes(report.visualApproval))throw Error('Invalid QA report');validateMotionReviewPlan(plan);const next={...report,motionReviewPlan:plan};if(next.visualApproval!==report.visualApproval)throw Error('Motion review plan cannot alter visual approval');return next;
}

export function motionDebugOverlayData({centerOfMass=null,supports=[],trajectory=null,interaction=null,hitDirection=null,footLocks=null,semanticEvents=[]}={}){
 if(!Array.isArray(supports)||!Array.isArray(semanticEvents))throw Error('Invalid motion debug overlay');const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z)?freeze({x:p.x,y:Number.isFinite(p.y)?p.y:0,z:p.z}):null;
 const com=point(centerOfMass),supportPoints=supports.map(point).filter(Boolean),future=(trajectory?.points??[]).map(point).filter(Boolean),hit=hitDirection&&finite(hitDirection.x,hitDirection.z)?freeze({x:hitDirection.x,z:hitDirection.z}):null;
 return freeze({version:1,centerOfMass:com,supports:freeze(supportPoints),futureTrajectory:freeze(future),interaction:interaction?freeze({schema:interaction.schema?.id??interaction.schema??null,anchors:interaction.anchors??null,partnerId:interaction.partnerId??null}):null,hitDirection:hit,footLocks:footLocks??null,semanticEvents:freeze(semanticEvents.map(e=>freeze({name:e.name,phase:e.phase,seconds:e.seconds}))),diagnosticOnly:true});
}

export function reviewRepairRequest(plan){validateMotionReviewPlan(plan);if(!plan.next)return freeze({version:1,action:'none',reason:'no-diagnostic-findings',visualApprovalRequired:true});return freeze({version:1,action:'review',target:plan.next.kind,priority:plan.next.priority,detail:plan.next.detail,requiresRecapture:true,visualApprovalRequired:true,mayEditSource:false});}
