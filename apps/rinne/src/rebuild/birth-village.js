import {MURA_WORLD_SCHEMA,MURA_TERRAIN_ID,validateMuraLayout} from '@soul/world/mura';
import {refreshRinneBirthVillage} from './village-journey.js';

export const RINNE_BIRTH_VILLAGE_ID='rinne-windward-birth-v1';
const room=(host,items)=>items.map(([kind,x,z,rot=0],index)=>({id:`${host}.room.${index}`,kind,x,z,rot,phase:'built',level:1,material:'base'}));
const building=(id,kind,x,z,rot=0,items=[])=>({id,kind,x,z,rot,phase:'built',level:1,material:'base',room:room(id,items)});
const object=(id,kind,x,z,rot=0)=>({id,kind,x,z,rot,phase:'built',level:1,material:'base'});

/**
 * Stable birth-village identity and room IDs, projected onto the current
 * RINNE journey layout. Keep the v2 source coordinates as the exact migration
 * baseline; custom/shared exteriors are never silently replaced.
 */
export function createRinneBirthVillage(){
  return refreshRinneBirthVillage(validateMuraLayout({
    schemaVersion:MURA_WORLD_SCHEMA,
    id:RINNE_BIRTH_VILLAGE_ID,
    name:'風待ちの里',
    terrainId:MURA_TERRAIN_ID,
    revision:2,
    units:'metres',
    coordinateSystem:'right-handed-y-up',
    objects:[
      building('birth-manor','clanManor',-14,-5,.04,[['bed',-3.5,-4],['bed',3.5,-4],['table',0,0],['chair',2,1],['shelf',4,-1],['hearth',-4,3.5],['rug',0,3],['plant',4,4.5],['lamp',-1,-5]]),
      object('birth-square','campfire',0,0,0),
      object('birth-market','market',0,10,0),
      building('birth-home-west','home',-22,9,.04,[['bed',-1.2,-1.4],['table',.7,0],['shelf',1.2,-2.2],['plant',-1.8,2],['lamp',1.8,2]]),
      building('birth-home-southwest','home',-25,-11,-.04,[['bed',-1.2,-1.4],['sofa',.8,.6],['table',-.8,1.7],['hearth',1.3,-2],['rug',0,0]]),
      building('birth-lodge','lodge',-32,0,.03,[['bed',-2.5,-2.8],['bed',2.5,-2.8],['table',0,0],['shelf',-2.8,3],['sofa',2.3,2.5],['lamp',0,-3.8]]),
      building('birth-inn','inn',-13,-19,.02,[['bed',-2.5,-2.8],['bed',2.5,-2.8],['sofa',0,2.2],['hearth',-2.8,3],['rug',1.8,2.8],['lamp',2.8,3]]),
      building('birth-dojo','dojo',-11,22,-.03,[['bench',-2.8,1.5],['bench',2.8,1.5],['rug',0,0],['shelf',-3,-2.5],['lamp',3,-2.5]]),
      building('birth-school','school',1,22,.02,[['shelf',-2.8,-2.4],['shelf',2.8,-2.4],['table',0,0],['chair',-2,1.8],['chair',2,1.8],['lamp',0,-3.2]]),
      building('birth-chapel','chapel',13,21,-.03,[['bench',-2.4,1.5],['bench',2.4,1.5],['table',0,-2.8],['plant',-2.8,-4],['lamp',2.8,-4]]),
      building('birth-smith','smith',26,6,.02,[['workbench',-1.4,-1.2],['counter',1.4,-1.2],['bench',0,1.8],['lamp',2.2,2]]),
      building('birth-clinic','clinic',14,-3,-.02,[['bed',-1.8,-1.5],['bed',1.6,-1.5],['table',0,1.5],['plant',2.4,1.8],['shelf',-2.3,2]]),
      building('birth-guardpost','guardpost',0,-17,Math.PI,[['bench',-1.2,.8],['table',1,.8],['shelf',-1.3,-1.5],['lamp',1.7,-1.5]]),
      building('birth-barracks','barracks',10,-26,.02,[['bed',-2.5,-2.5],['bed',2.5,-2.5],['bench',0,1.8],['table',0,-.5],['lamp',3.2,3.2]]),
      building('birth-weapons','weapons',23,-12,.03,[['counter',0,-1.5],['workbench',-1.6,.6],['shelf',1.8,.8],['lamp',0,2.3]]),
      building('birth-diner','diner',-22,19,-.02,[['table',0,0],['chair',-1.8,.8],['chair',1.8,.8],['counter',0,-2.2],['hearth',-2.3,2.2],['lamp',2.4,2.2]]),
      object('birth-watch-west','watchtower',-18,-31,0),
      object('birth-watch-east','watchtower',20,-29,0),
      object('birth-farm','farm',-4,-39,.02),
      object('birth-wheat','wheat',10,-40,0),
      object('birth-logging','logging',-29,-26,0),
      object('birth-quarry','quarry',27,-39,0),
      object('birth-carpenter','carpenter',-27,-39,.03),
      object('birth-orchard','orchard',18,36,0),
      object('birth-harbor','harbor',166,0,0),
      object('birth-bench-west','bench',-6,5,.05),
      object('birth-bench-east','bench',6,5,-.05),
      object('birth-lamp-north','lamp',-5,16,0),
      object('birth-lamp-south','lamp',5,-12,0),
      object('birth-lamp-west','lamp',-10,0,0),
      object('birth-lamp-east','lamp',10,0,0),
      object('birth-gate-west','fence',-8,-31,0),
      object('birth-gate-east','fence',8,-31,0),
      object('birth-gate-flank-west','fence',-12,-31,0),
      object('birth-gate-flank-east','fence',12,-31,0),
      object('birth-tree-square-west','tree',-10,13,0),
      object('birth-tree-square-east','tree',11,14,0),
    ],
  }));
}
