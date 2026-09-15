export const MOTION_LIBRARY_REVISION='672074b73ba276876a19e8816ecdc5241817ab47';
export const MOTION_LIBRARY_REPOSITORY='KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0';
export const MOTION_LIBRARY_RAW_BASE=`https://raw.githubusercontent.com/${MOTION_LIBRARY_REPOSITORY}/${MOTION_LIBRARY_REVISION}/addons/kaykit_character_pack_adventures/Characters/gltf`;

export const MOTION_LIBRARY_MODELS=Object.freeze([
  Object.freeze({id:'knight',presetId:'motion-library.knight',label:'Knight',file:'Knight.glb'}),
  Object.freeze({id:'barbarian',presetId:'motion-library.barbarian',label:'Barbarian',file:'Barbarian.glb'}),
  Object.freeze({id:'mage',presetId:'motion-library.mage',label:'Mage',file:'Mage.glb'}),
  Object.freeze({id:'rogue',presetId:'motion-library.rogue',label:'Rogue',file:'Rogue.glb'}),
  Object.freeze({id:'rogue-hooded',presetId:'motion-library.rogue-hooded',label:'Rogue Hooded',file:'Rogue_Hooded.glb'}),
]);

export function motionLibraryModel(id){
  return MOTION_LIBRARY_MODELS.find(row=>row.id===id||row.presetId===id)||null;
}

export function motionLibraryModelURL(rowOrId){
  const row=typeof rowOrId==='string'?motionLibraryModel(rowOrId):rowOrId;
  return row?`${MOTION_LIBRARY_RAW_BASE}/${row.file}`:'';
}
