export const MOTION_LIBRARY_REVISION='672074b73ba276876a19e8816ecdc5241817ab47';
export const MOTION_LIBRARY_REPOSITORY='KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0';
export const MOTION_LIBRARY_RAW_BASE=`https://raw.githubusercontent.com/${MOTION_LIBRARY_REPOSITORY}/${MOTION_LIBRARY_REVISION}/addons/kaykit_character_pack_adventures/Characters/gltf`;
export const SKELETON_LIBRARY_REVISION='15b62b9bad122f72926c10fb14d622c73819fa54';
export const SKELETON_LIBRARY_REPOSITORY='KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0';
export const SKELETON_LIBRARY_PUBLIC_BASE='./asset-review/models/kaykit-skeletons';

export const MOTION_LIBRARY_MODELS=Object.freeze([
  Object.freeze({id:'knight',presetId:'motion-library.knight',label:'Knight',file:'Knight.glb',source:'adventurers'}),
  Object.freeze({id:'barbarian',presetId:'motion-library.barbarian',label:'Barbarian',file:'Barbarian.glb',source:'adventurers'}),
  Object.freeze({id:'mage',presetId:'motion-library.mage',label:'Mage',file:'Mage.glb',source:'adventurers'}),
  Object.freeze({id:'rogue',presetId:'motion-library.rogue',label:'Rogue',file:'Rogue.glb',source:'adventurers'}),
  Object.freeze({id:'rogue-hooded',presetId:'motion-library.rogue-hooded',label:'Rogue Hooded',file:'Rogue_Hooded.glb',source:'adventurers'}),
  Object.freeze({id:'skeleton-warrior',presetId:'motion-library.skeleton-warrior',label:'Skeleton Warrior',file:'Skeleton_Warrior.glb',source:'skeletons',publicPath:`${SKELETON_LIBRARY_PUBLIC_BASE}/Skeleton_Warrior.glb`}),
  Object.freeze({id:'skeleton-rogue',presetId:'motion-library.skeleton-rogue',label:'Skeleton Rogue',file:'Skeleton_Rogue.glb',source:'skeletons',publicPath:`${SKELETON_LIBRARY_PUBLIC_BASE}/Skeleton_Rogue.glb`}),
  Object.freeze({id:'skeleton-mage',presetId:'motion-library.skeleton-mage',label:'Skeleton Mage',file:'Skeleton_Mage.glb',source:'skeletons',publicPath:`${SKELETON_LIBRARY_PUBLIC_BASE}/Skeleton_Mage.glb`}),
  Object.freeze({id:'skeleton-minion',presetId:'motion-library.skeleton-minion',label:'Skeleton Minion',file:'Skeleton_Minion.glb',source:'skeletons',publicPath:`${SKELETON_LIBRARY_PUBLIC_BASE}/Skeleton_Minion.glb`}),
]);

export function motionLibraryModel(id){
  return MOTION_LIBRARY_MODELS.find(row=>row.id===id||row.presetId===id)||null;
}

export function motionLibraryModelURL(rowOrId){
  const row=typeof rowOrId==='string'?motionLibraryModel(rowOrId):rowOrId;
  if(!row)return '';
  if(row.publicPath)return row.publicPath;
  return `${MOTION_LIBRARY_RAW_BASE}/${row.file}`;
}
