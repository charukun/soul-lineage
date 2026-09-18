import {makeModel} from '@soul/housing-assets';
import {defs} from '@soul/world/mura/catalog';

const HOUSE_TYPES=Object.freeze({
  home:Object.freeze({base:'cottage',timber:'roundhouse',stone:'tallhouse',earth:'cottage'}),
  lodge:Object.freeze({base:'tallhouse',timber:'roundhouse',stone:'manor',earth:'tallhouse'}),
  clanManor:Object.freeze({base:'manor',timber:'manor',stone:'manor',earth:'manor'})
});
const PALETTES=Object.freeze({base:2,timber:3,stone:5,earth:0});

export function resolveMuraHouseVisual(kind,material='base',level=1){
  const variants=HOUSE_TYPES[kind];
  if(!variants)return null;
  const def=defs[kind];
  const safeLevel=Math.max(1,Math.min(3,Number(level)||1));
  return Object.freeze({
    type:variants[material]||variants.base,
    palette:PALETTES[material]??PALETTES.base,
    floors:Math.max(def?.floors||1,safeLevel)
  });
}

function fitHouseToMuraFootprint(T,group,kind){
  const def=defs[kind];
  if(!def)return group;
  group.updateMatrixWorld(true);
  const bounds=new T.Box3().setFromObject(group),size=new T.Vector3();
  bounds.getSize(size);
  if(size.x<=0||size.z<=0)return group;
  const scale=Math.min((def.w*.86)/size.x,(def.d*.86)/size.z);
  group.scale.setScalar(scale);
  group.updateMatrixWorld(true);
  const fitted=new T.Box3().setFromObject(group);
  if(Number.isFinite(fitted.min.y))group.position.y-=fitted.min.y;
  group.updateMatrixWorld(true);
  return group;
}

/**
 * Permanent residential MURA buildings reuse the authored house silhouettes from
 * 尽喰廻遊, fitted to the canonical metre footprint. Residential tents remain
 * shared MURA ger-style homes so every app renders the same compact round shelter.
 */
export function createMuraBuildingVisual(T,models,kind,material='base',level=1){
  const house=resolveMuraHouseVisual(kind,material,level);
  if(!house)return models.building(kind,material,level);
  const group=fitHouseToMuraFootprint(T,makeModel(house.type,house.palette,house.floors),kind);
  group.userData.assetBacked=true;
  group.userData.sharedHouseVisual=true;
  group.userData.houseVisualSource='@soul/housing-assets';
  group.userData.houseType=house.type;
  group.userData.muraKind=kind;
  group.userData.entryVisual='housing-door';
  group.userData.localFront='+Z';
  return group;
}
