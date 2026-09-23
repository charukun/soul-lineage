const TAU=Math.PI*2;
const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
const smooth=value=>{const t=clamp(value);return t*t*(3-2*t);};

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
 * Keep Bloodline's useful locomotion contract without importing its simulation:
 * world displacement is authoritative, while this observer owns only gait phase,
 * smoothed visual speed and the lower-body combat stance.
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
    const run=speed>3.1,stride=(run?1.38:1.04);
    if(active){
      if(!moving)phase=(run?.46:.60)*.5+distance/stride;
      else phase+=distance/stride;
    }
    moving=active;lastX=x;lastZ=z;
    return frame({phase,speed,moving,combatWeight,dx,dz,yaw});
  }
  return{sample,reset};
}
