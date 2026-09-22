import {createLocomotion} from './locomotion.js';
import {muraSharedLine} from '@soul/world/mura/dialogue';
import {createSpeechBubbles} from '@soul/shared-ui/speech-bubbles';
import {createActorStatus} from './actor-status.js';
import {birthTourPace,createBirthTour} from './birth-tour.js';
import {nearestStation} from './locations.js';

const STEER=Object.freeze([0,.42,-.42,.82,-.82,1.2,-1.2]);
const magnitude=axis=>Math.hypot(axis?.x||0,axis?.y||0);

export function createBirthExperience({document,canvas,gameScreen,view,stations,getState}){
  const tour=createBirthTour(stations),pace=birthTourPace(stations),status=createActorStatus({document,canvas,view,actorName:'Player'}),mother=view.scene.getObjectByName('Mother');
  const speech=createSpeechBubbles({document,layer:document.getElementById('actor-status-layer'),duration:5000,maxVisible:3}),speechPoint=new view.THREE.Vector3();
  const locomotion=createLocomotion({canMoveTo:(...args)=>view.canMoveTo(...args),carried:true});
  let introTimer=0,introRemaining=0,stuck=0,motionTime=0,stridePhase=0,carrierSpeed=0,speechSequence=0;

  const active=()=>{const state=getState();return state?.zone==='village'&&!state?.down&&!state?.ended&&state?.phase==='birth';};
  const tutorialActive=()=>document.body?.classList?.contains('rinne-first-run-active')===true;
  const say=text=>!tutorialActive()&&text&&speech.show({id:`rinne-mother-${++speechSequence}`,text,personId:'Mother'});
  function stopMotion(){locomotion.reset();carrierSpeed=0;view.setCarrierMotion?.({active:active(),moving:false,speed:0});}
  function move(direction,speed,dt){
    const result=locomotion.step({state:getState(),direction,speed,dt});
    carrierSpeed=result.speed;return result.moved;
  }
  function toward(target,dt){
    const state=getState(),dx=target.x-state.position.x,dz=target.z-state.position.z,distance=Math.hypot(dx,dz);
    if(distance<.02)return move(null,0,dt);
    const base=Math.atan2(dx,dz),speed=Math.min(pace.autoSpeed,distance*3.5),lookahead=Math.min(.35,distance);
    let direction={x:Math.sin(base),z:Math.cos(base)};
    // Pick intent without moving. Integrate velocity only once per frame.
    for(const offset of STEER){const angle=base+offset,x=Math.sin(angle),z=Math.cos(angle);if(view.canMoveTo(state.position.x+x*lookahead,state.position.z+z*lookahead,.42,'village')){direction={x,z};break;}}
    return move(direction,speed,dt);
  }
  function speakStation(station){const line=tour.observe(station);if(line)say(line);}
  function syncSpeech(){
    speech.sync({resolve:()=>{
      const actor=view.scene.getObjectByName('Mother');if(!actor)return null;
      speechPoint.set(0,1.85,0);actor.localToWorld(speechPoint);speechPoint.project(view.camera);
      const width=view.viewport?.width??canvas.clientWidth,height=view.viewport?.height??canvas.clientHeight,x=(speechPoint.x*.5+.5)*width,y=(-.5*speechPoint.y+.5)*height;
      return{x,y:y-8,scale:1,visible:speechPoint.z>=-1&&speechPoint.z<=1,hidden:x<12||x>width-12||y<44||y>height-70};
    }});
  }
  function step(dt,axis){
    if(!active()){stopMotion();return{handled:false,moved:false,carrierMoving:false};}
    if(document.hidden||document.querySelector('dialog[open]')){stopMotion();return{handled:true,moved:false,carrierMoving:false};}
    const state=getState(),manual=magnitude(axis)>.08;let moved=false;introRemaining=Math.max(0,introRemaining-dt);
    if(manual){tour.tick(dt,state.position,true);moved=move(view.cameraVector(axis),pace.manualSpeed,dt);stuck=0;}
    else if(tutorialActive()||introRemaining>0){stopMotion();return{handled:true,moved:false,carrierMoving:false,manual:false};}
    else if(state.interior){moved=move(null,0,dt);stuck=0;}
    else{
      const next=tour.tick(dt,state.position,false);if(next.line)say(next.line);
      if(next.mode==='travel'&&next.target){moved=toward(next.target,dt);if(moved)stuck=0;else if((stuck+=dt)>=1.6){tour.advance();stuck=0;}}
      else{moved=move(null,0,dt);stuck=0;}
    }
    if(!tutorialActive()&&introRemaining<=0)speakStation(nearestStation(stations,state.position));
    // Publish actual contact motion before the character stage samples this frame.
    view.setCarrierMotion?.({active:true,moving:moved,speed:carrierSpeed});
    return{handled:true,moved,carrierMoving:moved,manual};
  }
  function afterRender(dt,{carrierMoving=false}={}){
    motionTime+=dt;
    if(view.setCarrierMotion)view.setCarrierMotion({active:active(),moving:carrierMoving,speed:carrierSpeed});
    else if(mother){
      const legs=mother.userData.legs||[],cadence=Math.min(11.5,6.2+carrierSpeed*.72);stridePhase+=Math.max(0,dt)*cadence;
      if(active()&&carrierMoving)legs.forEach((leg,i)=>leg.rotation.x=Math.sin(stridePhase+(i%2)*Math.PI)*.38);else legs.forEach(leg=>leg.rotation.x*=.72);
      const body=mother.userData.body;if(body)body.rotation.z=active()?Math.sin(motionTime*(carrierMoving?2.6:1.15))*.01:0;
    }
    status.sync();syncSpeech();
  }
  function showIntro(){
    if(!active())return;stopMotion();tour.reset();stuck=0;carrierSpeed=0;introRemaining=2.5;gameScreen.dataset.birthTour='true';status.show('抱っこされている…');
    clearTimeout(introTimer);introTimer=setTimeout(()=>{const state=getState(),line=muraSharedLine('first-outing');if(active()&&line)say(`${state.name}、${line}`);},650);
  }
  function release(){stopMotion();clearTimeout(introTimer);introRemaining=0;carrierSpeed=0;view.setCarrierMotion?.({active:false,moving:false,speed:0});gameScreen.dataset.birthTour='false';status.show('自分の足で歩けるようになった');const line=muraSharedLine('walk-alone');if(line)say(line);}
  function dispose(){stopMotion();clearTimeout(introTimer);introRemaining=0;carrierSpeed=0;view.setCarrierMotion?.({active:false,moving:false,speed:0});speech.dispose();status.dispose();gameScreen.dataset.birthTour='false';}
  return{active,step,afterRender,showIntro,release,floatStatus:status.show,dispose,tour,pace};
}
