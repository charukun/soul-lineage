import {makeModel} from '@soul/housing-assets';
import {defs} from '@soul/world/mura/catalog';

const HOUSE_TYPES=Object.freeze({
  home:Object.freeze({base:'cottage',timber:'roundhouse',stone:'tallhouse',earth:'cottage'}),
  lodge:Object.freeze({base:'tallhouse',timber:'roundhouse',stone:'manor',earth:'tallhouse'}),
  clanManor:Object.freeze({base:'manor',timber:'manor',stone:'manor',earth:'manor'})
});
const PALETTES=Object.freeze({base:2,timber:3,stone:5,earth:0});

// These are existing authored silhouettes in @soul/housing-assets. MURA keeps
// kind/footprint/interior/collision authority; this table is presentation only.
const FACILITY_TYPES=Object.freeze({
  guardpost:Object.freeze({type:'roundhouse',palette:1,floors:1}),
  watchtower:Object.freeze({type:'tallhouse',palette:1,floors:3}),
  barracks:Object.freeze({type:'manor',palette:1,floors:2}),
  chapel:Object.freeze({type:'tallhouse',palette:5,floors:2}),
  smith:Object.freeze({type:'bakery',palette:0,floors:1}),
  dojo:Object.freeze({type:'roundhouse',palette:2,floors:1}),
  school:Object.freeze({type:'tallhouse',palette:3,floors:2}),
  clinic:Object.freeze({type:'greenhouse',palette:2,floors:1}),
  inn:Object.freeze({type:'manor',palette:3,floors:2}),
  diner:Object.freeze({type:'bakery',palette:3,floors:1}),
  restaurant:Object.freeze({type:'manor',palette:2,floors:2}),
  weapons:Object.freeze({type:'cottage',palette:0,floors:1}),
  armor:Object.freeze({type:'cottage',palette:1,floors:1}),
  jeweler:Object.freeze({type:'greenhouse',palette:4,floors:1}),
  tools:Object.freeze({type:'cottage',palette:3,floors:1}),
  tavern:Object.freeze({type:'bakery',palette:4,floors:2}),
  furniture:Object.freeze({type:'cottage',palette:2,floors:1})
});

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

export function resolveMuraFacilityVisual(kind,level=1){
  const style=FACILITY_TYPES[kind];
  if(!style)return null;
  const def=defs[kind],safeLevel=Math.max(1,Math.min(3,Number(level)||1));
  return Object.freeze({
    type:style.type,
    palette:style.palette,
    floors:Math.max(style.floors||def?.floors||1,safeLevel)
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
 * MURA owns gameplay identity and collision; authored housing assets own selected
 * village silhouettes. Residential tents remain MURA ger-style homes.
 */
export function createMuraBuildingVisual(T,models,kind,material='base',level=1){
  const visual=resolveMuraHouseVisual(kind,material,level)||resolveMuraFacilityVisual(kind,level);
  if(!visual)return models.building(kind,material,level);
  const group=fitHouseToMuraFootprint(T,makeModel(visual.type,visual.palette,visual.floors),kind);
  group.userData.assetBacked=true;
  group.userData.sharedHouseVisual=true;
  group.userData.houseVisualSource='@soul/housing-assets';
  group.userData.houseType=visual.type;
  group.userData.muraKind=kind;
  group.userData.entryVisual='housing-door';
  group.userData.localFront='+Z';
  return group;
}
