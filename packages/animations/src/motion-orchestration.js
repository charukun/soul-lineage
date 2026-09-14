const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const finite=(...v)=>v.every(Number.isFinite);
const freeze=o=>Object.freeze(o);
const xyz2=p=>Array.isArray(p)?{x:p[0],z:p[1]??p[2]??0}:p;
const angleDelta=(from,to)=>{let d=(to-from)%(Math.PI*2);if(d>Math.PI)d-=Math.PI*2;if(d<-Math.PI)d+=Math.PI*2;return d;};
const hash=value=>{let h=2166136261;for(const c of String(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const unit=n=>(n>>>0)/4294967295;

export const MOTION_ORCHESTRATION_VERSION=1;
const w=(scope,mode='additive')=>freeze({scope,mode});
export const MOTION_LAYER_CONTRACTS=freeze([
 freeze({id:'source-pose',dependsOn:[],writes:[w('skeleton-base','exclusive')]}),
 freeze({id:'body-adaptation',dependsOn:['source-pose'],writes:[w('skeleton-proportions','exclusive')]}),
 freeze({id:'personality',dependsOn:['body-adaptation'],writes:[w('skeleton-presentation')]}),
 freeze({id:'condition',dependsOn:['personality'],writes:[w('skeleton-presentation')]}),
 freeze({id:'locomotion-intent',dependsOn:['condition'],writes:[w('skeleton-presentation')]}),
 freeze({id:'interaction',dependsOn:['locomotion-intent'],writes:[w('visual-root','exclusive'),w('returned-world-samples','exclusive')]}),
 freeze({id:'ground-contact',dependsOn:['interaction'],writes:[w('foot-contact','exclusive'),w('pelvis-grounding','exclusive')]}),
 freeze({id:'weapon-sockets',dependsOn:['ground-contact'],writes:[w('weapon-sockets','exclusive')]}),
 freeze({id:'secondary',dependsOn:['weapon-sockets'],writes:[w('secondary-bones')]}),
 freeze({id:'qa',dependsOn:['secondary'],writes:[]})
]);
export const MOTION_FORBIDDEN_PRESENTATION_SCOPES=freeze(['world-transform','damage','contact-authority','network-authority','save-state']);

export function compileMotionLayerPlan({layers=MOTION_LAYER_CONTRACTS}={}){
 if(!Array.isArray(layers)||!layers.length)throw Error('Invalid motion layers');
 const byId=new Map();for(const layer of layers){if(!layer||typeof layer.id!=='string'||!layer.id||byId.has(layer.id)||!Array.isArray(layer.dependsOn)||!Array.isArray(layer.writes))throw Error('Invalid motion layer');byId.set(layer.id,layer);for(const write of layer.writes){if(!write||typeof write.scope!=='string'||!['additive','exclusive'].includes(write.mode)||MOTION_FORBIDDEN_PRESENTATION_SCOPES.includes(write.scope))throw Error(`Forbidden or invalid motion writer: ${layer.id}`);}}
 const owners=new Map();for(const layer of layers)for(const write of layer.writes)if(write.mode==='exclusive'){if(owners.has(write.scope))throw Error(`Motion writer conflict: ${write.scope}`);owners.set(write.scope,layer.id);}
 const visiting=new Set(),done=new Set(),order=[];function visit(id){if(done.has(id))return;if(visiting.has(id))throw Error('Motion layer cycle');const layer=byId.get(id);if(!layer)throw Error(`Unknown motion dependency: ${id}`);visiting.add(id);for(const dep of layer.dependsOn){if(!byId.has(dep))throw Error(`Unknown motion dependency: ${dep}`);visit(dep);}visiting.delete(id);done.add(id);order.push(id);}for(const layer of layers)visit(layer.id);
 return freeze({version:1,order:freeze(order),exclusiveOwners:freeze(Object.fromEntries(owners)),presentationOnly:true});
}

export const SEMANTIC_MOTION_EVENTS=freeze(['foot-plant','weight-transfer','anticipation-end','weapon-release','contact','follow-through','handoff']);
export function createSemanticMotionTimeline({duration,contactPhase=.5,activeStart=.42,activeEnd=.58,plantPhase=.12,handoffPhase=.9}={}){
 if(!finite(duration,contactPhase,activeStart,activeEnd,plantPhase,handoffPhase)||duration<=0||![contactPhase,activeStart,activeEnd,plantPhase,handoffPhase].every(x=>x>=0&&x<=1)||activeStart>contactPhase||contactPhase>activeEnd)throw Error('Invalid semantic motion timeline');
 const phases={
  'foot-plant':plantPhase,
  'weight-transfer':clamp((plantPhase+activeStart)*.5),
  'anticipation-end':activeStart,
  'weapon-release':clamp(activeStart+(contactPhase-activeStart)*.38),
  contact:contactPhase,
  'follow-through':clamp(activeEnd+(1-activeEnd)*.32),
  handoff:Math.max(activeEnd,handoffPhase)
 };
 const events=SEMANTIC_MOTION_EVENTS.map(name=>freeze({name,phase:phases[name],seconds:phases[name]*duration,authoritative:name==='contact'?false:false})).sort((a,b)=>a.phase-b.phase||a.name.localeCompare(b.name));
 return freeze({version:1,duration,contactPhase,activeStart,activeEnd,events:freeze(events),contactAuthority:'gameplay-external'});
}
export function semanticEventsBetween(timeline,fromSeconds,toSeconds){
 if(!timeline||timeline.version!==1||!finite(fromSeconds,toSeconds)||toSeconds<fromSeconds)throw Error('Invalid semantic event query');return freeze(timeline.events.filter(e=>e.seconds>fromSeconds&&e.seconds<=toSeconds));
}

export function predictMotionTrajectory({position={x:0,z:0},velocity={x:0,z:0},intent={x:0,z:0},yaw=0,horizon=.45,steps=4,maxAcceleration=7,maxSpeed=6}={}){
 const p=xyz2(position),v=xyz2(velocity),i=xyz2(intent);if(!p||!v||!i||!finite(p.x,p.z,v.x,v.z,i.x,i.z,yaw,horizon,steps,maxAcceleration,maxSpeed)||horizon<=0||horizon>.75||!Number.isInteger(steps)||steps<2||steps>8||maxAcceleration<=0||maxSpeed<=0)throw Error('Invalid predictive trajectory');
 let x=p.x,z=p.z,vx=v.x,vz=v.z;const dt=horizon/steps,mag=Math.hypot(i.x,i.z),targetSpeed=Math.min(maxSpeed,mag),tx=mag>1e-9?i.x/mag*targetSpeed:0,tz=mag>1e-9?i.z/mag*targetSpeed:0,points=[];
 for(let n=1;n<=steps;n++){let ax=tx-vx,az=tz-vz,am=Math.hypot(ax,az),limit=maxAcceleration*dt;if(am>limit){ax*=limit/am;az*=limit/am;}vx+=ax;vz+=az;const sm=Math.hypot(vx,vz);if(sm>maxSpeed){vx*=maxSpeed/sm;vz*=maxSpeed/sm;}x+=vx*dt;z+=vz*dt;points.push(freeze({t:n*dt,x,z,vx,vz}));}
 return freeze({version:1,origin:freeze({x:p.x,z:p.z}),yaw,horizon,points:freeze(points),advisory:true});
}

function trajectoryError(query,candidate){const qa=query.trajectory?.points??query.trajectory??[],ca=candidate.trajectory?.points??candidate.trajectory??[];if(!qa.length||!ca.length)return 0;const count=Math.min(qa.length,ca.length);let sum=0;for(let n=0;n<count;n++){const q=xyz2(qa[n]),c=xyz2(ca[n]);sum+=Math.hypot((q?.x??0)-(c?.x??0),(q?.z??0)-(c?.z??0));}return sum/count;}
export function rankPoseCandidates({query,candidates,weights={trajectory:1.6,speed:.8,facing:.7,support:.45,state:.65,continuity:.55}}={}){
 if(!query||!Array.isArray(candidates)||!candidates.length)throw Error('Invalid pose search');const rows=candidates.map(candidate=>{if(!candidate||candidate.id==null)throw Error('Invalid pose candidate');const speed=Math.abs((Number(candidate.speed)||0)-(Number(query.speed)||0)),facing=Math.abs(angleDelta(Number(query.yaw)||0,Number(candidate.yaw)||0)),support=query.supportSide&&candidate.supportSide&&query.supportSide!==candidate.supportSide?1:0,state=query.state&&candidate.state&&query.state!==candidate.state?1:0,continuity=1-clamp(Number.isFinite(candidate.continuity)?candidate.continuity:0),trajectory=trajectoryError(query,candidate),score=trajectory*(weights.trajectory??1)+speed*(weights.speed??1)+facing*(weights.facing??1)+support*(weights.support??1)+state*(weights.state??1)+continuity*(weights.continuity??1);return freeze({id:String(candidate.id),score,terms:freeze({trajectory,speed,facing,support,state,continuity}),candidate});}).sort((a,b)=>a.score-b.score||a.id.localeCompare(b.id));return freeze(rows);}
export function selectPoseCandidate(options){return rankPoseCandidates(options)[0]??null;}

export function motionVariationProfile(seed){const h=hash(seed),r=salt=>unit(hash(`${h}:${salt}`));return freeze({version:1,seed:String(seed),startFoot:r('foot')<.5?'left':'right',idlePhase:r('idle'),recoveryAmplitude:.92+r('recovery')*.16,stanceScale:.94+r('stance')*.12,turnScale:.92+r('turn')*.16,gaitPhase:r('gait'),contactTimingScale:1,authoritativeTimingChanged:false});}

export const INTERACTION_SCHEMAS=freeze(Object.fromEntries(Object.entries({
 'talk-close':{anchors:['head','head'],distance:[.75,1.45],maxYaw:.8,release:'handoff'},handshake:{anchors:['rightHand','rightHand'],distance:[.6,1.15],maxYaw:.65,release:'handoff'},hug:{anchors:['chest','chest'],distance:[.45,1.0],maxYaw:.55,release:'handoff'},'carry-child':{anchors:['chest','hips'],distance:[.15,.8],maxYaw:.65,release:'handoff'},grab:{anchors:['rightHand','chest'],distance:[.3,.9],maxYaw:.75,release:'handoff'},'blade-clash':{anchors:['weaponTip','weaponTip'],distance:[.55,1.65],maxYaw:1.1,release:'follow-through'},'eat-target':{anchors:['mouth','chest'],distance:[.15,.9],maxYaw:.8,release:'handoff'},grapple:{anchors:['chest','chest'],distance:[.25,.9],maxYaw:.7,release:'handoff'}
}).map(([id,s])=>[id,freeze({id,...s,presentationOnly:true,explicitPartnerRequired:true})]))));
export function resolveInteractionSchema(id,{partner,anchors}={}){const schema=INTERACTION_SCHEMAS[id];if(!schema)throw Error('Unknown interaction schema');if(!partner||partner.id==null||!anchors||!anchors.self||!anchors.partner)throw Error('Explicit interaction partner and anchors required');return freeze({version:1,schema,partnerId:String(partner.id),anchors:freeze({self:anchors.self,partner:anchors.partner}),inferred:false});}

export function weaponContactConstraint({normal={x:0,z:1},penetration=0,relativeSpeed=0,weaponMass=1,maxDeflection=.14,maxRecoil=.08}={}){const n=xyz2(normal);if(!n||!finite(n.x,n.z,penetration,relativeSpeed,weaponMass,maxDeflection,maxRecoil)||penetration<0||weaponMass<=0||maxDeflection<0||maxRecoil<0)throw Error('Invalid weapon contact constraint');const len=Math.hypot(n.x,n.z)||1,nx=n.x/len,nz=n.z/len,energy=clamp(penetration*3+Math.abs(relativeSpeed)*.025,0,1),deflection=clamp(energy*.12/Math.sqrt(weaponMass),0,maxDeflection),recoil=clamp(energy*.055/weaponMass,0,maxRecoil);return freeze({version:1,normal:freeze({x:nx,z:nz}),deflection,recoilOffset:freeze({x:-nx*recoil,z:-nz*recoil}),presentationOnly:true,damageAuthority:false});}

export function ragdollBlendBridge({requested=false,physicsAvailable=false,impact=0,recovery=0}={}){if(typeof requested!=='boolean'||typeof physicsAvailable!=='boolean'||!finite(impact,recovery))throw Error('Invalid ragdoll bridge');if(!requested)return freeze({version:1,state:'animation',enabled:false,reason:null});if(!physicsAvailable)return freeze({version:1,state:'animation',enabled:false,reason:'physics-adapter-unavailable'});return freeze({version:1,state:recovery>0?'recovering':'physics',enabled:true,physicsWeight:clamp(recovery>0?1-recovery:impact),animationWeight:clamp(recovery),presentationOnly:true});}

export function personalSpaceSteering({position={x:0,z:0},preferredVelocity={x:0,z:0},neighbors=[],radius=.7,maxSuggestion=.35}={}){const p=xyz2(position),v=xyz2(preferredVelocity);if(!p||!v||!Array.isArray(neighbors)||!finite(p.x,p.z,v.x,v.z,radius,maxSuggestion)||radius<=0||maxSuggestion<0)throw Error('Invalid personal space steering');let sx=0,sz=0;for(const raw of neighbors){const n=xyz2(raw);if(!n||!finite(n.x,n.z))continue;const dx=p.x-n.x,dz=p.z-n.z,d=Math.hypot(dx,dz);if(d<1e-6||d>=radius)continue;const w=(1-d/radius);sx+=dx/d*w;sz+=dz/d*w;}const m=Math.hypot(sx,sz);if(m>maxSuggestion&&m>1e-9){sx*=maxSuggestion/m;sz*=maxSuggestion/m;}return freeze({version:1,preferred:freeze({x:v.x,z:v.z}),suggestion:freeze({x:sx,z:sz}),advisory:true,worldAuthority:false});}
