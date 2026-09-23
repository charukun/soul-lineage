import { nextJourneyTarget } from './village-journey-navigation.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const identity=s=>`${s.id}:${s.generation}:${s.zone}:${s.interior?.buildingId||''}:${s.phase}`;
export const isVillageLife=s=>Boolean(s&&s.phase==='living'&&s.zone==='village'&&!s.combat&&!s.down&&!s.ended);
export function isVillageTap(gesture,event,now){
  return Boolean(gesture&&gesture.id===event.pointerId&&event.type==='pointerup'&&
    now-gesture.at>=0&&now-gesture.at<350&&gesture.travel<=8&&
    Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)<=8);
}

/** A session-local destination, not a new movement, save or combat authority.
 * Returned screen input goes through the existing camera, speed and collision path. */
export function createVillageWalkPlan({stations,canMoveTo,screenDirection,now=()=>performance.now()}={}){
  if(!Array.isArray(stations)||typeof canMoveTo!=='function'||typeof screenDirection!=='function')throw new TypeError('Village walk requires stations, collision and camera ports');
  let plan=null;
  const cancel=()=>{plan=null;};
  const free=(s,p)=>canMoveTo(p.x,p.z,.32,s.interior?'interior':'village',s.interior?.buildingId||null);
  function request(state,point){
    cancel();
    if(!isVillageLife(state)||!point||![point.x,point.z].every(Number.isFinite)||distance(state.position,point)>90)return false;
    const inside=state.interior?.buildingId||null;
    const nearby=stations.filter(row=>!row.trainingDummy&&!row.equipment&&!row.danger&&!row.port&&
      (row.activity||row.enterInterior||row.exitInterior)&&(inside?row.interiorId===inside:!row.interiorId))
      .map(row=>({row,d:distance(point,row.interactionPosition||row)}))
      .filter(({row,d})=>d<=Math.min(1.4,row.radius||1)&&free(state,row))
      .sort((a,b)=>a.d-b.d)[0]?.row;
    const target=nearby?{id:nearby.id,x:nearby.x,z:nearby.z,label:nearby.label}:
      {id:'village-walk-ground',x:point.x,z:point.z,label:'行き先'};
    if(!free(state,target))return false;
    plan={identity:identity(state),target,progress:{...state.position},progressAt:now()};
    return true;
  }
  function axis(state,manual={x:0,y:0}){
    if(!plan)return manual;
    if(!isVillageLife(state)||identity(state)!==plan.identity||Math.hypot(manual.x,manual.y)>.08){cancel();return manual;}
    if(distance(state.position,plan.target)<=.22){cancel();return manual;}
    const time=now();
    if(distance(state.position,plan.progress)>.025){plan.progress={...state.position};plan.progressAt=time;}
    else if(time-plan.progressAt>800){cancel();return manual;}
    const next=state.interior?plan.target:nextJourneyTarget(state.position,plan.target,stations,{consumer:'player-walk'});
    const length=distance(state.position,next);
    if(length<.01){cancel();return manual;}
    // Only reject an obstructed next step; never move or shrink a collider here.
    const probe=Math.min(.3,length),point={x:state.position.x+(next.x-state.position.x)/length*probe,z:state.position.z+(next.z-state.position.z)/length*probe};
    if(!free(state,point)){cancel();return manual;}
    const result=screenDirection(state.position,next);
    return Number.isFinite(result?.x)&&Number.isFinite(result?.y)?{x:result.x,y:result.y}:manual;
  }
  return {request,axis,cancel,target:()=>plan?{...plan.target}:null};
}

/** Observe a short ground tap without consuming drag/flick, hold or camera input. */
export function installVillageWalkInput({canvas,view,stations,getState,enabled=()=>true}){
  const plan=createVillageWalkPlan({stations,canMoveTo:(...args)=>view.canMoveTo(...args),screenDirection:(...args)=>view.screenDirection(...args)});
  const abort=new AbortController(),signal=abort.signal,doc=canvas.ownerDocument,win=doc.defaultView;
  const {Raycaster,Vector2,Vector3,Plane}=view.THREE,ray=new Raycaster(),pointer=new Vector2(),hit=new Vector3(),ground=new Plane(new Vector3(0,1,0),0);
  let gesture=null;
  const available=()=>enabled()&&isVillageLife(getState());
  const cancel=()=>{gesture=null;plan.cancel();};
  canvas.addEventListener('pointerdown',event=>{
    const occupied=gesture!==null;cancel();
    if(occupied||event.isPrimary===false||event.button!==0||!available())return;
    gesture={id:event.pointerId,x:event.clientX,y:event.clientY,at:performance.now(),travel:0};
  },{signal,capture:true});
  canvas.addEventListener('pointermove',event=>{
    if(gesture?.id===event.pointerId)gesture.travel=Math.max(gesture.travel,Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y));
  },{signal,capture:true});
  const end=event=>{
    const tapped=isVillageTap(gesture,event,performance.now());gesture=null;
    if(!tapped||!available())return;
    const rect=canvas.getBoundingClientRect();if(!(rect.width>0&&rect.height>0))return;
    const x=(event.clientX-rect.left)/rect.width,y=(event.clientY-rect.top)/rect.height;
    if(x<0||x>1||y<0||y>1)return;
    pointer.set(x*2-1,1-y*2);ray.setFromCamera(pointer,view.camera);
    // The renderer and character controller explicitly share this y=0 walk plane.
    if(ray.ray.intersectPlane(ground,hit))plan.request(getState(),{x:hit.x,z:hit.z});
  };
  canvas.addEventListener('pointerup',end,{signal,capture:true});
  canvas.addEventListener('pointercancel',cancel,{signal,capture:true});
  doc.addEventListener('pointerdown',event=>{if(event.target!==canvas)cancel();},{signal,capture:true});
  doc.addEventListener('visibilitychange',cancel,{signal});
  win.addEventListener('blur',cancel,{signal});
  win.addEventListener('keydown',cancel,{signal});
  return {axis(manual){if(!available()){cancel();return manual;}return plan.axis(getState(),manual);},cancel,dispose(){cancel();abort.abort();}};
}
