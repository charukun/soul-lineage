const TAU=Math.PI*2;
const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
const smooth=value=>{const t=clamp(value);return t*t*(3-2*t);};

export function combatStanceWeight({active=false,attack=false,progress=null,held=1}={}){
  const weight=active?clamp(held):0;
  if(!weight||!attack||!Number.isFinite(Number(progress)))return weight;
  const p=clamp(progress);
  if(p<=.12)return weight*(1-smooth(p/.12));
  if(p>=.82)return weight*smooth((p-.82)/.18);
  return 0;
}

function frame({phase,speed,moving,combatWeight,dx=0,dz=0,yaw=0}){
  const run=speed>3.1,gaitWeight=clamp(speed/.6),guard=smooth(combatWeight);
  const forward=dx*Math.sin(yaw)+dz*Math.cos(yaw),right=dx*Math.cos(yaw)-dz*Math.sin(yaw);
  const backward=forward< -Math.abs(right)*.35;
  const cycle=phase*TAU,amplitude=(run?.42:.34)*(1-.32*guard)*gaitWeight;
  return {
    moving,speed,run,phase:cycle,
    swing:moving?Math.sin(cycle)*amplitude*(backward?-1:1):0,
    bob:moving?Math.abs(Math.sin(cycle))*(run?.018:.012)*(1-.18*guard)*gaitWeight:0,
    armSwing:moving?Math.sin(cycle)*.15*(1-.72*guard)*gaitWeight:0,
    motionStrength:gaitWeight*(1-.42*guard),
    stance:guard*(moving?.78:1)
  };
}

/**
 * Shared Bloodline-derived presentation contract.
 * Gameplay owns world displacement. This observer owns only gait phase,
 * visual speed smoothing, backwards cadence and the ready-stance envelope.
 */
export function createObservedCombatLocomotion(){
  let ready=false,lastX=0,lastZ=0,phase=0,speed=0,moving=false;
  function reset(player=null){
    ready=Number.isFinite(player?.x)&&Number.isFinite(player?.z);
    lastX=ready?Number(player.x):0;lastZ=ready?Number(player.z):0;
    phase=0;speed=0;moving=false;
  }
  function sample(player,dt,{enabled=true,combatWeight=0}={}){
    const x=Number(player?.x),z=Number(player?.z),yaw=Number(player?.yaw)||0;
    dt=clamp(dt,0,.1);
    if(!Number.isFinite(x)||!Number.isFinite(z)){reset();return frame({phase,speed,moving:false,combatWeight:0,yaw});}
    if(!ready){ready=true;lastX=x;lastZ=z;}
    let dx=x-lastX,dz=z-lastZ,distance=Math.hypot(dx,dz);
    if(distance>1.5){phase=0;speed=0;moving=false;dx=dz=distance=0;}
    const active=Boolean(enabled)&&(distance>1e-7||(dt===0&&moving));
    if(dt>0){
      const target=active?distance/dt:0;
      speed+=(target-speed)*(1-Math.exp(-dt*18));
      if(!active&&speed<.02)speed=0;
    }else if(!enabled)speed=0;
    const run=speed>3.1,stride=run?1.38:1.04;
    if(active){
      if(!moving)phase=(run?.46:.60)*.5+distance/stride;
      else phase+=distance/stride;
    }
    moving=active;lastX=x;lastZ=z;
    return frame({phase,speed,moving,combatWeight,dx,dz,yaw});
  }
  return Object.freeze({sample,reset});
}

const rotate=(bone,x=0,y=0,z=0)=>{
  if(!bone?.rotation)return;
  bone.rotation.x+=x;bone.rotation.y+=y;bone.rotation.z+=z;
};

/** Apply the one shared locomotion/ready-stance pose to a humanoid bone map. */
export function applyObservedCombatLocomotionPose(bones,gait,{guardArms=true,breath=0}={}){
  if(!bones||!gait)return;
  const stance=clamp(gait.stance),swing=Number(gait.swing)||0,bob=Number(gait.bob)||0,armSwing=Number(gait.armSwing)||0;
  rotate(bones.leftUpperLeg,swing-stance*.085,0,stance*.035);
  rotate(bones.rightUpperLeg,-swing+stance*.055,0,-stance*.035);
  rotate(bones.leftLowerLeg,Math.max(0,-swing)*1.2+stance*.09);
  rotate(bones.rightLowerLeg,Math.max(0,swing)*1.2+stance*.09);
  if(bones.hips?.position)bones.hips.position.y+=bob-stance*.018;
  if(stance){
    const pulse=(Number(breath)||0)*stance;
    rotate(bones.hips,0,pulse*.025);
    rotate(bones.spine,-.055*stance-pulse*.012,pulse*.018);
    rotate(bones.head,0,-pulse*.012);
    if(guardArms){
      rotate(bones.leftUpperArm,-.22*stance,0,-.19*stance);
      rotate(bones.rightUpperArm,-.34*stance,0,.17*stance);
      rotate(bones.leftLowerArm,-.42*stance);
      rotate(bones.rightLowerArm,-.48*stance);
    }
  }
  if(guardArms&&gait.moving){
    rotate(bones.leftUpperArm,-armSwing);
    rotate(bones.rightUpperArm,armSwing);
  }
}

export function combatStanceRootFrame(options={}){
  const weight=combatStanceWeight(options);
  return Object.freeze({weight,drop:.018*weight,pitch:.055*weight});
}
