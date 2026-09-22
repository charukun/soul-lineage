import { validateMuraLayout, riverX, muraEntry } from '@soul/world/mura';

// RINNE-owned geometry only. Shared/custom villages and the life/combat rules stay untouched.
export const JOURNEY_VILLAGE_ID='rinne-windward-birth-v1';
export const JOURNEY_REVISION=3;
const placements=[
  ['birth-manor','clanManor',[-14,-5,0.04],[-19,-7,Math.PI/2]],
  ['birth-square','campfire',[0,0,0],[0,0,0]],
  ['birth-market','market',[0,10,0],[-18,7,0]],
  ['birth-home-west','home',[-22,9,0.04],[-36,10,0]],
  ['birth-home-southwest','home',[-25,-11,-0.04],[-34,-17,0]],
  ['birth-lodge','lodge',[-32,0,0.03],[-45,-3,Math.PI/2]],
  ['birth-inn','inn',[-13,-19,0.02],[-23,22,Math.PI]],
  ['birth-dojo','dojo',[-11,22,-0.03],[5,-21,0]],
  ['birth-school','school',[1,22,0.02],[1,24,Math.PI]],
  ['birth-chapel','chapel',[13,21,-0.03],[17,24,Math.PI]],
  ['birth-smith','smith',[26,6,0.02],[25,-9,0]],
  ['birth-clinic','clinic',[14,-3,-0.02],[-15,-24,0]],
  ['birth-guardpost','guardpost',[0,-17,Math.PI],[12,-40,Math.PI]],
  ['birth-barracks','barracks',[10,-26,0.02],[27,-35,Math.PI]],
  ['birth-weapons','weapons',[23,-12,0.03],[25,-22,0]],
  ['birth-diner','diner',[-22,19,-0.02],[-36,24,Math.PI]],
  ['birth-watch-west','watchtower',[-18,-31,0],[-4,-43,0]],
  ['birth-watch-east','watchtower',[20,-29,0],[28,-47,0]],
  ['birth-farm','farm',[-4,-39,0.02],[-22,-45,0]],
  ['birth-wheat','wheat',[10,-40,0],[-9,-61,0]],
  ['birth-logging','logging',[-29,-26,0],[-44,-26,0]],
  ['birth-quarry','quarry',[27,-39,0],[40,-44,0]],
  ['birth-carpenter','carpenter',[-27,-39,0.03],[-33,-37,0]],
  ['birth-orchard','orchard',[18,36,0],[34,31,0]],
  ['birth-harbor','harbor',[166,0,0],[166,0,0]],
  ['birth-bench-west','bench',[-6,5,0.05],[-5,7,0]],
  ['birth-bench-east','bench',[6,5,-0.05],[6,7,0]],
  ['birth-lamp-north','lamp',[-5,16,0],[-4,16,0]],
  ['birth-lamp-south','lamp',[5,-12,0],[7,-33,0]],
  ['birth-lamp-west','lamp',[-10,0,0],[-9,-1,0]],
  ['birth-lamp-east','lamp',[10,0,0],[35,6,0]],
  ['birth-gate-west','fence',[-8,-31,0],[0,-38,0]],
  ['birth-gate-east','fence',[8,-31,0],[8,-48,0]],
  ['birth-gate-flank-west','fence',[-12,-31,0],[-4,-38,0]],
  ['birth-gate-flank-east','fence',[12,-31,0],[12,-48,0]],
  ['birth-tree-square-west','tree',[-10,13,0],[-10,17,0]],
  ['birth-tree-square-east','tree',[11,14,0],[23,18,0]],
];
const extras=[
  ['journey-inn-seat','bench',-25,13],['journey-school-seat','bench',7,16],
  ['journey-chapel-lamp','wardlamp',21,13],['journey-clinic-flowers','flowers',-18,-15],
  ['journey-gate-seat','logseat',2,-33],['journey-gate-lamp','wardlamp',6,-34],
  ['journey-forest-seat','logseat',-40,-18],['journey-craft-table','workbench',-33,-30],
  ['journey-orchard-seat','logseat',37,41],['journey-orchard-flowers','flowers',30,41],
  ['journey-ford-south-seat','logseat',52,-35],['journey-ford-south-lamp','wardlamp',54,-38],
  ['journey-ford-east-seat','bench',109,-38],['journey-ford-north-seat','logseat',49,44],
  ['journey-port-seat','bench',157,11],['journey-port-lamp','wardlamp',157,4],
  ['journey-home-flowers','flowers',-10,-10],['journey-learning-flowers','flowers',10,17],
];
const matches=(objects,coordinates)=>objects.length===placements.length&&placements.every(([id,kind,before,after])=>{
  const o=objects.find(row=>row.id===id),at=coordinates==='before'?before:after;
  return o?.kind===kind&&o.phase==='built'&&o.x===at[0]&&o.z===at[1]&&o.rot===at[2];
});

/** Upgrade only the untouched built-in v2 exterior. Preserve furniture, IDs and family/save identity. */
export function refreshRinneBirthVillage(layout){
  if(layout?.__sharedWorldCode||layout?.id!==JOURNEY_VILLAGE_ID||layout.revision!==2||!matches(layout.objects,'before'))return layout;
  const positions=new Map(placements.map(([id,, ,after])=>[id,after]));
  return validateMuraLayout({...layout,revision:JOURNEY_REVISION,objects:[
    ...layout.objects.map(o=>{const [x,z,rot]=positions.get(o.id);return {...o,x,z,rot};}),
    ...extras.map(([id,kind,x,z])=>({id,kind,x,z,rot:0,phase:'built',level:1,material:'base'})),
  ]});
}

export function isJourneyVillage(layout){
  if(layout?.__sharedWorldCode||layout?.id!==JOURNEY_VILLAGE_ID||layout.revision!==JOURNEY_REVISION)return false;
  return matches(layout.objects.filter(o=>placements.some(([id])=>o.id===id)),'after')
    &&layout.objects.length===placements.length+extras.length
    &&extras.every(([id,kind,x,z])=>layout.objects.some(o=>o.id===id&&o.kind===kind&&o.x===x&&o.z===z&&o.rot===0&&o.phase==='built'));
}

const point=(id,x,z,label)=>({id,x,z,label});
export function villageJourneyRoads(){
  const south=riverX(-42),north=riverX(54);
  const nodes=[
    point('home',-8,-7,'一族の家'),point('square',0,3.75,'集いの広場'),
    point('learning',0,14,'学びの小径'),point('prayer',17,14,'祈りの庭'),
    point('east',34,10,'旅立ちの辻'),point('forge',34,-3.5,'鍛冶の通り'),
    point('yard',13,-3.5,'稽古の庭'),point('south',13,-29,'南の分かれ道'),
    point('return',-6,-31,'帰りの小径'),point('clinic',-7,-17,'看護の庭'),
    point('market',-28,14,'暮らしの通り'),point('hamlet',-29,-16,'家並みの小径'),
    point('home-front',-29,-10,'家並みの小径'),point('forest-front',-39,-10,'木こりの小径'),point('forest',-39,-18,'木こりの小径'),point('workshop',-33,-32,'木工の庭'),
    point('farm',-22,-35,'畑の小径'),point('farm-west',-39,-32,'畑の外周'),point('field-west',-39,-54,'畑の外周'),
    point('field',-9,-54,'小麦の小径'),
    point('gate',4,-35,'見張りの休み場'),point('gate-out',5,-45,'村外への道'),
    point('road-east',48,-3.5,'港街道'),point('south-approach',52,-42,'南の渡し'),
    point('south-west',south-12,-42,'南の渡し'),point('south-east',south+12,-42,'南の渡し'),
    point('coast-south',110,-42,'海辺の街道'),point('coast-turn',153,-12,'船着き場へ'),
    point('port',156,7,'帰還の船着き場'),
    point('orchard-turn',43,19,'果樹園の小径'),point('orchard',43,40,'実りの庭'),
    point('north-approach',49,48,'北の休み場'),point('north-west',north-12,54,'北の渡し'),
    point('north-east',north+12,54,'北の渡し'),point('coast-north',143,54,'海辺の小径'),
    point('coast-home',156,20,'故郷へ続く道'),
  ];
  const chains=[
    ['home','square','learning','prayer','east','forge','yard','south','return','clinic','home'],
    ['learning','market','hamlet','clinic'],['hamlet','home-front','forest-front','forest','workshop','farm','return'],
    ['workshop','farm-west','field-west','field'],['yard','square'],
    ['south','gate','gate-out'],
    ['forge','road-east','south-approach','south-west','south-east','coast-south','coast-turn','port'],
    ['east','orchard-turn','orchard','north-approach','north-west','north-east','coast-north','coast-home','port'],
  ];
  const edges=chains.flatMap(chain=>chain.slice(1).map((id,i)=>({from:chain[i],to:id,danger:id==='gate-out'||chain[i]==='gate-out',width:id==='gate-out'?1.8:2.4})));
  return {nodes,edges};
}

const contexts=new WeakMap();
export const journeyFor=stations=>contexts.get(stations)||null;

/** Existing activity types, not new economy/quest systems. Outdoor stops never sit on a door. */
export function registerVillageJourney(layout,stations){
  if(!isJourneyVillage(layout))return stations;
  const byId=new Map(stations.map(row=>[row.id,row]));
  const relocate=(id,x,z,label,radius=1.25)=>{const row=byId.get(id);if(row)Object.assign(row,{x,z,label:label||row.label,radius});};
  relocate('home',-8,-7,'一族の家');
  relocate('school',-1,16,'学びの庭');
  relocate('library',5.5,16,'読書の庭',1.1);
  relocate('chapel',17,13.5,'祈りの庭');
  relocate('dojo',12,-15,'稽古の見学席');
  relocate('smith',29.5,-4,'鍛冶の見学席');
  relocate('clinic',-15,-15.3,'看護の庭');
  relocate('training-dummy',3,-11,'かかし',1.2);

  const activities=[
    ['market-observe','birth-market','observe','市場の人の動きを観察する',-18,13],
    ['inn-breathe','journey-inn-seat','breathe','宿の軒先で呼吸を整える',-25,14.5],
    ['square-balance','birth-bench-east','balance','広場の腰掛けで姿勢を整える',6,8.5],
    ['school-focus','journey-school-seat','focus','学びの庭で一点へ集中する',7,14.5],
    ['chapel-sense','journey-chapel-lamp','sense','祈りの庭で気配を読む',22,13],
    ['dojo-distance','birth-dojo','distance','庭の端から間合いを見る',12.5,-9],
    ['dojo-repeat','birth-dojo','repeat','道場の脇で足運びを反復する',12,-22],
    ['dojo-fall','birth-dojo','fall','柔らかな土で受身を試す',-1,-13],
    ['forest-track','birth-logging','track','林の入口で足跡を追う',-42,-19],
    ['workshop-maintain','journey-craft-table','maintain','木工の庭で道具を手入れする',-33,-28.5],
    ['farm-care','birth-farm','care','畑の手入れを手伝う',-22,-36],
    ['orchard-adapt','birth-orchard','adapt','果樹と風の様子を見る',34,40],
    ['gate-rest','journey-gate-seat','rest','見張りの休み場で息を整える',2,-34.5],
    ['ford-south-rest','journey-ford-south-seat','rest','南の渡しの手前で休む',52,-33.5],
    ['ford-east-rest','journey-ford-east-seat','rest','渡しの木陰で休む',109,-36.5],
    ['ford-north-rest','journey-ford-north-seat','rest','北の渡しの手前で休む',49,42.5],
    ['port-rest','journey-port-seat','rest','帰還の船着き場で休む',157,12.5],
  ];
  const objects=new Map(layout.objects.map(o=>[o.id,o]));
  for(const [id,entityId,activity,label,x,z] of activities){
    const object=objects.get(entityId);if(!object)continue;
    stations.push({id:`journey.${id}`,entityId,facilityKind:object.kind,label,x,z,radius:1.15,activity,actionLabel:label});
  }
  const dummies=[[3,-11],[-1,-8],[4,-7],[8,-8]].map(([x,z],index)=>({
    id:index?`dummy-extra-${index}`:'training-dummy',label:index?`かかし ${index+1}`:'かかし',x,z,trainingDummy:true,activity:'practice',
  }));
  const equipmentAnchor=muraEntry(objects.get('birth-smith'));
  contexts.set(stations,{layout,...villageJourneyRoads(),dummies,equipmentAnchor});
  return stations;
}
