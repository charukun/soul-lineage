import {createCharacter25DProxy} from './character25d-proxy.js';
import {SPRITE_SET_ACTIONS,assertCharacterSpriteSet} from './character-sprite-set.js';

const DURATION={idle:1.2,walk:2,run:1.5,turn:1,attack:1.2,hit:1,talk:1.3,pickup:1.2,rest:1.8,jump:1.1,fall:.9,vault:1.2,climb:1.4};
// Explicit test-session movement authority. It never modifies a game's save/NPC/combat state.
export function createSpriteSetSandbox(actor,options={}){
  assertCharacterSpriteSet(actor.manifest,{playable:true});
  const proxy=createCharacter25DProxy({radius:.24,height:1.65,maxSlope:Math.PI/3,maxStep:.28},options);
  let action='idle',elapsed=0,total=0,index=0,demo=false,paused=false,air=0,verticalSpeed=0,disposed=false,distanceTravelled=0;
  let origin={x:0,y:0,z:0};
  const sequence=SPRITE_SET_ACTIONS.filter(name=>actor.manifest.actions[name]);
  function play(name,opts={}){
    if(disposed)throw new Error('Sprite Set sandbox is disposed');
    actor.play(name,opts);action=name;elapsed=0;
    if(name==='jump'||name==='vault'){air=0;verticalSpeed=name==='jump'?4.8:3.6;}
    else if(name==='fall'){air=.75;verticalSpeed=0;}
    else {air=0;verticalSpeed=0;}
  }
  function reset(position=origin,yaw=0){origin={...position};proxy.setTransform(position,yaw);total=0;index=0;distanceTravelled=0;play('idle');actor.setTransform(proxy.position,proxy.yaw);actor.setLift(0);}
  function update(delta,camera){
    if(disposed)return;
    const dt=Math.min(.05,Math.max(0,Number(delta)||0));
    if(paused){actor.update({delta:0,camera});return;}
    elapsed+=dt;total+=dt;
    if(demo&&elapsed>=(DURATION[action]||1.2)){index=(index+1)%sequence.length;play(sequence[index]);}
    const speed=action==='run'?3.4:action==='walk'?1.6:action==='vault'?.8:0;
    // A bounded circuit makes collisions visible without accumulating unbounded drift.
    const heading=total*.8,tx=origin.x+Math.sin(heading)*2.2,tz=origin.z+Math.cos(heading)*2.2;
    const dx=tx-proxy.position.x,dz=tz-proxy.position.z,length=Math.hypot(dx,dz);
    proxy.setVelocity({x:length>0?dx/length*speed:0,z:length>0?dz/length*speed:0});
    if(action==='turn')proxy.setFacing(proxy.yaw+dt*2.6);
    const moved=proxy.step(dt);distanceTravelled+=moved*dt;
    if(air>0||verticalSpeed>0){
      verticalSpeed-=12*dt;air=Math.max(0,air+verticalSpeed*dt);
      if(action==='jump'&&verticalSpeed<0){actor.play('fall');action='fall';elapsed=0;}
      if(air===0){verticalSpeed=0;if(!demo&&(action==='jump'||action==='fall'||action==='vault'))play('idle');}
    }
    actor.setTransform({x:proxy.position.x,y:proxy.position.y,z:proxy.position.z},proxy.yaw);
    // Lift is relative to the collision-grounded body root; shadow remains on the sampled ground.
    actor.setLift(air);actor.update({delta:dt,camera});
  }
  return {proxy,play,reset,update,
    setDemo(value){demo=Boolean(value);index=0;play('idle');},
    pause(value=true){paused=Boolean(value);actor.pause(paused);},
    snapshot(){return {action,elapsed,demo,paused,grounded:air===0,airHeight:air,verticalSpeed,blocked:proxy.blocked,distanceTravelled,position:{...proxy.position},groundNormal:{...proxy.groundNormal},disposed};},
    dispose(){disposed=true;proxy.setVelocity({x:0,z:0});},
  };
}
