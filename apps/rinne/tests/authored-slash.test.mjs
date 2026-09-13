import test from 'node:test';
import {rawClipFromNormalized,sampleRawClip} from '../src/review/pose-transfer.js';
import {SHORT_SWORD_SEQUENCE,createSwordSequence,swordSequenceFrame,applySwordSequence} from '../public/simulator/src/sword-sequence.js';
import {SWORD_MOVES,swordClipInSeconds} from '../public/simulator/src/authored-sword.js';
import {AUTHORED_SWORD_KINDS,sampleSwordPose} from '../public/simulator/src/authored-sword.js';
import {PERFORMANCE_SECONDS,PERFORMANCE_EVENTS,PERFORMANCE_PHRASES,SWORD_TIMINGS,samplePerformance,applyPerformance} from '../public/simulator/src/sword-performance.js';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../public/simulator/vendor/three.js';
import {GLTFLoader} from '../public/simulator/vendor/GLTFLoader.js';
import {HumanoidRuntime} from '../public/simulator/src/humanoid.js';
import {SLASH_SECONDS,SLASH_TIMING,sampleSlashPose,slashTime} from '../public/simulator/src/authored-slash.js';

// Load the shipped VRM, retargeted clips and production runtime. Only texture
// decoding is stubbed: this verifies real bone transforms, not GPU appearance.
async function loadRig(){
  globalThis.self=globalThis;
  globalThis.window={assetBuffer:async id=>{
    const path=id.startsWith('motion:')?'motions/'+id.slice(7)+'.vrma':id+'_review.vrm';
    const b=await readFile(new URL('../public/simulator/assets/'+path,import.meta.url));
    return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
  }};
  const parse=GLTFLoader.prototype.parseAsync;
  GLTFLoader.prototype.parseAsync=function(data,path){
    this.register(()=>({name:'CpuRigTextureStub',loadTexture:()=>Promise.resolve(new T.Texture())}));
    return parse.call(this,data,path);
  };
  const runtime=new HumanoidRuntime({
    weapons:{sword:{base:.21,tip:1.62,width:.065}},clips:SWORD_TIMINGS,strikes:{slash:{}},windows:{},
    progress:(a,t)=>Math.min(1,Math.max(0,(t??a.attack?.t??0)/(a.attack?.duration||SLASH_SECONDS))),
    window:(_k,p)=>p>=SLASH_TIMING.active[0]&&p<=SLASH_TIMING.active[1]?0:-1,
  });
  try{await runtime.load('SHINO');}finally{GLTFLoader.prototype.parseAsync=parse;}
  return runtime;
}

test('slash preserves the existing combat clock and has continuous pose endpoints',async()=>{
  const game=await readFile(new URL('../public/simulator/index.html',import.meta.url),'utf8');
  const timing=game.match(/slash:\{active:\[([^\]]+)\],contact:([\d.]+),launch:([\d.]+),plant:([\d.]+),chain:([\d.]+),lead:([\d.]+)/);
  assert.ok(timing,'game slash timing definition must be found');
  assert.deepEqual(timing[1].split(',').map(Number),SLASH_TIMING.active);
  for(const [i,key]of ['contact','launch','plant','chain','lead'].entries())assert.equal(Number(timing[i+2]),SLASH_TIMING[key]);
  assert.equal(Number(game.match(/const STRIKES=\{slash:\{[^}]*duration:([\d.]+)/)?.[1]),SLASH_SECONDS);
  assert.equal(SLASH_SECONDS,.66);
  assert.deepEqual(SLASH_TIMING,{active:[.35,.64],contact:.5,launch:.34,plant:.49,chain:.86,lead:1});
  const start=sampleSlashPose(0),end=sampleSlashPose(1);
  assert.deepEqual(start,end);
  for(const contact of [.3,.5,.7])assert.equal(slashTime(contact,contact),.5);
  for(let i=0;i<=1000;i++)for(const value of Object.values(sampleSlashPose(i/1000)))assert.ok(value.every(Number.isFinite));
});

test('actual Shino slash keeps knees forward, grip attached and support planted',async()=>{
  const runtime=await loadRig(),c=runtime.current;
  const actor={id:'slash-rig-test',hero:true,weapon:'sword',weaponDraw:1,lifeAgeYears:22,x:0,z:0,yaw:0,air:0,vx:0,vz:0,combatReady:true,_humanoidClock:0,attack:{id:'slash-1',kind:'slash',t:0,duration:SLASH_SECONDS}};
  const frames=[];let minKnee=Infinity,maxSocket=0;
  try{
    for(let i=0;i<=120;i++){
      const p=i/120;actor.attack.t=p*SLASH_SECONDS;actor._humanoidClock=actor.attack.t;
      const result=runtime.render(actor);
      assert.ok(result.sm.every(Number.isFinite));assert.equal(c.finite,true);
      assert.equal(result.active,p>=.35&&p<=.64);
      assert.equal(actor.x,0);assert.equal(actor.z,0);
      maxSocket=Math.max(maxSocket,c.socketError);assert.ok(c.socketError<1e-5);
      for(const side of ['left','right']){
        const hip=runtime.point(c,side+'UpperLeg'),knee=runtime.point(c,side+'LowerLeg'),ankle=runtime.point(c,side+'Foot');
        const axis=ankle.clone().sub(hip).normalize(),bend=knee.sub(hip);bend.addScaledVector(axis,-bend.dot(axis));
        minKnee=Math.min(minKnee,bend.z);assert.ok(bend.z>=-1e-5,`${side} knee inverted at ${p}: ${bend.z}`);
      }
      frames.push({p,tip:new T.Vector3(...result.weaponTip),base:new T.Vector3(...result.weaponBase),toe:runtime.point(c,'leftToes'),hips:runtime.point(c,'hips')});
    }
    const support=frames.filter(f=>f.p>=.49&&f.p<=.70),origin=support[0].toe;
    const slip=Math.max(...support.map(f=>f.toe.distanceTo(origin)));
    assert.ok(slip<.025,`planted toe drift ${slip}m`);
    assert.ok(frames[0].tip.distanceTo(frames.at(-1).tip)<.002,'blade loop seam');
    assert.ok(frames[0].hips.distanceTo(frames.at(-1).hips)<.002,'hips loop seam');
    const hit=frames[60].tip.clone().sub(frames[60].base).normalize();assert.ok(hit.z>.98,'blade must cross forward at contact');
    const travel=(a,b)=>frames.slice(a+1,b+1).reduce((n,f,j)=>n+f.tip.distanceTo(frames[a+j].tip),0)/(b-a);
    assert.ok(travel(50,70)>travel(0,30)*2,'cut must accelerate beyond loading speed');
    console.log(JSON.stringify({frames:frames.length,maxSocketError:maxSocket,minForwardKnee:minKnee,plantedToeDrift:slip}));
  }finally{runtime.dispose(c);delete globalThis.window;delete globalThis.self;}
});


test('30-second score covers five cuts and preserves root/gait continuity',()=>{
 assert.equal(PERFORMANCE_SECONDS,30);
 assert.equal(PERFORMANCE_EVENTS.at(-1).end,30);
 const cuts=PERFORMANCE_EVENTS.filter(e=>!['move','guard'].includes(e.kind));
 assert.equal(cuts.length,17);assert.equal(new Set(cuts.map(e=>e.kind)).size,5);
 for(const e of PERFORMANCE_EVENTS){
  const a=samplePerformance(e.start-1e-7),b=samplePerformance(e.start+1e-7);
  for(const k of ['x','z','yaw','vx','vz','walk','run'])assert.ok(Math.abs(a[k]-b[k])<1e-4,`${k} jumps at ${e.start}`);
  for(const p of [0,.25,.5,.75,1]){const s=samplePerformance(e.start+p*e.duration);for(const k of ['x','z','yaw','vx','vz','walk','run'])assert.ok(Number.isFinite(s[k]));}
 }
 const first=samplePerformance(0),last=samplePerformance(30);
 for(const k of ['x','z','vx','vz'])assert.equal(first[k],last[k]);
 assert.ok(Math.abs(Math.sin(last.yaw-first.yaw))<1e-8);
 assert.equal(samplePerformance(-3).time,0);assert.equal(samplePerformance(100).time,30);
 for(const kind of AUTHORED_SWORD_KINDS){
  const a=sampleSwordPose(kind,0),b=sampleSwordPose(kind,1);
  for(const k of Object.keys(a))for(let j=0;j<a[k].length;j++)assert.ok(Math.abs(a[k][j]-b[k][j])<1e-10,`${kind} guard seam`);
 }
});

test('real rig joins approaches and cuts without a boundary pop or loose grip',async()=>{
 const runtime=await loadRig(),c=runtime.current;
 const actor={id:'performance-test',hero:true,weapon:'sword',weaponDraw:1,lifeAgeYears:22,air:0,combatReady:true};
 const reset=()=>{c.state=null;c.lastActual=null;c.blending=null;c.footLocks={};c.resetSpring=true;};
 const sample=t=>{applyPerformance(actor,t,c.locomotion);const result=runtime.render(actor);assert.ok(result.sm.every(Number.isFinite));assert.ok(c.finite);assert.ok(c.socketError<1e-5);return result;};
 let maxBoundary=0;
 try{
  for(const e of PERFORMANCE_EVENTS.slice(1)){
   reset();for(let t=Math.max(0,e.start-.25);t<e.start-1e-4;t+=1/60)sample(t);
   const a=sample(e.start-1e-6),b=sample(e.start+1e-6);
   const jump=new T.Vector3(...a.weaponTip).distanceTo(new T.Vector3(...b.weaponTip));
   maxBoundary=Math.max(maxBoundary,jump);assert.ok(jump<.02,`blade jumps ${jump}m at ${e.start}`);
  }
  for(const kind of AUTHORED_SWORD_KINDS){
   const e=PERFORMANCE_EVENTS.find(e=>e.kind===kind);reset();
   for(const phase of [0,.27,.38,.5,.64,.8,1]){
    const result=sample(e.start+phase*e.duration);
    if(phase>.1&&phase<.9)for(const side of ['left','right']){
     const hip=runtime.point(c,side+'UpperLeg'),knee=runtime.point(c,side+'LowerLeg'),ankle=runtime.point(c,side+'Foot');
     const axis=ankle.clone().sub(hip).normalize(),bend=knee.sub(hip);bend.addScaledVector(axis,-bend.dot(axis));
     const forward=new T.Vector3(Math.sin(actor.yaw),0,Math.cos(actor.yaw));
     assert.ok(bend.dot(forward)>-1e-5,`${kind} ${side} knee at ${phase}`);
    }

   }
  }
  console.log(JSON.stringify({performanceSeconds:30,strikes:17,maxBoundaryBladeJump:maxBoundary}));
 }finally{runtime.dispose(c);delete globalThis.window;delete globalThis.self;}
});


test('existing clips drive both single attacks and composed phrases without a new attack kind',async()=>{
 const runtime=await loadRig(),c=runtime.current;
 const actor={id:'existing-sequence',hero:true,weapon:'sword',weaponDraw:1,lifeAgeYears:22,x:0,z:0,yaw:0,air:0,combatReady:true,vx:0,vz:0};
 const contacts=new Set();let minBladeY=Infinity,maxGrip=0,maxBoundary=0;
 const render=t=>{actor._humanoidClock=t;applySwordSequence(actor,SHORT_SWORD_SEQUENCE,t,{start:.3});return runtime.render(actor);};
 try{
  for(let i=0;i<=240;i++){
   const r=render(i/60);assert.ok(c.finite);maxGrip=Math.max(maxGrip,c.socketError);assert.ok(c.socketError<1e-5);
   assert.ok(SWORD_MOVES[actor.attack.kind],'composition uses an existing clip ID');
   if(r.active)contacts.add(actor.attack.kind);minBladeY=Math.min(minBladeY,r.weaponTip[1]);
  }
  assert.deepEqual([...contacts],['slash','back','uppercut','heavy']);assert.ok(minBladeY>-.02,`blade below ground ${minBladeY}`);
  for(const row of SHORT_SWORD_SEQUENCE.entries.slice(1)){
   c.lastActual=null;c.state=null;c.blending=null;c.footLocks={};
   const a=render(row.start+.3-1e-6),b=render(row.start+.3+1e-6);
   maxBoundary=Math.max(maxBoundary,new T.Vector3(...a.weaponTip).distanceTo(new T.Vector3(...b.weaponTip)));
  }
  assert.ok(maxBoundary<.015,`composition seam ${maxBoundary}`);
  assert.ok(!Object.keys(c.generated).some(key=>key.endsWith(':flow')));
  // Every hit remains inside its original active interval; no blend suppresses it.
  for(const phrase of PERFORMANCE_PHRASES)for(const row of phrase.sequence.entries){
   const t=row.start+(.5-row.enter)*row.seconds;
   const f=swordSequenceFrame(phrase.sequence,t);
   assert.equal(f.current.kind,row.kind);assert.ok(Math.abs(f.current.phase-.5)<1e-10);assert.equal(f.previous,null);
  }
  const repeated=createSwordSequence(['slash','slash','slash']);
  for(let t=0;t<=repeated.duration;t+=1/60){applySwordSequence(actor,repeated,t);actor._humanoidClock=t;assert.ok(runtime.render(actor).sm.every(Number.isFinite));}
  console.log(JSON.stringify({existingKinds:[...contacts],minBladeY,maxGrip,maxBoundary}));
 }finally{runtime.dispose(c);delete globalThis.window;delete globalThis.self;}
});


test('Lab raw-rig composition reproduces the shared normalized clips at forward and reverse seeks',async()=>{
 const runtime=await loadRig(),c=runtime.current,kinds=['slash','back','uppercut'];
 const plan=createSwordSequence(kinds),normalized={},rawClips={};
 try{
  for(const kind of kinds){
   normalized[kind]=swordClipInSeconds(runtime.bakeArmed(c,'sword',kind),kind);
   rawClips[kind]=rawClipFromNormalized(normalized[kind],c.bones,c.vrm,c.raw,kind);
   assert.ok(Math.abs(rawClips[kind].duration-SWORD_MOVES[kind].seconds)<1e-6);
   assert.ok(rawClips[kind].tracks.some(t=>t.name===c.raw.leftUpperLeg.uuid+'.quaternion'));
  }
  const times=[0,.2,...plan.entries.slice(1).flatMap(e=>[e.start,e.start+.02,e.start+.04,e.start+.079]),plan.duration,.2,0];
  let maxAngle=0;
  for(const time of times){
   const f=swordSequenceFrame(plan,time),sample=(map,root)=>{
    if(f.previous)sampleRawClip(map[f.previous.kind],root,f.previous.phase*SWORD_MOVES[f.previous.kind].seconds);
    sampleRawClip(map[f.current.kind],root,f.current.phase*SWORD_MOVES[f.current.kind].seconds,f.previous?f.weight:1);
   };
   runtime.resetBones(c);sample(normalized,c.root);c.vrm.humanoid.update();
   const expected=Object.fromEntries(Object.entries(c.raw).map(([name,b])=>[name,b.quaternion.clone()]));
   for(const b of Object.values(c.raw))b.quaternion.identity();
   sample(rawClips,c.root);
   for(const name of Object.keys(c.raw))maxAngle=Math.max(maxAngle,c.raw[name].quaternion.clone().normalize().angleTo(expected[name].normalize()));
  }
  assert.ok(maxAngle<.00005,`Lab/runtime pose mismatch ${maxAngle}`);
  console.log(JSON.stringify({labRuntimeMaxAngle:maxAngle}));
 }finally{runtime.dispose(c);delete globalThis.window;delete globalThis.self;}
});
