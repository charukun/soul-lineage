import {clamp,angleDelta} from './character25d-rig.js';
export const VIEW_ANGLES=Object.freeze({front:0,frontQuarter:Math.PI/4,side:Math.PI/2,backQuarter:Math.PI*.75,back:Math.PI});
const VIEW_NAMES=Object.keys(VIEW_ANGLES);
export function selectAppearance(appearance,relative,previous=null,hysteresis=.10) {
  const angle=Math.abs(angleDelta(0,relative));let chosen=null,distance=Infinity;
  for(const name of VIEW_NAMES)if(appearance[name]){const next=Math.abs(angle-VIEW_ANGLES[name]);if(next<distance){chosen=name;distance=next;}}
  if(previous&&appearance[previous]&&Math.abs(angle-VIEW_ANGLES[previous])<distance+hysteresis)return previous;
  return chosen;
}
export function createCharacter25DProxy(config,{canMoveTo=()=>true,sampleGround=(x,z,out)=>{out.height=0;out.normal.x=0;out.normal.y=1;out.normal.z=0;out.valid=true;return out;},sweep=null}={}) {
  const position={x:0,y:0,z:0},velocity={x:0,y:0,z:0},direction={x:0,z:0},groundNormal={x:0,y:1,z:0};
  const ground={height:0,normal:{x:0,y:1,z:0},valid:true},feet={left:{x:0,y:0,z:0},right:{x:0,y:0,z:0}};
  let yaw=0,facing=0,grounded=false,blocked=false;
  const acceptable=(x,z)=>{
    const result=sampleGround(x,z,ground)||ground;
    return result.valid!==false&&Number.isFinite(result.height)&&Number.isFinite(result.normal?.y)&&result.normal.y>=Math.cos(config.maxSlope)&&Math.abs(result.height-position.y)<=config.maxStep&&canMoveTo(x,z,config.radius);
  };
  function snapGround(){const result=sampleGround(position.x,position.z,ground)||ground;grounded=result.valid!==false&&Number.isFinite(result.height);if(grounded){position.y=result.height;groundNormal.x=result.normal.x;groundNormal.y=result.normal.y;groundNormal.z=result.normal.z;}return grounded;}
  return {position,velocity,direction,groundNormal,feet,collider:{shape:'capsule',radius:config.radius,height:config.height},
    get yaw(){return yaw;},get grounded(){return grounded;},get blocked(){return blocked;},
    setTransform(p,angle=yaw){if(!p||![p.x,p.y??0,p.z,angle].every(Number.isFinite))throw new Error('Invalid actor transform');position.x=p.x;position.y=p.y??0;position.z=p.z;yaw=facing=angle;snapGround();},
    setVelocity(v){if(!v||![v.x,v.z].every(Number.isFinite))throw new Error('Invalid actor velocity');const length=Math.hypot(v.x,v.z),scale=length>6?6/length:1;velocity.x=v.x*scale;velocity.z=v.z*scale;},
    setFacing(angle){if(!Number.isFinite(angle))throw new Error('Invalid actor facing');facing=angle;},
    setGroundNormal(n){if(!n||![n.x,n.y,n.z].every(Number.isFinite)||n.y<=0)throw new Error('Invalid ground normal');const d=Math.hypot(n.x,n.y,n.z);groundNormal.x=n.x/d;groundNormal.y=n.y/d;groundNormal.z=n.z/d;},
    step(dt){dt=clamp(Number(dt)||0,0,.05);const x=position.x,z=position.z,dx=velocity.x*dt,dz=velocity.z*dt;blocked=false;
      if(sweep){const result=sweep(position,dx,dz,acceptable,config.radius);blocked=Boolean(result.blocked);}
      else{const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.06));for(let i=0;i<steps;i++){const sx=dx/steps,sz=dz/steps;if(acceptable(position.x+sx,position.z+sz)){position.x+=sx;position.z+=sz;}else{blocked=true;if(acceptable(position.x+sx,position.z))position.x+=sx;else if(acceptable(position.x,position.z+sz))position.z+=sz;}snapGround();}}
      snapGround();const distance=Math.hypot(position.x-x,position.z-z);direction.x=distance?(position.x-x)/distance:0;direction.z=distance?(position.z-z)/distance:0;
      if(distance>.00001)facing=Math.atan2(direction.x,direction.z);
      yaw+=angleDelta(yaw,facing)*(1-Math.exp(-17*dt));
      return dt?distance/dt:0;
    },sampleGround,snapGround};
}
