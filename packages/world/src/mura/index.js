import {defs} from './catalog.js';
import {LIMIT,inWater} from './terrain.js';
export {defs} from './catalog.js';
export * from './terrain.js';
export const MURA_WORLD_SCHEMA=1;
export const MURA_TERRAIN_ID='terrain.mura.v1';
const NON_INTERIOR_SHAPES=new Set(['fire','yard','field','market','pond','orchard']);
const DEFAULT_WALL_THICKNESS=.35;
export const initialMuraObjects=()=>[
  {id:'b1',kind:'mayor',x:-7,z:-5,rot:0,phase:'built',level:1,material:'base',room:[]},
  {id:'b2',kind:'campfire',x:5,z:8,rot:0,phase:'built',level:1,room:[]},
  {id:'b3',kind:'guardhome',x:12,z:-7,rot:0,phase:'built',level:1,room:[]},
];
export function defaultMuraLayout(){return projectMuraLayout({villageId:'local-hoshitsugi',name:'MURAAAAAAA',revision:0,objects:initialMuraObjects()});}
/** World geometry only: village economy, Rinne lives and demon admission stay owned by their games. */
export function projectMuraLayout(state){return validateMuraLayout({schemaVersion:MURA_WORLD_SCHEMA,id:state.villageId,name:state.name,terrainId:MURA_TERRAIN_ID,revision:state.revision,units:'metres',coordinateSystem:'right-handed-y-up',objects:state.objects});}
export function validateMuraLayout(raw){
  const s=structuredClone(raw),finite=(n,lo=-LIMIT,hi=LIMIT)=>typeof n==='number'&&Number.isFinite(n)&&n>=lo&&n<=hi;
  if(s?.schemaVersion!==1||typeof s.id!=='string'||!s.id||s.id.length>100||s.terrainId!==MURA_TERRAIN_ID||!Number.isSafeInteger(s.revision)||s.revision<0||s.units!=='metres'||s.coordinateSystem!=='right-handed-y-up'||typeof s.name!=='string'||s.name.length>100||!Array.isArray(s.objects)||s.objects.length>2000)throw Error('MURAAAAAAAの共通マップ形式が不正です。');
  const ids=new Set();let count=0;
  const objects=(items,inside=false)=>items.map(o=>{
    if(++count>10000||!o||typeof o.id!=='string'||!o.id||o.id.length>100||ids.has(o.id)||!Object.hasOwn(defs,o.kind)||!finite(o.x)||!finite(o.z)||!finite(o.rot,-100,100)||o.level!=null&&(!Number.isInteger(o.level)||o.level<1||o.level>3)||o.phase!=null&&!['built','planned','building'].includes(o.phase)||o.material!=null&&!['base','timber','stone','earth'].includes(o.material))throw Error('建物・家具の配置が不正、または新しいカタログが必要です。');
    ids.add(o.id);if(inside&&defs[o.kind].building)throw Error('室内へ建物は配置できません。');
    if(o.room!=null&&(!Array.isArray(o.room)||inside||o.room.length>1000))throw Error('室内の配置が不正です。');
    return{id:o.id,kind:o.kind,assetId:`mura.${o.kind}`,x:o.x,z:o.z,rot:o.rot,level:o.level||1,phase:o.phase||'built',material:o.material||'base',...(o.room?{room:objects(o.room,true)}:{})};
  });
  s.objects=objects(s.objects);return s;
}
export function muraLocalToWorld(h,x,z){return{x:h.x+x*Math.cos(h.rot)+z*Math.sin(h.rot),z:h.z-x*Math.sin(h.rot)+z*Math.cos(h.rot)};}
export function muraWorldToLocal(h,x,z){return{x:(x-h.x)*Math.cos(h.rot)-(z-h.z)*Math.sin(h.rot),z:(x-h.x)*Math.sin(h.rot)+(z-h.z)*Math.cos(h.rot)};}
export function muraHasInterior(value){const d=defs[typeof value==='string'?value:value?.kind];return !!d?.building&&!d.open&&!NON_INTERIOR_SHAPES.has(d.shape);}
export function muraDoorWidth(value){const d=defs[typeof value==='string'?value:value?.kind];if(!d)return 0;return Math.min(4.2,Math.max(3.2,d.w*.3));}
export function muraEntry(o,distance=2){const d=defs[o.kind];return muraLocalToWorld(o,0,d.d/2+distance);}
export function muraInteriorEntry(o,inset=1.6){const d=defs[o.kind];return muraHasInterior(o)?muraLocalToWorld(o,0,d.d/2-inset):muraEntry(o);}
export function muraInteriorAt(layout,x,z,margin=0){
  const inset=Math.max(0,Number(margin)||0);
  for(const o of layout.objects){
    if(o.phase!=='built'||!muraHasInterior(o))continue;
    const d=defs[o.kind],p=muraWorldToLocal(o,x,z);
    if(Math.abs(p.x)<d.w/2-inset&&Math.abs(p.z)<d.d/2-inset)return o;
  }
  return null;
}
export function muraBuildingBlocked(o,x,z,radius=.35){
  const d=defs[o.kind];
  if(o.phase!=='built'||!d?.building||d.open)return false;
  const p=muraWorldToLocal(o,x,z),r=Math.max(0,Number(radius)||0),hx=d.w/2,hz=d.d/2,ax=Math.abs(p.x),az=Math.abs(p.z);
  if(ax>=hx+r||az>=hz+r)return false;
  if(!muraHasInterior(o))return true;
  const wall=Math.min(Math.min(hx,hz)*.35,Math.max(.18,Number(d.wallThickness)||DEFAULT_WALL_THICKNESS));
  const sideWall=ax>hx-wall-r;
  const backWall=p.z<(-hz+wall+r);
  const frontWall=p.z>(hz-wall-r)&&ax+r>muraDoorWidth(o)/2;
  return sideWall||backWall||frontWall;
}
export function muraBlocked(layout,x,z,radius=.35){
  if(Math.abs(x)>LIMIT-radius||Math.abs(z)>LIMIT-radius||inWater(x,z,radius))return true;
  return layout.objects.some(o=>muraBuildingBlocked(o,x,z,radius));
}
export function safeMuraPosition(layout,position){
  if(!muraBlocked(layout,position.x,position.z))return {...position};
  // A moved/new building may cover an old player position. Search nearby dry ground.
  for(let r=2;r<=30;r+=2)for(let i=0;i<16;i++){const a=i*Math.PI/8,p={x:position.x+Math.cos(a)*r,z:position.z+Math.sin(a)*r};if(!muraBlocked(layout,p.x,p.z))return p;}
  for(const o of layout.objects){const p=muraEntry(o);if(!muraBlocked(layout,p.x,p.z))return p;}return {x:0,z:0};
}
