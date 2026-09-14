import { clamp } from './quality-math.js';
import { createAuthoringReview, validateAuthoringReview, AUTHORING_STAGES, AUTHORING_GUIDE } from './motion-authoring.js';
import { summarizeFrameComparisons } from './motion-frame-qa.js';
export const MOTION_QA_VERSION=1;
export const QA_FPS=60;
export const QA_CATEGORIES=Object.freeze(['model','rig','skinning / weight','motion','transition','weapon grip','body variation','clothing','hair','self intersection','silhouette','unknown']);
export const QA_CAMERAS=Object.freeze({front:0,'front-left':Math.PI/4,left:Math.PI/2,'back-left':Math.PI*3/4,back:Math.PI,'back-right':-Math.PI*3/4,right:-Math.PI/2,'front-right':-Math.PI/4});
export function qaCamera(id,{height=2.02,aspect=1,center=[0,0,0],span=0,depth=0}={}) {
  if(!Object.hasOwn(QA_CAMERAS,id)||!(height>0)||!(aspect>0)||!Number.isFinite(height+aspect+span+depth)||!Array.isArray(center)||center.length!==3||!center.every(Number.isFinite))throw new Error('Invalid QA camera');
  const fov=38,yaw=QA_CAMERAS[id],tangent=Math.tan(fov*Math.PI/360),elevation=span>0?.48:0;
  const projectedWidth=span*Math.abs(Math.cos(yaw))+depth*Math.abs(Math.sin(yaw)),projectedDepth=span*Math.abs(Math.sin(yaw))+depth*Math.abs(Math.cos(yaw));
  const distance=span>0?1.12*(Math.max(projectedWidth/(2*tangent*aspect),((height+.6)*Math.cos(elevation)+projectedDepth*Math.sin(elevation))/(2*tangent))+projectedDepth*.5):Math.max(height*1.65,height*1.05/(2*tangent*Math.min(1,aspect)));
  const target=[center[0],center[1]+height*.53,center[2]];
  return {id,version:1,fov,position:[target[0]+Math.sin(yaw)*distance*Math.cos(elevation),target[1]+(span>0?Math.sin(elevation)*distance:height*.08),target[2]+Math.cos(yaw)*distance*Math.cos(elevation)],target};
}
export const QA_SEQUENCE=Object.freeze([
  {id:'idle',label:'Idle',start:0,end:3,source:'idle-01'},
  {id:'walk',label:'歩行',start:3,end:7,source:'walk'},
  {id:'run',label:'走行',start:7,end:11,source:'run-slow'},
  {id:'draw',label:'抜刀',start:11,end:14,source:'runtime.weaponDraw'},
  {id:'guard',label:'構え',start:14,end:17,source:'runtime.guard'},
  {id:'slash',label:'斬撃',start:17,end:23,source:'authored-slash'},
  {id:'sheathe',label:'納刀',start:23,end:27,source:'runtime.weaponDraw'},
  {id:'idle-end',label:'Idleへ',start:27,end:30,source:'idle-01'}
].map(Object.freeze));
export function qaSequenceAt(seconds) {
  if(!Number.isFinite(seconds))throw new Error('Invalid QA timestamp');
  const time=clamp(seconds,0,30),row=QA_SEQUENCE.find(r=>time<r.end)??QA_SEQUENCE.at(-1);
  return {...row,time,localTime:time-row.start,frame:Math.round(time*QA_FPS),progress:(time-row.start)/(row.end-row.start)};
}
const boundedString=(s,n)=>typeof s==='string'&&s.length<=n;
const vector=(v,n)=>Array.isArray(v)&&v.length===n&&v.every(Number.isFinite);
function snapshot(s) {
  if(s===null)return;
  if(!s||!boundedString(s.revision,160)||!boundedString(s.evidence,512)||!Number.isFinite(s.timestamp)||s.timestamp<0||!Number.isInteger(s.frame)||s.frame<0||!Object.hasOwn(QA_CAMERAS,s.camera))throw new Error('Invalid QA evidence snapshot');
}
export function validateMotionPerceptionEvidence(evidence){
  if(!evidence||evidence.schema!=='motion-perception-qa'||evidence.version!==1||evidence.visualApprovalRequired!==true||!evidence.readability||evidence.readability.version!==1||!evidence.trajectory||evidence.trajectory.version!==1||!evidence.lod?.level)throw new Error('Invalid motion perception evidence');
  if(!['full','near','mid','far'].includes(evidence.lod.level)||!Number.isFinite(evidence.readability.weakestScore)||!Number.isFinite(evidence.trajectory.maxJerk))throw new Error('Invalid motion perception evidence');
  return evidence;
}
export function validateFrameComparisons(items){
  if(!Array.isArray(items)||items.length<1||items.length>240)throw new Error('Invalid frame comparison evidence');
  const summary=summarizeFrameComparisons(items);if(summary.visualApprovalRequired!==true)throw new Error('Frame comparison cannot approve visual quality');return summary;
}
export function validateMotionKinematicsEvidence(evidence){
  if(!evidence||evidence.schema!=='motion-kinematics-evidence'||evidence.version!==1||evidence.visualApprovalRequired!==true||!evidence.footSliding||!evidence.jerk||evidence.footSliding.visualApprovalRequired!==true||evidence.jerk.visualApprovalRequired!==true)throw new Error('Invalid motion kinematics evidence');
  if(!Number.isInteger(evidence.footSliding.failed)||evidence.footSliding.failed<0||!Number.isInteger(evidence.footSliding.warnings)||evidence.footSliding.warnings<0||!Array.isArray(evidence.jerk.spikes))throw new Error('Invalid motion kinematics evidence');return evidence;
}
export function validateMotionDeviceCalibration(evidence){
  if(!evidence||evidence.schema!=='motion-device-calibration'||evidence.version!==1||typeof evidence.deviceClass!=='string'||!evidence.deviceClass||typeof evidence.physicalDevice!=='boolean'||typeof evidence.measuredHardware!=='boolean'||evidence.designBudgetIsMeasurement!==false||!Number.isSafeInteger(evidence.cohort)||evidence.cohort<1||!Number.isSafeInteger(evidence.sampleCount)||evidence.sampleCount<0||!Array.isArray(evidence.layers))throw new Error('Invalid motion device calibration');
  if(evidence.measuredHardware&&(!evidence.physicalDevice||evidence.sampleCount<1||!Number.isFinite(evidence.totalMeanMs)||!evidence.userAgent))throw new Error('Invalid measured motion device calibration');return evidence;
}
export function validateQAReport(report) {
  if(!report||report.schema!=='character-motion-qa'||report.version!==1||!boundedString(report.reviewer,160)||!boundedString(report.build,160)||!Array.isArray(report.issues)||report.issues.length>500||!report.review||report.review.fps!==60||!boundedString(report.review.sequence,160)||!Array.isArray(report.review.characters)||report.review.characters.length>30)throw new Error('Invalid QA report');
  if(!['pending','approved','changes-requested'].includes(report.visualApproval))throw new Error('Invalid visual approval');
  if(!vector(report.review.viewport,2)||report.review.viewport.some(v=>v<=0)||!Number.isFinite(report.review.dpr)||report.review.dpr<=0||!boundedString(report.review.lighting,160)||!boundedString(report.review.motionRevision,160))throw new Error('Invalid QA review conditions');
  if(report.authoring!==undefined) {validateAuthoringReview(report.authoring);if(AUTHORING_STAGES.some(id=>report.authoring.stages[id].status==='reviewed')&&report.authoring.source.after!==report.review.motionRevision)throw new Error('Stale authoring source revision');}
  if(report.motionPerception!==undefined)validateMotionPerceptionEvidence(report.motionPerception);
  if(report.frameComparisons!==undefined)validateFrameComparisons(report.frameComparisons);
  if(report.motionKinematics!==undefined)validateMotionKinematicsEvidence(report.motionKinematics);
  if(report.deviceCalibration!==undefined)validateMotionDeviceCalibration(report.deviceCalibration);
  const ids=new Set();
  for(const issue of report.issues) {
    if(!boundedString(issue.id,160)||ids.has(issue.id)||!boundedString(issue.character,160)||!boundedString(issue.motion,160)||!Number.isFinite(issue.timestamp)||issue.timestamp<0||!Number.isInteger(issue.frame)||issue.frame<0||!Object.hasOwn(QA_CAMERAS,issue.camera)||!Array.isArray(issue.affectedBones)||issue.affectedBones.length>64||!issue.affectedBones.every(x=>boundedString(x,96))||!['info','warning','error'].includes(issue.severity)||!QA_CATEGORIES.includes(issue.category)||!boundedString(issue.note,4000)||!['open','needs-review','resolved','accepted'].includes(issue.status))throw new Error('Invalid QA issue');
    ids.add(issue.id);snapshot(issue.before);snapshot(issue.after);
  }
  const scan=(value,depth=0)=>{if(depth>24)throw new Error('QA nesting limit');if(typeof value==='number'&&!Number.isFinite(value))throw new Error('Non-finite QA data');if(value&&typeof value==='object')for(const v of Object.values(value))scan(v,depth+1);};scan(report);
  return report;
}
export function serializeQAReport(report) {const text=JSON.stringify(validateQAReport(report),null,2);if(text.length>1_000_000)throw new Error('QA report too large');return text;}
export function deserializeQAReport(text) {if(typeof text!=='string'||text.length>1_000_000)throw new Error('QA report too large');return validateQAReport(JSON.parse(text));}
export function createQAReport({build='',reviewer='human',review}) {return validateQAReport({schema:'character-motion-qa',version:1,build,reviewer,visualApproval:'pending',review,issues:[],authoring:createAuthoringReview()});}
export function attachMotionPerceptionQA(report,evidence){validateQAReport(report);validateMotionPerceptionEvidence(evidence);const next={...report,motionPerception:evidence};validateQAReport(next);if(next.visualApproval!==report.visualApproval)throw new Error('Motion perception cannot approve visual quality');return next;}
export function attachFrameComparisonQA(report,evidence){validateQAReport(report);validateFrameComparisons(evidence);const next={...report,frameComparisons:evidence};validateQAReport(next);if(next.visualApproval!==report.visualApproval)throw new Error('Frame comparison cannot approve visual quality');return next;}
export function attachMotionKinematicsQA(report,evidence){validateQAReport(report);validateMotionKinematicsEvidence(evidence);const next={...report,motionKinematics:evidence};validateQAReport(next);if(next.visualApproval!==report.visualApproval)throw new Error('Motion kinematics cannot approve visual quality');return next;}
export function attachMotionDeviceCalibration(report,evidence){validateQAReport(report);validateMotionDeviceCalibration(evidence);const next={...report,deviceCalibration:evidence};validateQAReport(next);if(next.visualApproval!==report.visualApproval)throw new Error('Device calibration cannot approve visual quality');return next;}
export const QA_WORKER_CONTRACT=Object.freeze({version:1,input:'review conditions + deterministic frames + previous character-motion-qa report + observed reference and before/after 1x video + optional device evidence',output:'character-motion-qa report with authoring + optional motion-perception/frame-comparison/kinematics/device evidence',repairTargets:['motion','normalization','rig adapter','weapon calibration','appearance assets','anticipation / recovery','gaze','grip','secondary motion','pose corrective','combo continuity','silhouette readability','trajectory continuity','foot sliding','linear / angular jerk','motion LOD','paired interaction','locomotion transition','personality','fatigue / injury','frame regression','device motion budget'],authoringGuide:AUTHORING_GUIDE,authoringStages:AUTHORING_STAGES,approval:'explicit visual review; numeric diagnostics, device timings, frame comparisons and record completeness cannot approve'});
