const DIRS=Object.freeze([[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]);
const key=(x,z)=>`${x},${z}`;
class Heap{constructor(){this.a=[];}push(node){const a=this.a;a.push(node);let i=a.length-1;while(i){const p=(i-1)>>1;if(a[p].cost<=node.cost)break;a[i]=a[p];i=p;}a[i]=node;}pop(){const a=this.a,r=a[0],n=a.pop();if(a.length&&n){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1].cost<a[c].cost)c++;if(n.cost<=a[c].cost)break;a[i]=a[c];i=c;}a[i]=n;}return r;}get length(){return this.a.length;}}

/** Reverse Dijkstra fields expand only as far as the requesting resident.
 * Each cached goal owns its frontier; a later resident resumes that search.
 * maxCells is still the total safety limit for one field, not a per-call reset.
 */
export function createFlowFieldRouter({worldStep=2,maxFields=24,maxCells=18000,radiusCells=128}={}){
 const cache=new Map(),nodePool=[];let builds=0,hits=0,fallbacks=0,reusedNodes=0,allocatedNodes=0,expandedCells=0;
 const cell=v=>Math.round(v/worldStep);
 function node(x,z,cost){let value=nodePool.pop();if(value)reusedNodes++;else{value={};allocatedNodes++;}Object.assign(value,{x,z,cost});return value;}
 function release(field){while(field.heap.length)nodePool.push(field.heap.pop());}
 function fieldFor(goalX,goalZ,revision){
  const cacheKey=`${revision}:${goalX}:${goalZ}`;let field=cache.get(cacheKey);
  if(field){hits++;cache.delete(cacheKey);}else{
   builds++;const goalKey=key(goalX,goalZ);
   field={goalX,goalZ,goalKey,costs:new Map([[goalKey,0]]),next:new Map(),settled:new Set(),heap:new Heap(),visited:0};
   field.heap.push(node(goalX,goalZ,0));
  }
  cache.set(cacheKey,field);
  while(cache.size>maxFields){const oldest=cache.keys().next().value;release(cache.get(oldest));cache.delete(oldest);}
  return field;
 }
 function expand(field,startKey,isBlocked,costAt,isSegmentBlocked){
  if(field.settled.has(startKey))return;
  const {heap,costs,next,settled,goalX,goalZ}=field;
  while(heap.length&&field.visited<maxCells){
   const current=heap.pop(),{x:cx,z:cz,cost}=current,nodeKey=key(cx,cz);nodePool.push(current);
   if(cost!==costs.get(nodeKey)||settled.has(nodeKey))continue;
   settled.add(nodeKey);field.visited++;expandedCells++;
   for(const[dx,dz]of DIRS){
    const x=cx+dx,z=cz+dz,nk=key(x,z);
    if(Math.abs(x-goalX)>radiusCells||Math.abs(z-goalZ)>radiusCells||settled.has(nk)||isBlocked(x,z))continue;
    if(dx&&dz&&(isBlocked(cx+dx,cz)||isBlocked(cx,cz+dz)))continue;
    if(isSegmentBlocked?.(x,z,cx,cz))continue;
    const traffic=Math.max(0,Number(costAt?.(x,z))||0),step=(dx&&dz?1.41421356237:1)*(1-.20*Math.min(1,traffic/16)),candidate=cost+Math.max(.2,step);
    if(candidate>=(costs.get(nk)??Infinity))continue;
    costs.set(nk,candidate);next.set(nk,nodeKey);heap.push(node(x,z,candidate));
   }
   // Expand this cell before yielding so its neighbors remain reachable when
   // another resident resumes the same frontier from a more distant position.
   if(nodeKey===startKey)break;
  }
 }
 function route({from,to,revision='0',isBlocked,costAt=null,isSegmentBlocked=null,maxPath=4096}={}){
  if(!from||!to||typeof isBlocked!=='function')throw new Error('Invalid flow route request');
  const sx=cell(from.x),sz=cell(from.z),gx=cell(to.x),gz=cell(to.z),startKey=key(sx,sz);
  if(isBlocked(gx,gz)||Math.abs(sx-gx)>radiusCells||Math.abs(sz-gz)>radiusCells){fallbacks++;return null;}
  if(sx===gx&&sz===gz)return[];
  const field=fieldFor(gx,gz,revision);expand(field,startKey,isBlocked,costAt,isSegmentBlocked);
  if(!field.settled.has(startKey)){fallbacks++;return null;}
  const path=[];let current=startKey,guard=0;
  while(current!==field.goalKey&&guard++<maxPath){const nextKey=field.next.get(current);if(!nextKey){fallbacks++;return null;}const[x,z]=nextKey.split(',').map(Number);path.push({x:x*worldStep,z:z*worldStep});current=nextKey;}
  if(current!==field.goalKey){fallbacks++;return null;}return path;
 }
 return{route,clear(){for(const field of cache.values())release(field);cache.clear();},snapshot(){return Object.freeze({fields:cache.size,builds,hits,fallbacks,maxCells,radiusCells,worldStep,nodePool:allocatedNodes,reusedNodes,expandedCells});}};
}
