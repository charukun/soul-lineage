import {CAMERA_PROFILES,createCameraDirector,externalCameraShot} from '@soul/rendering/camera-director';
import {actorScreenSafety,applyCameraPresentation} from '@soul/rendering/camera-presentation-three';
import {createSnapCameraControl} from '@soul/rendering/snap-camera-control';
import {battle2CameraWorldHeight} from './battle2-camera-math.js';
import '@soul/rendering/snap-camera-control.css';

export function createBattle2CameraPresentation({stage,world,onZoomChange=()=>{}}={}){
  if(!stage||!world)throw new TypeError('battle2 stage and world canvas are required');
  const host=stage.querySelector('[data-battle2-camera-host]');
  if(!host)throw new Error('battle2 camera control host is missing');
  const director=createCameraDirector({profile:'current3d'});
  let yawOffset=0,userZoom=1,screenSafety=null,lastSnapshot=null;
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
    presentExternal({camera,actor,target=null,position,lookTarget,worldHeight,dt=0,source='johakyu-driven',space='battle2',mode='combat'}={}){
      if(!camera?.isPerspectiveCamera)throw new TypeError('battle2 shared camera requires PerspectiveCamera');
      const authoredShot=externalCameraShot({
        position,lookTarget,
        worldHeight:battle2CameraWorldHeight(worldHeight,userZoom),
        fov:CAMERA_PROFILES.current3d.fov,
        yawOffset
      });
      const presentation=director.update({mode,actor,target,authoredShot,aspect:camera.aspect,space,screenSafety},dt);
      applyCameraPresentation(camera,presentation);
      screenSafety=actorScreenSafety(camera,target?[actor,target]:[actor]);
      lastSnapshot={camera:{...presentation,screenSafety},actor,target,yawOffset,userZoom,renderer:source};
      world.dataset.cameraProjection='perspective';
      return presentation;
    },
    snapshot,
    setZoom(value){return cameraControl.setZoom(value).zoom;},
    reset(){director.reset();screenSafety=null;lastSnapshot=null;return cameraControl.snapshot();},
    dispose(){
      cameraControl.dispose();director.reset();screenSafety=null;lastSnapshot=null;
      if(world.cameraPresentation===snapshot)delete world.cameraPresentation;
      delete stage.dataset.cameraSystem;
    }
  };
  world.cameraPresentation=snapshot;
  return Object.freeze(api);
}
