import {defs} from './catalog.js';
import {LIMIT,inWater} from './terrain.js';
export {defs} from './catalog.js';
export * from './terrain.js';
export const MURA_WORLD_SCHEMA=1;
export const MURA_TERRAIN_ID='terrain.mura.v1';
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
export function muraEntry(o){const d=defs[o.kind],r=d.d/2+2;return{x:o.x+r*Math.sin(o.rot),z:o.z+r*Math.cos(o.rot)};}
export function muraBlocked(layout,x,z,radius=.35){
  if(Math.abs(x)>LIMIT-radius||Math.abs(z)>LIMIT-radius||inWater(x,z,radius))return true;
  return layout.objects.some(o=>{if(o.phase!=='built'||!defs[o.kind].building||defs[o.kind].open)return false;const dx=x-o.x,dz=z-o.z,c=Math.cos(o.rot),s=Math.sin(o.rot),d=defs[o.kind];return Math.abs(dx*c-dz*s)<d.w/2+radius&&Math.abs(dx*s+dz*c)<d.d/2+radius;});
}
export function safeMuraPosition(layout,position){
  if(!muraBlocked(layout,position.x,position.z))return {...position};
  // A moved/new building may cover an old player position. Search nearby dry ground.
  for(let r=2;r<=30;r+=2)for(let i=0;i<16;i++){const a=i*Math.PI/8,p={x:position.x+Math.cos(a)*r,z:position.z+Math.sin(a)*r};if(!muraBlocked(layout,p.x,p.z))return p;}
  for(const o of layout.objects){const p=muraEntry(o);if(!muraBlocked(layout,p.x,p.z))return p;}return {x:0,z:0};
}
