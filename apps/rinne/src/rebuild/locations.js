import { defaultMuraLayout, muraEntry, defs, validateMuraLayout } from '@soul/world/mura';

const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const built=(layout,kinds)=>layout.objects.find(o=>o.phase==='built'&&kinds.includes(o.kind));
const fallbackSquare=layout=>built(layout,['campfire'])||built(layout,['mayor','home','tent','clanManor']);
const FALLBACK_OFFSETS=Object.freeze({home:[-4,-4],garden:[0,0],school:[-5,2],library:[-3,5],chapel:[0,6],dojo:[3,5],smith:[6,2],clinic:[5,-3]});
const LOCAL_OFFSETS=Object.freeze({school:[-1.2,0],library:[1.2,0]});

function place(layout,id,kinds,label,activity=null,radius=2.4,topicId=null){
  const object=built(layout,kinds),fallback=fallbackSquare(layout),anchor=object||fallback;
  let position=anchor?muraEntry(anchor):{x:0,z:0};
  const [dx,dz]=object?(LOCAL_OFFSETS[id]||[0,0]):(FALLBACK_OFFSETS[id]||[0,0]);position={x:position.x+dx,z:position.z+dz};
  return {id,entityId:object?.id||fallback?.id||null,facilityKind:object?.kind||kinds[0]||null,topicId,label:object?defs[object.kind]?.label||label:label,x:position.x,z:position.z,activity,actionLabel:label,radius,fallback:!object};
}

export function normalizeLayout(raw){return raw?validateMuraLayout(raw):defaultMuraLayout();}

export function buildStations(layout){
  layout=normalizeLayout(layout);
  const home=place(layout,'home',['home','tent','clanManor','mayor'],'暮らしを手伝う','care',2.4,'home-life');
  const garden=place(layout,'garden',['campfire'],'広場で遊ぶ','play',3.0,'village-square');
  const school=place(layout,'school',['school'],'文字を学ぶ','study',2.4,'school-learning');
  const library=place(layout,'library',['school'],'本を読む','read',1.0,'books');
  const chapel=place(layout,'chapel',['chapel'],'祈る','pray',2.0,'prayer');
  const dojo=place(layout,'dojo',['dojo'],'稽古を見る','train',2.1,'training');
  const smith=place(layout,'smith',['smith','weapons'],'鍛冶を見る','forge',2.0,'smithing');
  const clinic=place(layout,'clinic',['clinic'],'看護を手伝う','care',2.0,'healing');
  const port=built(layout,['harbor']);
  const portEntry=port?muraEntry(port):{x:166,z:0};
  const stations=[home,garden,school,library,chapel,dojo,smith,clinic,
    {id:'port-prayer',label:'船上で祈る',x:portEntry.x,z:portEntry.z,activity:'voyage',actionLabel:'船上で祈る',radius:2.2,port:true,fallback:!port},
  ];

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
  return stations;
}

export function nearestStation(stations,position){
  let found=null,best=Infinity;
  for(const station of stations){const d=dist(station,position);if(d<=station.radius&&d<best){best=d;found=station;}}
  return found;
}

export function nearestNamedPlace(stations,position){
  let found=null,best=Infinity;
  for(const station of stations){if(station.id.startsWith('rack.'))continue;const d=dist(station,position);if(d<best){best=d;found=station;}}
  return found?{...found,distance:best}:null;
}

export function equipmentStations(stations){return stations.filter(s=>s.equipment);}
