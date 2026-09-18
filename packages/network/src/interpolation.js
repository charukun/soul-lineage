const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const angleLerp=(a,b,t)=>{let d=((b-a+Math.PI*3)%(Math.PI*2))-Math.PI;return a+d*t;};
export function createSnapshotInterpolator({delayMs=100,maxExtrapolationMs=160,capacity=6,now=()=>performance.now()}={}){
 const rows=new Map();let pushes=0,samples=0,snaps=0;
 function bufferFor(id){let row=rows.get(id);if(!row){row={items:Array.from({length:capacity},()=>({time:0,x:0,z:0,yaw:0,state:null})),start:0,size:0};rows.set(id,row);}return row;}
 function push(id,state,time=now()){const row=bufferFor(String(id)),index=(row.start+row.size)%capacity,slot=row.items[index];slot.time=Number(time)||0;slot.x=Number(state?.x)||0;slot.z=Number(state?.z)||0;slot.yaw=Number(state?.yaw)||0;slot.state=state?.state??null;if(row.size<capacity)row.size++;else row.start=(row.start+1)%capacity;pushes++;}
 function itemAt(row,i){return row.items[(row.start+i)%capacity];}
 function sample(id,time=now()-delayMs){const row=rows.get(String(id));if(!row?.size)return null;samples++;if(row.size===1){const a=itemAt(row,0);return{x:a.x,z:a.z,yaw:a.yaw,state:a.state,mode:'hold'};}
  let older=itemAt(row,0),newer=itemAt(row,row.size-1);for(let i=1;i<row.size;i++){const next=itemAt(row,i);if(next.time>=time){newer=next;older=itemAt(row,i-1);break;}older=next;}
  if(time<=newer.time&&newer.time>older.time){const t=clamp((time-older.time)/(newer.time-older.time),0,1);return{x:lerp(older.x,newer.x,t),z:lerp(older.z,newer.z,t),yaw:angleLerp(older.yaw,newer.yaw,t),state:t<.5?older.state:newer.state,mode:'interpolate'};}
  const prev=itemAt(row,Math.max(0,row.size-2)),dt=Math.max(1,newer.time-prev.time),extra=clamp(time-newer.time,0,maxExtrapolationMs),vx=(newer.x-prev.x)/dt,vz=(newer.z-prev.z)/dt;return{x:newer.x+vx*extra,z:newer.z+vz*extra,yaw:newer.yaw,state:newer.state,mode:extra>0?'extrapolate':'hold'};
 }
 function remove(id){return rows.delete(String(id));}
 return{push,sample,remove,clear(){rows.clear();},snapshot(){return Object.freeze({tracked:rows.size,pushes,samples,snaps,delayMs,maxExtrapolationMs});}};
}

export function createPredictionReconciler({snapDistance=6,halfLifeMs=90}={}){let correctionX=0,correctionZ=0,snaps=0,reconciles=0;return{reconcile(predicted,authoritative){const dx=(Number(authoritative?.x)||0)-(Number(predicted?.x)||0),dz=(Number(authoritative?.z)||0)-(Number(predicted?.z)||0),distance=Math.hypot(dx,dz);reconciles++;if(distance>=snapDistance){correctionX=correctionZ=0;snaps++;return{snap:true,x:authoritative.x,z:authoritative.z,error:distance};}correctionX+=dx;correctionZ+=dz;return{snap:false,x:predicted.x,z:predicted.z,error:distance};},apply(position,deltaMs){const decay=Math.pow(.5,Math.max(0,deltaMs)/Math.max(1,halfLifeMs)),applyX=correctionX*(1-decay),applyZ=correctionZ*(1-decay);correctionX*=decay;correctionZ*=decay;return{x:(Number(position?.x)||0)+applyX,z:(Number(position?.z)||0)+applyZ};},snapshot(){return Object.freeze({correctionX,correctionZ,reconciles,snaps,snapDistance,halfLifeMs});}};}
