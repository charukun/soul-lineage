import { NightView } from './web/view.js';

const poolsByView=new WeakMap();
function pools(view){let value=poolsByView.get(view);if(!value){value={spark:new Map(),slash:[]};poolsByView.set(view,value);}return value;}
function bucket(map,key){let rows=map.get(key);if(!rows){rows=[];map.set(key,rows);}return rows;}
function attachRecycler(view,fx,rows){
  fx.recycle=()=>{if(fx.__idle)return;fx.__idle=true;fx.age=0;fx.mesh.material.opacity=0;rows.push(fx);};
  fx.__idle=false;
}

const sourcedSpark=NightView.prototype.spark;
NightView.prototype.spark=function pooledSourcedSpark(x,y,z,color,count=16,inward=false){
  const pool=pools(this),key=`${Math.max(1,Math.floor(count))}:${inward?1:0}`,rows=bucket(pool.spark,key),fx=rows.pop();
  if(!fx){
    sourcedSpark.call(this,x,y,z,color,count,inward);
    const created=this.fx[this.fx.length-1];attachRecycler(this,created,rows);return;
  }
  fx.__idle=false;fx.age=0;fx.life=inward?.82:.7;fx.inward=inward;fx.mesh.material.opacity=1;fx.mesh.material.color?.set?.(color);fx.mesh.material.size=inward?.22:.13;
  const positions=fx.mesh.geometry.attributes.position;
  for(let i=0;i<fx.vel.length;i++){const angle=i*2.399;positions.setXYZ(i,x,y,z);const velocity=fx.vel[i];velocity[0]=Math.cos(angle)*(1+i%4);velocity[1]=.8+(i%5)*.65;velocity[2]=Math.sin(angle)*(1+i%3);}
  positions.needsUpdate=true;this.effects.add(fx.mesh);this.fx.push(fx);
};

const sourcedSlash=NightView.prototype.slash;
NightView.prototype.slash=function pooledSourcedSlash(x,z,yaw){
  const pool=pools(this),fx=pool.slash.pop();
  if(!fx){
    sourcedSlash.call(this,x,z,yaw);
    const created=this.fx[this.fx.length-1];attachRecycler(this,created,pool.slash);return;
  }
  fx.__idle=false;fx.age=0;fx.life=.18;fx.mesh.material.opacity=.82;fx.mesh.position.set(x,.08,z);fx.mesh.rotation.set(-Math.PI/2,0,-yaw+.3);this.effects.add(fx.mesh);this.fx.push(fx);
};

const clear=NightView.prototype.clear;
NightView.prototype.clear=function clearWithFxPool(...args){
  if(this.fx?.length){const retained=[];for(const fx of this.fx){if(typeof fx.recycle==='function'){this.effects.remove(fx.mesh);fx.recycle();}else retained.push(fx);}this.fx=retained;}
  return clear.apply(this,args);
};

NightView.prototype.fxPoolSnapshot=function fxPoolSnapshot(){
  const pool=pools(this);return Object.freeze({idleSparks:[...pool.spark.values()].reduce((sum,rows)=>sum+rows.length,0),idleSlashes:pool.slash.length,active:this.fx?.length||0});
};
