/** Read-only animation choice from actual world displacement; never moves a body. */
export function observedLocomotion(from,to,yaw=0){
  if(!from||!to||![from.x,from.z,to.x,to.z,yaw].every(Number.isFinite))return null;
  const dx=to.x-from.x,dz=to.z-from.z,distance=Math.hypot(dx,dz);
  if(distance<.00001)return null;
  const forward=dx*Math.sin(yaw)+dz*Math.cos(yaw),right=dx*Math.cos(yaw)-dz*Math.sin(yaw);
  if(Math.abs(right)>Math.abs(forward)*1.4)return right>0?'Running_Strafe_Right':'Running_Strafe_Left';
  return forward<-.35*distance?'Walking_Backwards':null;
}
