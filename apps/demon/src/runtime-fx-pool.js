import { NightView } from './web/view.js';

const poolsByView=new WeakMap();
function pools(view){let value=poolsByView.get(view);if(!value){value={spark:new Map(),slashBase:[],slashSourced:[]};poolsByView.set(view,value);}return value;}
function bucket(map,key){let rows=map.get(key);if(!rows){rows=[];map.set(key,rows);}return rows;}
function attachRecycler(fx,rows){
  fx.recycle=()=>{if(fx.__idle)return;fx.__idle=true;fx.age=0;fx.mesh.material.opacity=0;rows.push(fx);};
  fx.__idle=false;
}
function revive(view,fx,{x,y,z,life,opacity,rotation}){
  fx.__idle=false;fx.age=0;fx.life=life;fx.mesh.material.opacity=opacity;fx.mesh.position.set(x,y,z);fx.mesh.rotation.set(...rotation);view.effects.add(fx.mesh);view.fx.push(fx);return fx;
}

const sourcedSpark=NightView.prototype.spark;
NightView.prototype.spark=function pooledSourcedSpark(x,y,z,color,count=16,inward=false){
  const pool=pools(this),key=`${Math.max(1,Math.floor(count))}:${inward?1:0}`,rows=bucket(pool.spark,key),fx=rows.pop();
  if(!fx){
    sourcedSpark.call(this,x,y,z,color,count,inward);
    const created=this.fx[this.fx.length-1];attachRecycler(created,rows);return;
  }
  fx.__idle=false;fx.age=0;fx.life=inward?.82:.7;fx.inward=inward;fx.mesh.material.opacity=1;fx.mesh.material.color?.set?.(color);fx.mesh.material.size=inward?.22:.13;
  const positions=fx.mesh.geometry.attributes.position;
  for(let i=0;i<fx.vel.length;i++){const angle=i*2.399;positions.setXYZ(i,x,y,z);const velocity=fx.vel[i];velocity[0]=Math.cos(angle)*(1+i%4);velocity[1]=.8+(i%5)*.65;velocity[2]=Math.sin(angle)*(1+i%3);}
  positions.needsUpdate=true;this.effects.add(fx.mesh);this.fx.push(fx);
};

// The sourced slash intentionally layers the original torus and the authored
// slash texture. Pool both meshes as a pair so repeated hits keep the same look.
const sourcedSlash=NightView.prototype.slash;
NightView.prototype.slash=function pooledSourcedSlash(x,z,yaw){
  const pool=pools(this),base=pool.slashBase.pop(),sourced=pool.slashSourced.pop();
  if(base&&sourced){
    revive(this,base,{x,y:1.2,z,life:.20,opacity:1,rotation:[.65,yaw,.4]});
    revive(this,sourced,{x,y:.08,z,life:.18,opacity:.82,rotation:[-Math.PI/2,0,-yaw+.3]});
    return;
  }
  if(base)pool.slashBase.push(base);if(sourced)pool.slashSourced.push(sourced);
  const before=this.fx.length;sourcedSlash.call(this,x,z,yaw);const added=this.fx.slice(before);
  if(added.length>=2){attachRecycler(added[0],pool.slashBase);attachRecycler(added[added.length-1],pool.slashSourced);}
};

const clear=NightView.prototype.clear;
NightView.prototype.clear=function clearWithFxPool(...args){
  if(this.fx?.length){const retained=[];for(const fx of this.fx){if(typeof fx.recycle==='function'){this.effects.remove(fx.mesh);fx.recycle();}else retained.push(fx);}this.fx=retained;}
  return clear.apply(this,args);
};

NightView.prototype.fxPoolSnapshot=function fxPoolSnapshot(){
  const pool=pools(this);return Object.freeze({idleSparks:[...pool.spark.values()].reduce((sum,rows)=>sum+rows.length,0),idleSlashes:Math.min(pool.slashBase.length,pool.slashSourced.length),idleSlashMeshes:pool.slashBase.length+pool.slashSourced.length,active:this.fx?.length||0});
};
