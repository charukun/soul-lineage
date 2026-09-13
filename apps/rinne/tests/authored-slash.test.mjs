import test from 'node:test';
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
    weapons:{sword:{base:.21,tip:1.62,width:.065}},clips:{slash:SLASH_TIMING},strikes:{slash:{}},windows:{},
    progress:(a,t)=>Math.min(1,Math.max(0,(t??a.attack?.t??0)/SLASH_SECONDS)),
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
