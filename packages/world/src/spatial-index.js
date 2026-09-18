const key=(x,z)=>`${x}:${z}`;
const finite=value=>typeof value==='number'&&Number.isFinite(value);

export function createSpatialIndex({cellSize=8}={}){
 if(!finite(cellSize)||cellSize<=0)throw new Error('cellSize must be positive');
 const buckets=new Map(),records=new Map();let generation=0,queries=0,maxRadius=0;
 const coord=v=>Math.floor(v/cellSize),bucketKey=(x,z)=>key(coord(x),coord(z));
 const bucket=id=>{let b=buckets.get(id);if(!b){b=new Set();buckets.set(id,b);}return b;};
 const detach=record=>{const b=buckets.get(record.bucket);if(!b)return;b.delete(record.id);if(!b.size)buckets.delete(record.bucket);};
 function upsert(id,x,z,{radius=0,tag='',data=null}={}){
  id=String(id);if(!id||!finite(x)||!finite(z)||!finite(radius)||radius<0)throw new Error('Invalid spatial record');
  const nextBucket=bucketKey(x,z),existing=records.get(id);
  if(existing){if(existing.bucket!==nextBucket){detach(existing);bucket(nextBucket).add(id);}existing.x=x;existing.z=z;existing.radius=radius;existing.tag=tag;existing.data=data;existing.bucket=nextBucket;existing.generation=generation;maxRadius=Math.max(maxRadius,radius);return existing;}
  const record={id,x,z,radius,tag,data,bucket:nextBucket,generation};records.set(id,record);bucket(nextBucket).add(id);maxRadius=Math.max(maxRadius,radius);return record;
 }
 function remove(id){const record=records.get(String(id));if(!record)return false;detach(record);records.delete(record.id);return true;}
 function beginFrame(){generation++;return generation;}
 function endFrame(){for(const record of records.values())if(record.generation!==generation)remove(record.id);}
 function queryRadiusInto(out,x,z,radius,{tag=null,filter=null,limit=Infinity}={}){
  if(!Array.isArray(out)||!finite(x)||!finite(z)||!finite(radius)||radius<0)throw new Error('Invalid spatial query');out.length=0;queries++;
  const extent=radius+maxRadius,minX=coord(x-extent),maxX=coord(x+extent),minZ=coord(z-extent),maxZ=coord(z+extent),r2=radius*radius;
  for(let gx=minX;gx<=maxX;gx++)for(let gz=minZ;gz<=maxZ;gz++){
   const b=buckets.get(key(gx,gz));if(!b)continue;
   for(const id of b){const record=records.get(id);if(!record||(tag!==null&&record.tag!==tag))continue;const dx=record.x-x,dz=record.z-z,rr=radius+record.radius;if(dx*dx+dz*dz>rr*rr)continue;if(filter&&!filter(record))continue;out.push(record);if(out.length>=limit)return out;}
  }
  return out;
 }
 function nearest(x,z,{radius=Infinity,tag=null,filter=null}={}){
  if(!finite(x)||!finite(z))throw new Error('Invalid nearest query');const finiteRadius=Number.isFinite(radius)?Math.max(0,radius):Math.max(cellSize,Math.sqrt(records.size+1)*cellSize);let best=null,bestD2=finiteRadius*finiteRadius;queries++;
  const minX=coord(x-finiteRadius),maxX=coord(x+finiteRadius),minZ=coord(z-finiteRadius),maxZ=coord(z+finiteRadius);
  for(let gx=minX;gx<=maxX;gx++)for(let gz=minZ;gz<=maxZ;gz++){
   const b=buckets.get(key(gx,gz));if(!b)continue;for(const id of b){const record=records.get(id);if(!record||(tag!==null&&record.tag!==tag)||(filter&&!filter(record)))continue;const dx=record.x-x,dz=record.z-z,d2=dx*dx+dz*dz;if(d2<bestD2){bestD2=d2;best=record;}}
  }
  return best;
 }
 function clear(){buckets.clear();records.clear();maxRadius=0;generation++;}
 return{beginFrame,endFrame,upsert,remove,queryRadiusInto,nearest,clear,get(id){return records.get(String(id))||null;},snapshot(){return Object.freeze({cellSize,records:records.size,buckets:buckets.size,queries,generation});}};
}
