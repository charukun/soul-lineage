import {createActorStatus} from './actor-status.js';
import {birthTourPace,createBirthTour} from './birth-tour.js';
import {nearestStation} from './locations.js';

const STEER=Object.freeze([0,.42,-.42,.82,-.82,1.2,-1.2]);
const magnitude=axis=>Math.hypot(axis?.x||0,axis?.y||0);

export function createBirthExperience({document,canvas,gameScreen,view,stations,getState,dialogue}){
  const tour=createBirthTour(stations),pace=birthTourPace(stations),status=createActorStatus({document,canvas,view,actorName:'Player'}),mother=view.scene.getObjectByName('Mother');
  let introTimer=0,introRemaining=0,stuck=0,motionTime=0;

  const active=()=>{const state=getState();return state?.zone==='village'&&!state?.down&&!state?.ended&&state?.phase==='birth';};
  function move(direction,speed,dt){
    const state=getState(),nx=state.position.x+direction.x*speed*dt,nz=state.position.z+direction.z*speed*dt;
    if(!view.canMoveTo(nx,nz,.42,'village'))return false;
    state.position.x=nx;state.position.z=nz;state.yaw=Math.atan2(direction.x,direction.z);return true;
  }
  function toward(target,dt){
    const state=getState(),dx=target.x-state.position.x,dz=target.z-state.position.z;if(Math.hypot(dx,dz)<.02)return false;
    const base=Math.atan2(dx,dz);
    for(const offset of STEER){const angle=base+offset;if(move({x:Math.sin(angle),z:Math.cos(angle)},pace.autoSpeed,dt))return true;}
    return false;
  }
  function speakStation(station){const line=tour.observe(station);if(line)dialogue('母',line);}
  function step(dt,axis){
    if(!active())return{handled:false,moved:false,carrierMoving:false,carrierSpeed:0};
    if(document.hidden)return{handled:true,moved:false,carrierMoving:false,carrierSpeed:0};
    const state=getState(),manual=magnitude(axis)>.08;let moved=false,speed=0;introRemaining=Math.max(0,introRemaining-dt);
    if(manual){tour.tick(dt,state.position,true);speed=pace.manualSpeed;moved=move(view.cameraVector(axis),speed,dt);stuck=0;}
    else if(introRemaining>0)return{handled:true,moved:false,carrierMoving:false,carrierSpeed:0,manual:false};
    else{
      const next=tour.tick(dt,state.position,false);if(next.line)dialogue('母',next.line);
      if(next.mode==='travel'&&next.target){speed=pace.autoSpeed;moved=toward(next.target,dt);if(moved)stuck=0;else if((stuck+=dt)>=1.6){tour.advance();stuck=0;}}
      else stuck=0;
    }
    if(introRemaining<=0)speakStation(nearestStation(stations,state.position));
    return{handled:true,moved,carrierMoving:moved,carrierSpeed:moved?speed:0,manual};
  }
  function afterRender(dt,{carrierMoving=false,carrierSpeed=0}={}){
    motionTime+=dt;
    if(mother){
      const legs=mother.userData.legs||[],cadence=Math.min(11.5,6.2+Math.max(0,carrierSpeed)*.72);
      if(active()&&carrierMoving)legs.forEach((leg,i)=>leg.rotation.x=Math.sin(motionTime*cadence+(i%2)*Math.PI)*.38);else legs.forEach(leg=>leg.rotation.x*=.72);
      const body=mother.userData.body;if(body)body.rotation.z=active()?Math.sin(motionTime*(carrierMoving?2.6:1.15))*.01:0;
    }
    status.sync();
  }
  function showIntro(){
    if(!active())return;tour.reset();stuck=0;introRemaining=2.5;gameScreen.dataset.birthTour='true';status.show('抱っこされている…');
    clearTimeout(introTimer);introTimer=setTimeout(()=>{const state=getState();if(active())dialogue('母',`${state.name}、お外は初めてだね。今日は一緒に村を見てまわろう。`);},650);
  }
  function release(){clearTimeout(introTimer);introRemaining=0;gameScreen.dataset.birthTour='false';status.show('自分の足で歩けるようになった');dialogue('母','さあ、地面へ。今日からは自分の足で歩けるよ。');}
  function dispose(){clearTimeout(introTimer);introRemaining=0;status.dispose();gameScreen.dataset.birthTour='false';}
  return{active,step,afterRender,showIntro,release,floatStatus:status.show,dispose,tour,pace};
}
