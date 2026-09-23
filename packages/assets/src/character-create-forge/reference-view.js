import {applyReferenceCamera} from '../../forge/reference_camera.js';

/** Adapt a solved reconstruction view into an authored Camera Director shot.
 * Object-fit contain preserves the source image's pixel proportions in a Lab
 * viewport of any aspect. The Director still owns presentation of that shot.
 */
export function characterReferenceShot(THREE,manifest,view,viewportAspect){
  if(!manifest.referenceReview)return null;
  const rotations={front:0,side:-Math.PI/2,back:Math.PI,front34:-Math.PI/4,rear34:-3*Math.PI/4};
  if(!(view in rotations))return null;
  const descriptor=manifest.referenceReview.cameras?.[['front34','rear34'].includes(view)?'front':view];
  if(!descriptor)throw new Error('Missing calibrated reference view '+view);
  if(!Number.isFinite(viewportAspect)||viewportAspect<=0)throw new Error('Invalid review viewport aspect');
  const camera=applyReferenceCamera(THREE,new THREE.PerspectiveCamera(),descriptor),sourceAspect=camera.aspect;
  if(viewportAspect<sourceAspect)camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)*sourceAspect/viewportAspect));
  const distance=camera.position.length(),target=camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(distance).add(camera.position);
  const up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
  return {position:camera.position.toArray(),lookTarget:target.toArray(),up:up.toArray(),fov:camera.fov,modelYaw:rotations[view],authority:'img2threejs',sourceSize:[descriptor.imageWidth,descriptor.imageHeight]};
}
