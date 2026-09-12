const WEAPONS=['greatsword','sword','katana','axe','greataxe','dagger','crossbow','staff','wand'];
const number=(v,d,min,max)=>{if(v===null||v===undefined||v==='')return d;const n=Number(v);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):d;};
const bool=(v,d)=>v==='1'?true:v==='0'?false:d;
export function readReviewState(input){
 const p=input instanceof URLSearchParams?input:new URLSearchParams(input);
 return{version:2,preset:p.get('preset')||'model.SHINO',clip:p.get('clip')||'通常 / 自然体',mode:p.get('mode')==='combat'?'combat':'normal',
  weaponId:WEAPONS.includes(p.get('weaponId'))?p.get('weaponId'):'katana',weaponEnabled:bool(p.get('weapon'),false),weaponScale:number(p.get('weaponScale'),.5,.1,1),
  weaponX:number(p.get('weaponX'),0,-360,360),weaponY:number(p.get('weaponY'),0,-360,360),weaponZ:number(p.get('weaponZ'),0,-360,360),
  camera:['front','back','left','right','top','three'].includes(p.get('camera'))?p.get('camera'):'three',inPlace:bool(p.get('inPlace'),true),vfx:bool(p.get('vfx'),false),marker:number(p.get('marker'),.42,0,120),
  time:number(p.get('t'),0,0,120),speed:number(p.get('speed'),1,.1,2),loop:bool(p.get('loop'),true),playing:bool(p.get('playing'),!p.has('t')),shared:p.has('state')||p.has('t')||p.has('clip')};
}
export function reviewStateURL(base,state){
 const u=new URL(base);u.search='';
 const fields={state:2,preset:state.preset,clip:state.clip,mode:state.mode,weaponId:state.weaponId,weapon:state.weaponEnabled?'1':'0',weaponScale:state.weaponScale,weaponX:state.weaponX,weaponY:state.weaponY,weaponZ:state.weaponZ,camera:state.camera,inPlace:state.inPlace?'1':'0',vfx:state.vfx?'1':'0',marker:state.marker,t:state.time,speed:state.speed,loop:state.loop?'1':'0',playing:state.playing?'1':'0'};
 for(const[k,v]of Object.entries(fields))u.searchParams.set(k,String(v));return u;
}
export function applyMotionPolicy(state,meta){
 const next={...state};if(!meta)return next;
 if(meta.posture)next.mode=meta.posture;if(typeof meta.loop==='boolean')next.loop=meta.loop;
 if(meta.weapon==='none')next.weaponEnabled=false;
 if(meta.kind==='slash'&&!next.weaponEnabled){next.weaponId='katana';next.weaponEnabled=true;}
 return next;
}
