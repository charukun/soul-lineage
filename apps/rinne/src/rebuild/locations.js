import { defaultMuraLayout, muraEntry, defs, validateMuraLayout } from '@soul/world/mura';

const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const built=(layout,kinds)=>layout.objects.find(o=>o.phase==='built'&&kinds.includes(o.kind));
const fallbackSquare=layout=>built(layout,['campfire'])||built(layout,['mayor','home','tent','clanManor']);
const FALLBACK_OFFSETS=Object.freeze({home:[-4,-4],garden:[0,0],school:[-5,2],library:[-3,5],chapel:[0,6],dojo:[3,5],smith:[6,2],clinic:[5,-3]});
const LOCAL_OFFSETS=Object.freeze({school:[-1.2,0],library:[1.2,0]});
const INTERIOR_ACTIVITY=Object.freeze({
  bed:['breathe','寝床で呼吸を整える'],sofa:['rest','腰を落ち着ける'],table:['care','食卓を整える'],chair:['focus','姿勢を正して集中する'],
  shelf:['read','本棚を読む'],counter:['observe','人の動きを観察する'],workbench:['maintain','道具を手入れする'],hearth:['rest','火のそばで休む'],
  rug:['fall','敷物で受身を試す'],plant:['adapt','草木の様子を見る'],lamp:['sense','灯りの揺れから気配を読む'],bench:['balance','腰と体幹を整える'],
});
const PLAYABLE_BUILDINGS=Object.freeze([
  ['home',-20,-4,[['bed',-2,0],['table',1,0],['shelf',2,-3],['hearth',-2,-3],['rug',0,2]]],
  ['dojo',-18,14,[['bench',-3,1],['rug',0,0],['lamp',3,-2]]],
  ['school',0,20,[['shelf',-4,-3],['table',0,0],['chair',2,1],['lamp',4,-3]]],
  ['smith',20,12,[['workbench',-3,-2],['counter',2,-2],['bench',0,2],['lamp',4,2]]],
  ['clinic',22,-4,[['bed',-3,-1],['table',1,0],['plant',3,-2],['shelf',3,2]]],
  ['guardpost',0,-22,[['bench',-2,0],['table',1,0],['lamp',2,-2]]],
  ['watchtower',15,-24,[['bench',0,0],['lamp',1,-1]]],
  ['inn',-20,-20,[['bed',-4,-2],['bed',4,-2],['sofa',0,1],['hearth',-4,3],['rug',1,3]]],
]);

function furnitureRows(buildingId,rows){return rows.map(([kind,x,z],index)=>({id:`rinne-room-${buildingId}-${index}`,kind,x,z,rot:0,phase:'built',level:1,material:'base'}));}
function ensurePlayableVillage(layout){
  const existing=layout.objects.filter(o=>o.phase==='built'&&defs[o.kind]?.building),useFallback=existing.length<8;
  if(!useFallback)return layout;
  const clone=structuredClone(layout),kinds=new Set(clone.objects.filter(o=>o.phase==='built').map(o=>o.kind)),ids=new Set(clone.objects.map(o=>o.id));
  for(const [kind,x,z,room] of PLAYABLE_BUILDINGS){
    if(kinds.has(kind))continue;
    let id=`rinne-playable-${kind}`,suffix=1;while(ids.has(id))id=`rinne-playable-${kind}-${suffix++}`;
    ids.add(id);kinds.add(kind);clone.objects.push({id,kind,x,z,rot:0,phase:'built',level:1,material:'base',room:furnitureRows(id,room)});
  }
  return clone;
}

function place(layout,id,kinds,label,activity=null,radius=2.4){
  const object=built(layout,kinds),fallback=fallbackSquare(layout),anchor=object||fallback;
  let position=anchor?muraEntry(anchor):{x:0,z:0};
  const [dx,dz]=object?(LOCAL_OFFSETS[id]||[0,0]):(FALLBACK_OFFSETS[id]||[0,0]);position={x:position.x+dx,z:position.z+dz};
  return {id,entityId:object?.id||fallback?.id||null,label:object?defs[object.kind]?.label||label:label,x:position.x,z:position.z,activity,actionLabel:label,radius,fallback:!object};
}

export function normalizeLayout(raw){return ensurePlayableVillage(raw?validateMuraLayout(raw):defaultMuraLayout());}

function entryStation(object){
  const entry=muraEntry(object),dx=entry.x-object.x,dz=entry.z-object.z,len=Math.max(.001,Math.hypot(dx,dz)),def=defs[object.kind],insideZ=Math.max(2.2,(def?.d||10)/2-2.0);
  return {id:`door.${object.id}`,label:def?.label||'建物',x:entry.x,z:entry.z,radius:1.15,enterInterior:true,buildingId:object.id,interiorSpawn:{x:0,z:insideZ},outsideSpawn:{x:entry.x+dx/len*2.0,z:entry.z+dz/len*2.0}};
}

export function buildInteriors(layout){
  layout=normalizeLayout(layout);const rows=[];
  for(const object of layout.objects){
    const def=defs[object.kind];if(object.phase!=='built'||!def?.building||def.open)continue;
    const room=Array.isArray(object.room)?object.room:[],stations=[];
    for(const item of room){
      const mapping=INTERIOR_ACTIVITY[item.kind];if(!mapping)continue;const [activity,label]=mapping;
      stations.push({id:`room.${object.id}.${item.id}`,label,x:item.x,z:item.z,radius:.92,activity,actionLabel:label,interiorId:object.id,sourceId:item.id,sourceKind:item.kind,housingTrait:true});
    }
    const halfDepth=Math.max(3,(def.d||10)/2-.8);
    stations.push({id:`exit.${object.id}`,label:'外へ出る',x:0,z:halfDepth,radius:1.05,exitInterior:true,interiorId:object.id});
    rows.push({id:object.id,kind:object.kind,label:def.label||object.kind,w:def.w||10,d:def.d||10,object,room,stations});
  }
  return rows;
}

export function buildStations(layout){
  layout=normalizeLayout(layout);
  const home=place(layout,'home',['home','tent','clanManor','mayor'],'暮らしを手伝う','care');
  const garden=place(layout,'garden',['campfire'],'広場で遊ぶ','play',3.0);
  const school=place(layout,'school',['school'],'文字を学ぶ','study');
  const library=place(layout,'library',['school'],'本を読む','read',1.0);
  const chapel=place(layout,'chapel',['chapel'],'祈る','pray',2.0);
  const dojo=place(layout,'dojo',['dojo'],'稽古を見る','train',2.1);
  const smith=place(layout,'smith',['smith','weapons'],'鍛冶を見る','forge',2.0);
  const clinic=place(layout,'clinic',['clinic'],'看護を手伝う','care',2.0);
  const port=built(layout,['harbor']);
  const portEntry=port?muraEntry(port):{x:166,z:0};
  const stations=[home,garden,school,library,chapel,dojo,smith,clinic,
    {id:'port-prayer',label:'船上で祈る',x:portEntry.x,z:portEntry.z,activity:'voyage',actionLabel:'船上で祈る',radius:2.2,port:true,fallback:!port},
  ];

  const dojoObject=built(layout,['dojo']);
  if(dojoObject){
    const entry=muraEntry(dojoObject),dx=entry.x-dojoObject.x,dz=entry.z-dojoObject.z,len=Math.max(.001,Math.hypot(dx,dz));
    stations.push({id:'training-dummy',label:'かかし',x:entry.x+dx/len*3.0,z:entry.z+dz/len*3.0,radius:1.2,activity:'practice',actionLabel:'かかしで型を反復する',bonusActivities:['repeat','distance','train'],trainingDummy:true});
  }

  const a=smith, weaponRows=[
    ['sword','片手剣'],['dagger','短剣'],['great','大剣'],['spear','槍'],['axe','戦斧'],['staff','杖'],['fist','素手'],
  ];
  for(let i=0;i<weaponRows.length;i++){
    const [weapon,label]=weaponRows[i],col=i%4,row=Math.floor(i/4);
    stations.push({id:`rack.weapon.${weapon}`,label,x:a.x-3.3+col*2.15,z:a.z+3.0+row*2.05,radius:1.05,equipment:{weapon}});
  }
  const armorRows=[['cloth','服'],['light','軽鎧'],['heavy','重鎧']];
  for(let i=0;i<armorRows.length;i++){
    const [armor,label]=armorRows[i];
    stations.push({id:`rack.armor.${armor}`,label,x:a.x-2.1+i*2.1,z:a.z+6.0,radius:1.05,equipment:{armor}});
  }
  stations.push({id:'rack.shield.off',label:'盾を外す',x:a.x-2.0,z:a.z+8.0,radius:1.05,equipment:{shield:false}});
  stations.push({id:'rack.shield.on',label:'盾を持つ',x:a.x+2.0,z:a.z+8.0,radius:1.05,equipment:{shield:true}});

  for(const interior of buildInteriors(layout)){
    stations.push(entryStation(interior.object));
    stations.push(...interior.stations);
  }
  return stations;
}

function contextMatch(station,interiorId){return interiorId?station.interiorId===interiorId:!station.interiorId;}
export function nearestStation(stations,position,{interiorId=null}={}){
  let found=null,best=Infinity;
  for(const station of stations){if(!contextMatch(station,interiorId))continue;const d=dist(station,position);if(d<=station.radius&&d<best){best=d;found=station;}}
  return found;
}

export function nearestNamedPlace(stations,position){
  let found=null,best=Infinity;
  for(const station of stations){if(station.id.startsWith('rack.')||station.interiorId)continue;const d=dist(station,position);if(d<best){best=d;found=station;}}
  return found?{...found,distance:best}:null;
}

export function equipmentStations(stations){return stations.filter(s=>s.equipment);}
