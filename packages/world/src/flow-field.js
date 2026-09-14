const DIRS=Object.freeze([[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]);
const key=(x,z)=>`${x},${z}`;
class Heap{constructor(){this.a=[];}clear(){this.a.length=0;}push(node){const a=this.a;a.push(node);let i=a.length-1;while(i){const p=(i-1)>>1;if(a[p].cost<=node.cost)break;a[i]=a[p];i=p;}a[i]=node;}pop(){const a=this.a,r=a[0],n=a.pop();if(a.length&&n){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1].cost<a[c].cost)c++;if(n.cost<=a[c].cost)break;a[i]=a[c];i=c;}a[i]=n;}return r;}get length(){return this.a.length;}}

export function createFlowFieldRouter({worldStep=2,maxFields=24,maxCells=18000,radiusCells=128}={}){
 const cache=new Map(),heap=new Heap(),nodePool=[];let builds=0,hits=0,fallbacks=0,reusedNodes=0;
 const cell=v=>Math.round(v/worldStep);
 function touch(cacheKey,field){cache.delete(cacheKey);cache.set(cacheKey,field);while(cache.size>maxFields)cache.delete(cache.keys().next().value);}
 function build(goalX,goalZ,revision,isBlocked,costAt){
  const cacheKey=`${revision}:${goalX}:${goalZ}`,cached=cache.get(cacheKey);if(cached){hits++;touch(cacheKey,cached);return cached;}
  builds++;heap.clear();let poolCursor=0;const node=(x,z,cost)=>{let value=nodePool[poolCursor];if(value){value.x=x;value.z=z;value.cost=cost;reusedNodes++;}else value=nodePool[poolCursor]={x,z,cost};poolCursor++;return value;};
  const costs=new Map(),next=new Map(),goalKey=key(goalX,goalZ);heap.push(node(goalX,goalZ,0));costs.set(goalKey,0);let visited=0;
  while(heap.length&&visited<maxCells){const current=heap.pop(),nodeKey=key(current.x,current.z);if(current.cost!==costs.get(nodeKey))continue;visited++;
   for(const[dx,dz]of DIRS){const x=current.x+dx,z=current.z+dz;if(Math.abs(x-goalX)>radiusCells||Math.abs(z-goalZ)>radiusCells||isBlocked(x,z))continue;if(dx&&dz&&(isBlocked(current.x+dx,current.z)||isBlocked(current.x,current.z+dz)))continue;const nk=key(x,z),traffic=Math.max(0,Number(costAt?.(x,z))||0),step=(dx&&dz?1.41421356237:1)*(1-.20*Math.min(1,traffic/16)),candidate=current.cost+Math.max(.2,step);if(candidate>=(costs.get(nk)??Infinity))continue;costs.set(nk,candidate);next.set(nk,nodeKey);heap.push(node(x,z,candidate));}
  }
  const field={cacheKey,revision,goalX,goalZ,goalKey,costs,next,visited};touch(cacheKey,field);return field;
 }
 function route({from,to,revision='0',isBlocked,costAt=null,maxPath=4096}={}){
  if(!from||!to||typeof isBlocked!=='function')throw new Error('Invalid flow route request');const sx=cell(from.x),sz=cell(from.z),gx=cell(to.x),gz=cell(to.z);if(isBlocked(gx,gz)||Math.abs(sx-gx)>radiusCells||Math.abs(sz-gz)>radiusCells){fallbacks++;return null;}
  const field=build(gx,gz,revision,isBlocked,costAt),startKey=key(sx,sz);if(startKey===field.goalKey)return[];if(!field.next.has(startKey)){fallbacks++;return null;}
  const path=[];let current=startKey,guard=0;while(current!==field.goalKey&&guard++<maxPath){const nextKey=field.next.get(current);if(!nextKey){fallbacks++;return null;}const[x,z]=nextKey.split(',').map(Number);path.push({x:x*worldStep,z:z*worldStep});current=nextKey;}if(current!==field.goalKey){fallbacks++;return null;}return path;
 }
 return{route,clear(){cache.clear();},snapshot(){return Object.freeze({fields:cache.size,builds,hits,fallbacks,maxCells,radiusCells,worldStep,nodePool:nodePool.length,reusedNodes});}};
}
