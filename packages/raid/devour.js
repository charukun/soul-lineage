// Capture progress is portable interaction state; the Web adapter owns all poses.
export const DEVOUR_SECONDS=1.5;
export const DEVOUR_REACH=.75;
export function cancelDevour(session){
 if(session.devour?.npc)delete session.devour.npc.capturedBy;
 session.player.devourProgress=null;
 session.devour=null;
}
export function advanceDevour(session,dt,amount=0){
 const action=session.devour,p=session.player,n=action?.npc;
 p.speed=0;p.pose=null;p.devourProgress=null;
 if(!action)return;
 if(amount>.08||!n||!n.dead||n.eaten||session.finished){cancelDevour(session);return;}
 const distance=Math.hypot(n.x-p.x,n.z-p.z);
 if(distance>1e-6)p.yaw=Math.atan2(n.x-p.x,n.z-p.z);
 if(distance>DEVOUR_REACH+.02||session.lineBlocked(p,n)){
  action.phase='approach';action.t=0;delete n.capturedBy;
  const step=Math.min(Math.max(0,distance-DEVOUR_REACH),Math.max(0,dt)*2);
  if(step>0){const moved=session.walkActor(p,(n.x-p.x)/distance*step,(n.z-p.z)/distance*step);p.speed=dt>0?moved/dt:0;p.walk+=moved*3.8;}
  // Walls, gates and wards cannot be bypassed by waiting for the animation.
  return;
 }
 action.phase='feeding';
 action.t=Math.min(DEVOUR_SECONDS,(action.t||0)+Math.max(0,dt));
 p.devourProgress=action.t/DEVOUR_SECONDS;
 n.capturedBy={x:p.x,z:p.z,yaw:p.yaw,form:session.profile?.form,progress:p.devourProgress};
 if(action.t>=DEVOUR_SECONDS){cancelDevour(session);session.consume(n);}
}
