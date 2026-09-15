import {createBirthTour} from './birth-tour.js';
import {nearestStation} from './locations.js';

const MANUAL_SPEED=2.45;
const AUTO_SPEED=1.85;
const STEER=Object.freeze([0,.42,-.42,.82,-.82,1.2,-1.2]);
const magnitude=axis=>Math.hypot(axis?.x||0,axis?.y||0);

export function createBirthExperience({document,canvas,gameScreen,view,stations,getState,dialogue}){
  const tour=createBirthTour(stations),layer=document.getElementById('actor-status-layer'),items=new Set(),point=new view.THREE.Vector3();
  const hero=view.scene.getObjectByName('Player'),mother=view.scene.getObjectByName('Mother');
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
    for(const offset of STEER){const angle=base+offset;if(move({x:Math.sin(angle),z:Math.cos(angle)},AUTO_SPEED,dt))return true;}
    return false;
  }
  function speakStation(station){const line=tour.observe(station);if(line)dialogue('母',line);}
  function step(dt,axis){
    if(!active())return{handled:false,moved:false,carrierMoving:false};
    if(document.hidden)return{handled:true,moved:false,carrierMoving:false};
    const state=getState(),manual=magnitude(axis)>.08;let moved=false;introRemaining=Math.max(0,introRemaining-dt);
    if(manual){tour.tick(dt,state.position,true);moved=move(view.cameraVector(axis),MANUAL_SPEED,dt);stuck=0;}
    else if(introRemaining>0)return{handled:true,moved:false,carrierMoving:false,manual:false};
    else{
      const next=tour.tick(dt,state.position,false);if(next.line)dialogue('母',next.line);
      if(next.mode==='travel'&&next.target){moved=toward(next.target,dt);if(moved)stuck=0;else if((stuck+=dt)>=1.6){tour.advance();stuck=0;}}
      else stuck=0;
    }
    if(introRemaining<=0)speakStation(nearestStation(stations,state.position));
    return{handled:true,moved,carrierMoving:moved,manual};
  }
  function actorPoint(actor=hero){
    if(!actor)return null;actor.updateWorldMatrix(true,false);point.set(0,1.65,0);actor.localToWorld(point);point.project(view.camera);
    return{x:(point.x*.5+.5)*canvas.clientWidth,y:(-.5*point.y+.5)*canvas.clientHeight,visible:point.z>=-1&&point.z<=1};
  }
  function syncStatuses(){
    if(!items.size)return;const position=actorPoint();if(!position)return;
    for(const item of items){item.node.hidden=!position.visible;item.node.style.left=`${position.x}px`;item.node.style.top=`${position.y}px`;}
  }
  function floatStatus(text,{duration=2700}={}){
    if(!layer||!text)return;const node=document.createElement('div'),label=document.createElement('span');node.className='actor-status-anchor';label.className='actor-status-text';label.textContent=String(text);node.append(label);layer.append(node);
    const item={node,timer:0};item.timer=setTimeout(()=>{items.delete(item);node.remove();},duration);items.add(item);syncStatuses();
  }
  function afterRender(dt,{carrierMoving=false}={}){
    motionTime+=dt;
    if(mother){
      const legs=mother.userData.legs||[];
      if(active()&&carrierMoving)legs.forEach((leg,i)=>leg.rotation.x=Math.sin(motionTime*7+(i%2)*Math.PI)*.38);else legs.forEach(leg=>leg.rotation.x*=.72);
      const body=mother.userData.body;if(body)body.rotation.z=active()?Math.sin(motionTime*(carrierMoving?2.6:1.15))*.01:0;
    }
    syncStatuses();
  }
  function showIntro(){
    if(!active())return;tour.reset();stuck=0;introRemaining=2.5;gameScreen.dataset.birthTour='true';floatStatus('抱っこされている…');
    clearTimeout(introTimer);introTimer=setTimeout(()=>{const state=getState();if(active())dialogue('母',`${state.name}、お外は初めてだね。今日は一緒に村を見てまわろう。`);},650);
  }
  function release(){clearTimeout(introTimer);introRemaining=0;gameScreen.dataset.birthTour='false';floatStatus('自分の足で歩けるようになった');dialogue('母','さあ、地面へ。今日からは自分の足で歩けるよ。');}
  function clear(){for(const item of items){clearTimeout(item.timer);item.node.remove();}items.clear();}
  function dispose(){clearTimeout(introTimer);introRemaining=0;clear();gameScreen.dataset.birthTour='false';}
  return{active,step,afterRender,showIntro,release,floatStatus,dispose,tour};
}
