import {MURA_WORLD_SCHEMA,MURA_TERRAIN_ID,validateMuraLayout} from '@soul/world/mura';

export const RINNE_BIRTH_VILLAGE_ID='rinne-windward-birth-v1';
const room=(host,items)=>items.map(([kind,x,z,rot=0],index)=>({id:`${host}.room.${index}`,kind,x,z,rot,phase:'built',level:1,material:'base'}));
const building=(id,kind,x,z,rot=0,items=[])=>({id,kind,x,z,rot,phase:'built',level:1,material:'base',room:room(id,items)});
const object=(id,kind,x,z,rot=0)=>({id,kind,x,z,rot,phase:'built',level:1,material:'base'});

/**
 * RINNE-owned starting village. The spatial grammar deliberately echoes the
 * old Bloodline central square / main street without importing its code or
 * assets. Every item is a current MURA catalog entity, so RINNE and MURA keep
 * one collision/interior/furniture contract while owning different layouts.
 */
export function createRinneBirthVillage(){
  return validateMuraLayout({
    schemaVersion:MURA_WORLD_SCHEMA,
    id:RINNE_BIRTH_VILLAGE_ID,
    name:'風待ちの里',
    terrainId:MURA_TERRAIN_ID,
    revision:1,
    units:'metres',
    coordinateSystem:'right-handed-y-up',
    objects:[
      building('birth-manor','clanManor',-19,-9,.10,[['bed',-5,-5],['bed',4,-5],['table',0,0],['chair',2,1],['shelf',5,-2],['hearth',-5,4],['rug',0,4],['plant',5,5],['lamp',-1,-6]]),
      object('birth-square','campfire',0,0,0),
      object('birth-market','market',1,10,0),
      building('birth-home-west','home',-34,4,.10,[['bed',-3,-3],['table',1,0],['shelf',3,-3],['plant',-3,3],['lamp',3,3]]),
      building('birth-home-southwest','home',-31,-18,-.08,[['bed',-3,-3],['sofa',2,1],['table',-1,2],['hearth',3,-3],['rug',0,0]]),
      building('birth-lodge','lodge',-43,-7,.07,[['bed',-5,-5],['bed',5,-5],['table',0,0],['shelf',-5,5],['sofa',4,4],['lamp',0,-6]]),
      building('birth-inn','inn',-19,-28,.02,[['bed',-5,-4],['bed',5,-4],['sofa',0,2],['hearth',-5,5],['rug',2,5],['lamp',5,5]]),
      building('birth-dojo','dojo',-19,20,-.05,[['bench',-5,2],['bench',5,2],['rug',0,0],['shelf',-5,-4],['lamp',5,-4]]),
      building('birth-school','school',3,23,.03,[['shelf',-5,-4],['shelf',5,-4],['table',0,0],['chair',-3,2],['chair',3,2],['lamp',0,-5]]),
      building('birth-chapel','chapel',24,21,-.04,[['bench',-4,2],['bench',4,2],['table',0,-3],['plant',-5,-6],['lamp',5,-6]]),
      building('birth-smith','smith',25,5,.02,[['workbench',-4,-3],['counter',3,-3],['bench',0,3],['lamp',5,3]]),
      building('birth-clinic','clinic',23,-12,-.03,[['bed',-4,-3],['bed',3,-3],['table',0,2],['plant',5,2],['shelf',-5,3]]),
      building('birth-guardpost','guardpost',-3,-27,0,[['bench',-3,1],['table',2,1],['shelf',-3,-3],['lamp',3,-3]]),
      building('birth-barracks','barracks',13,-31,.02,[['bed',-5,-5],['bed',5,-5],['bench',0,2],['table',0,-1],['lamp',5,5]]),
      building('birth-weapons','weapons',36,6,.04,[['counter',0,-3],['workbench',-4,1],['shelf',4,1],['lamp',0,4]]),
      building('birth-diner','diner',-5,35,-.02,[['table',0,0],['chair',-3,1],['chair',3,1],['counter',0,-4],['hearth',-5,4],['lamp',5,4]]),
      object('birth-watch-west','watchtower',-27,-39,0),
      object('birth-watch-east','watchtower',29,-39,0),
      object('birth-farm','farm',-7,-47,.02),
      object('birth-wheat','wheat',22,-47,0),
      object('birth-logging','logging',-43,-23,0),
      object('birth-quarry','quarry',29,-44,0),
      object('birth-carpenter','carpenter',-42,-32,.03),
      object('birth-orchard','orchard',24,39,0),
      object('birth-harbor','harbor',166,0,0),
      object('birth-bench-west','bench',-7,5,.05),
      object('birth-bench-east','bench',8,5,-.05),
      object('birth-lamp-north','lamp',-5,13,0),
      object('birth-lamp-south','lamp',5,-13,0),
      object('birth-lamp-west','lamp',-14,0,0),
      object('birth-lamp-east','lamp',14,0,0),
      object('birth-gate-west','fence',-10,-38,0),
      object('birth-gate-east','fence',10,-38,0),
      object('birth-gate-flank-west','fence',-14,-38,0),
      object('birth-gate-flank-east','fence',14,-38,0),
      object('birth-tree-square-west','tree',-13,12,0),
      object('birth-tree-square-east','tree',14,13,0),
    ],
  });
}
