import {CAMERA_PROFILES,createCameraDirector,externalCameraShot} from '@soul/rendering/camera-director';
import {actorScreenSafety,applyCameraPresentation} from '@soul/rendering/camera-presentation-three';
import {createSnapCameraControl,tiltCameraOffsetForZoom} from '@soul/rendering/snap-camera-control';
import {battle2CameraWorldHeight,inspirationShotWeight} from './battle2-camera-math.js';
import '@soul/rendering/snap-camera-control.css';

export function createBattle2CameraPresentation({stage,world,onZoomChange=()=>{}}={}){
  if(!stage||!world)throw new TypeError('battle2 stage and world canvas are required');
  const host=stage.querySelector('[data-battle2-camera-host]');
  if(!host)throw new Error('battle2 camera control host is missing');
  const director=createCameraDirector({profile:'current3d'});
  let yawOffset=0,userZoom=1,screenSafety=null,lastSnapshot=null,inspiration=null;
  const cameraControl=createSnapCameraControl({
    document:world.ownerDocument||document,
    container:host,
    initialZoom:1,
    minZoom:.58,
    maxZoom:1.65,
    ariaLabel:'カメラ操作。横スワイプで45度回転、縦スワイプでズーム',
    onChange:state=>{
      yawOffset=state.yaw;userZoom=state.zoom;onZoomChange(state.zoom);
      world.dataset.cameraStep=String(state.index);world.dataset.cameraZoom=state.zoom.toFixed(2);
    }
  });
  cameraControl.element.dataset.battle2Camera='true';
  stage.dataset.cameraSystem='shared-director';
  const snapshot=()=>lastSnapshot?structuredClone(lastSnapshot):null;
  const api={
    beginInspiration(event,actors=[]){
      const target=actors.find(row=>row.id===event?.targetId),position=target?.position;
      if(!position)return false;
      inspiration={targetId:event.targetId,targetPosition:{x:position.x,y:position.y||0,z:position.z},
        elapsed:0,duration:Math.min(2.5,Math.max(.5,Number(event.firstInspirationPresentation?.cameraSeconds)||1.45))};
      return true;
    },
    presentExternal({camera,actor,target=null,position,lookTarget,worldHeight,dt=0,source='johakyu-driven',space='battle2',mode='combat'}={}){
      if(!camera?.isPerspectiveCamera)throw new TypeError('battle2 shared camera requires PerspectiveCamera');
      const offset=tiltCameraOffsetForZoom({x:position.x-lookTarget.x,y:position.y-lookTarget.y,z:position.z-lookTarget.z},1+(userZoom-1)*1.9);
      let framedPosition={x:lookTarget.x+offset.x,y:lookTarget.y+offset.y,z:lookTarget.z+offset.z};
      let framedTarget=lookTarget,framedHeight=battle2CameraWorldHeight(worldHeight,userZoom),framedMode=mode;
      if(inspiration&&actor?.position){
        const weight=inspirationShotWeight(inspiration.elapsed,inspiration.duration);
        const point={x:(actor.position.x+inspiration.targetPosition.x)/2,
          y:(actor.position.y+inspiration.targetPosition.y)/2+.9,
          z:(actor.position.z+inspiration.targetPosition.z)/2};
        const horizontal=Math.hypot(offset.x,offset.z)||1;
        const close={x:point.x+offset.x/horizontal*12,y:point.y+9.5,z:point.z+offset.z/horizontal*12};
        framedPosition={x:framedPosition.x+(close.x-framedPosition.x)*weight,
          y:framedPosition.y+(close.y-framedPosition.y)*weight,
          z:framedPosition.z+(close.z-framedPosition.z)*weight};
        framedTarget={x:lookTarget.x+(point.x-lookTarget.x)*weight,
          y:lookTarget.y+(point.y-lookTarget.y)*weight,z:lookTarget.z+(point.z-lookTarget.z)*weight};
        framedHeight=framedHeight+(battle2CameraWorldHeight(16,userZoom)-framedHeight)*weight;
        framedMode='combat';
        inspiration.elapsed+=Math.max(0,Math.min(.08,dt));
        if(inspiration.elapsed>=inspiration.duration)inspiration=null;
      }
      const authoredShot=externalCameraShot({position:framedPosition,lookTarget:framedTarget,
        worldHeight:framedHeight,fov:CAMERA_PROFILES.current3d.fov,yawOffset});
      const presentation=director.update({mode:framedMode,actor,target,authoredShot,aspect:camera.aspect,space,screenSafety},dt);
      applyCameraPresentation(camera,presentation);
      screenSafety=actorScreenSafety(camera,target?[actor,target]:[actor]);
      lastSnapshot={camera:{...presentation,screenSafety},actor,target,yawOffset,userZoom,renderer:source,inspirationActive:Boolean(inspiration)};
      world.dataset.cameraProjection='perspective';
      return presentation;
    },
    snapshot,
    cancelInspiration(){inspiration=null;},
    setZoom(value){return cameraControl.setZoom(value).zoom;},
    reset(){director.reset();screenSafety=null;lastSnapshot=null;inspiration=null;return cameraControl.snapshot();},
    dispose(){
      cameraControl.dispose();director.reset();screenSafety=null;lastSnapshot=null;inspiration=null;
      if(world.cameraPresentation===snapshot)delete world.cameraPresentation;
      delete stage.dataset.cameraSystem;
    }
  };
  world.cameraPresentation=snapshot;
  return Object.freeze(api);
}
