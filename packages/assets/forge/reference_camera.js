/** Coordinate adapter for pinned camera_fitting_math.project_landmark.
 * Upstream rotates positive-depth coordinates pitch -> yaw -> roll. Three.js
 * looks along negative Z, so its inverse view is Rx(pitch) Ry(yaw) Rz(-roll).
 * This camera is solely reconstruction evidence; it is not Camera Director.
 */
export function applyReferenceCamera(THREE,camera,descriptor){
  const p=descriptor?.fit?.cameraParameters;
  if(!p||!Number.isFinite(descriptor.fit.finalReprojectionError)||descriptor.fit.finalReprojectionError>2)throw Error('A calibrated upstream camera with pixel residual <= 2 is required');
  if(![p.fovDegrees,p.yawDegrees,p.pitchDegrees,p.rollDegrees,...p.position,descriptor.imageWidth,descriptor.imageHeight].every(Number.isFinite))throw Error('Non-finite camera data');
  camera.fov=p.fovDegrees;camera.aspect=descriptor.imageWidth/descriptor.imageHeight;
  camera.position.fromArray(p.position);
  const radians=THREE.MathUtils.degToRad;
  camera.rotation.set(radians(p.pitchDegrees),radians(p.yawDegrees),-radians(p.rollDegrees),'XYZ');
  camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  camera.userData.reconstructionAuthority='img2threejs camera_fitting_math';
  return camera;
}
