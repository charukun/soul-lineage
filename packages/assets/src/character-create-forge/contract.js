export const CHARACTER_PACKAGE_SCHEMA='rinne.character-package/v1';
export const CHARACTER_PACKAGE_REVIEW_STATES=Object.freeze(['generated','review-candidate','approved']);
export function validateCharacterPackage(manifest){
  if(manifest?.schemaVersion!==CHARACTER_PACKAGE_SCHEMA)throw new Error('Unsupported Character Package');
  if(!/^[a-z0-9][a-z0-9-]{0,63}$/.test(manifest.id))throw new Error('Invalid Character Package id');
  if(!['single-view','multi-view','enhanced-multi-view'].includes(manifest.reconstructionMode))throw new Error('Invalid reconstruction mode');
  const views=Object.keys(manifest.sourceViews||{});
  if(!views.includes('front')||manifest.reconstructionMode!=='single-view'&&!['side','back'].every(v=>views.includes(v)))throw new Error('Observed views are missing');
  if(manifest.reconstructionMode==='enhanced-multi-view'&&!['front34','back34'].every(v=>views.includes(v)))throw new Error('Enhanced views are missing');
  if(!['RINNE-OWNED','CC0-1.0'].includes(manifest.provenance?.license))throw new Error('Ineligible character provenance');
  if(!CHARACTER_PACKAGE_REVIEW_STATES.includes(manifest.reviewStatus)||manifest.validationStatus!=='passed')throw new Error('Unvalidated Character Package');
  if(!/^[a-f0-9]{64}$/.test(manifest.model?.sha256))throw new Error('Missing model integrity');
  for(const name of ['Idle','Walk','Talk','Attack','Hit','Rest'])if(!manifest.animations?.some(c=>c.name===name&&c.duration>0))throw new Error('Missing '+name);
  for(const name of ['rightHand','leftHand','weapon','secondaryGripTarget','weaponHitboxAnchor','trailOrigin','heldItemAnchor','talkAnchor'])if(!manifest.sockets?.definitions?.[name])throw new Error('Missing socket '+name);
  for(const value of [manifest.bounds?.min,manifest.bounds?.max,...Object.values(manifest.presentation||{})])if(!Array.isArray(value)||value.length!==3||!value.every(Number.isFinite))throw new Error('Invalid presentation bounds');
  return manifest;
}

// Directly compatible with Camera Director cameraSubject / RINNE subjectProvider.
export function characterPackageCameraSubject(manifest,{position={x:0,y:0,z:0},yaw=0,weaponRadius=0}={}){
  validateCharacterPackage(manifest);
  const {min,max}=manifest.bounds,vec=a=>({x:a[0]+position.x,y:a[1]+position.y,z:a[2]+position.z});
  return {id:manifest.id,position:{...position},yaw,height:max[1]-min[1],radius:Math.max(max[0]-min[0],max[2]-min[2])*.5,
    focusHeight:manifest.presentation.focusTarget[1],weaponRadius,bounds:manifest.bounds,
    headAnchor:vec(manifest.presentation.headAnchor),bodyCenter:vec(manifest.presentation.bodyCenter),focusTarget:vec(manifest.presentation.focusTarget),groundPoint:vec(manifest.presentation.groundPoint)};
}
