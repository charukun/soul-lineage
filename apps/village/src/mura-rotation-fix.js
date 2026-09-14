// The legacy two-finger handler initializes its rotation baseline on the first
// move and applies no yaw on that frame. The MURAAAAAAA correction layer
// reverses subsequent deltas, so compensate only that first move to keep the
// gesture continuous instead of jumping by 2x.
const view=window.village?.view;
const canvas=document.getElementById('game');
if(view&&canvas){
 const pointers=new Map();
 let firstMove=false,lastAngle=0;
 canvas.addEventListener('pointerdown',event=>{
  pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
  if(pointers.size===2){const[a,b]=[...pointers.values()];lastAngle=Math.atan2(b.y-a.y,b.x-a.x);firstMove=true;}
 },{capture:true,passive:true});
 canvas.addEventListener('pointermove',event=>{
  const p=pointers.get(event.pointerId);if(!p)return;p.x=event.clientX;p.y=event.clientY;
  if(pointers.size!==2)return;
  const[a,b]=[...pointers.values()],angle=Math.atan2(b.y-a.y,b.x-a.x);
  let delta=angle-lastAngle;if(delta>Math.PI)delta-=Math.PI*2;if(delta<-Math.PI)delta+=Math.PI*2;
  lastAngle=angle;
  if(firstMove){firstMove=false;queueMicrotask(()=>{view.yaw-=delta;view.updateCamera();});}
 },{capture:true,passive:true});
 const end=event=>{pointers.delete(event.pointerId);if(pointers.size<2)firstMove=false;};
 canvas.addEventListener('pointerup',end,{capture:true,passive:true});
 canvas.addEventListener('pointercancel',end,{capture:true,passive:true});
}
