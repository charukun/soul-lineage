import {CAMERA_PROFILES,createCameraDirector,externalCameraShot} from '@soul/rendering/camera-director';
import {actorScreenSafety,applyCameraPresentation} from '@soul/rendering/camera-presentation-three';
import {battle2CameraWorldHeight} from './battle2-camera-math.js';

export function createBattle2CameraPresentation({stage,world,onZoomChange=()=>{}}={}){
  if(!stage||!world)throw new TypeError('battle2 stage and world canvas are required');
  const director=createCameraDirector({profile:'current3d'});
  let userZoom=1,screenSafety=null,lastSnapshot=null;
  world.dataset.cameraZoom=userZoom.toFixed(2);
  stage.dataset.cameraSystem='shared-director';
  const snapshot=()=>lastSnapshot?structuredClone(lastSnapshot):null;
  const api={
    presentExternal({camera,actor,target=null,position,lookTarget,worldHeight,dt=0,source='johakyu-driven',space='battle2',mode='combat'}={}){
      if(!camera?.isPerspectiveCamera)throw new TypeError('battle2 shared camera requires PerspectiveCamera');
      const authoredShot=externalCameraShot({
        position,lookTarget,
        worldHeight:battle2CameraWorldHeight(worldHeight,userZoom),
        fov:CAMERA_PROFILES.current3d.fov,
        yawOffset:0
      });
      const presentation=director.update({mode,actor,target,authoredShot,aspect:camera.aspect,space,screenSafety},dt);
      applyCameraPresentation(camera,presentation);
      screenSafety=actorScreenSafety(camera,target?[actor,target]:[actor]);
      lastSnapshot={camera:{...presentation,screenSafety},actor,target,yawOffset:0,userZoom,renderer:source};
      world.dataset.cameraProjection='perspective';
      return presentation;
    },
    snapshot,
    setZoom(value){
      userZoom=Math.max(.58,Math.min(1.65,Number(value)||1));
      world.dataset.cameraZoom=userZoom.toFixed(2);
      onZoomChange(userZoom);
      return userZoom;
    },
    reset(){director.reset();screenSafety=null;lastSnapshot=null;return{yaw:0,zoom:userZoom};},
    dispose(){
      director.reset();screenSafety=null;lastSnapshot=null;
      if(world.cameraPresentation===snapshot)delete world.cameraPresentation;
      delete stage.dataset.cameraSystem;
    }
  };
  world.cameraPresentation=snapshot;
  return Object.freeze(api);
}
