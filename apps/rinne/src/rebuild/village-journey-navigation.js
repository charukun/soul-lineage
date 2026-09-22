import { defs, muraWorldToLocal, muraLocalToWorld, muraHasInterior, muraEntry, inWater } from '@soul/world/mura';
import { journeyFor } from './village-journey.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const inCourt=p=>p.x>-4&&p.x<10.5&&p.z>-14&&p.z<-4;
const caches=new WeakMap();

// Visibility uses full catalog footprints, not a second movement/collision authority.
const obstacles=new WeakMap();
function footprintRows(context){
  let rows=obstacles.get(context);
  if(!rows){rows=context.layout.objects.filter(o=>o.phase==='built'&&defs[o.kind]?.building&&!defs[o.kind].open);obstacles.set(context,rows);}
  return rows;
}
function intersectsBox(a,b,x0,x1,z0,z1){
  let low=0,high=1;
  for(const [p,d,min,max] of [[a.x,b.x-a.x,x0,x1],[a.z,b.z-a.z,z0,z1]]){
    if(Math.abs(d)<1e-8){if(p<min||p>max)return false;continue;}
    let t0=(min-p)/d,t1=(max-p)/d;if(t0>t1)[t0,t1]=[t1,t0];
    low=Math.max(low,t0);high=Math.min(high,t1);if(low>high)return false;
  }
  return true;
}
function segmentDistance(a,b,p){
  const dx=b.x-a.x,dz=b.z-a.z,length=dx*dx+dz*dz;
  const t=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/length)):0;
  return Math.hypot(a.x+dx*t-p.x,a.z+dz*t-p.z);
}

/** Keep the automatic mother tour and objective arrow on the same ground. */
export function journeySegmentClear(context,a,b,{danger=false,training=false}={}){
  const battle=context.stations?.find(row=>row.id==='village-skirmish');
  if(!training&&!inCourt(a)&&intersectsBox(a,b,-4,10.5,-14,-4))return false;
  if(!danger&&battle&&distance(a,battle)>=12&&segmentDistance(a,b,battle)<12)return false;
  for(const o of footprintRows(context)){
    const d=defs[o.kind],p=muraWorldToLocal(o,a.x,a.z),q=muraWorldToLocal(o,b.x,b.z);
    if(intersectsBox(p,q,-d.w/2-.45,d.w/2+.45,-d.d/2-.45,d.d/2+.45))return false;
  }
  const steps=Math.max(1,Math.ceil(distance(a,b)/.6));
  for(let i=0;i<=steps;i++){
    const t=i/steps;if(inWater(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t,.45))return false;
  }
  return true;
}

function graphFor(context,stations){
  let cache=caches.get(context);if(cache)return cache;
  context.stations=stations;
  const nodes=context.nodes,byId=new Map(nodes.map((n,i)=>[n.id,i]));
  const edges=nodes.map(()=>[]);
  for(const edge of context.edges){
    const a=byId.get(edge.from),b=byId.get(edge.to);
    if(a===undefined||b===undefined||!journeySegmentClear(context,nodes[a],nodes[b],{danger:edge.danger}))continue;
    const cost=distance(nodes[a],nodes[b]);
    edges[a].push({index:b,cost,danger:edge.danger});edges[b].push({index:a,cost,danger:edge.danger});
  }
  cache={nodes,edges,requests:new Map()};caches.set(context,cache);return cache;
}

function route(context,graph,start,target){
  const danger=target.id==='village-skirmish',training=inCourt(target),options={danger,training};
  if(distance(start,target)<14&&journeySegmentClear(context,start,target,options))return [];
  const nearest=p=>graph.nodes.map((n,index)=>({index,cost:distance(p,n)})).sort((a,b)=>a.cost-b.cost).slice(0,12);
  const starts=nearest(start).filter(row=>journeySegmentClear(context,start,graph.nodes[row.index],options)).slice(0,3);
  const ends=new Map(nearest(target).filter(row=>journeySegmentClear(context,graph.nodes[row.index],target,options)).slice(0,3).map(row=>[row.index,row.cost*1.3]));
  if(!starts.length||!ends.size)return starts.length?[graph.nodes[starts[0].index]]:[];
  const costs=graph.nodes.map(()=>Infinity),previous=graph.nodes.map(()=>-1),visited=new Set();
  for(const row of starts)costs[row.index]=row.cost*1.3;
  let end=-1,best=Infinity;
  for(let step=0;step<graph.nodes.length;step++){
    let index=-1;for(let i=0;i<costs.length;i++)if(!visited.has(i)&&(index<0||costs[i]<costs[index]))index=i;
    if(index<0||!Number.isFinite(costs[index])||costs[index]>=best)break;
    visited.add(index);
    if(ends.has(index)&&costs[index]+ends.get(index)<best){best=costs[index]+ends.get(index);end=index;}
    for(const edge of graph.edges[index]){
      if(edge.danger&&!danger)continue;
      const cost=costs[index]+edge.cost;
      if(cost<costs[edge.index]){costs[edge.index]=cost;previous[edge.index]=index;}
    }
  }
  if(end<0)return [graph.nodes[starts[0].index]];
  const result=[];for(let index=end;index>=0;index=previous[index])result.unshift(graph.nodes[index]);
  while(result.length&&distance(start,result[0])<1.35)result.shift();
  return result;
}

export function nextJourneyTarget(position,target,stations,{consumer='guide'}={}){
  const context=journeyFor(stations);
  if(!context||!position||!target||![position.x,position.z,target.x,target.z].every(Number.isFinite))return target;
  // Return-home and old saves may start inside a building with no active interior.
  // Point through its real doorway rather than cutting a new collision-free exit.
  for(const object of footprintRows(context)){
    if(!muraHasInterior(object))continue;
    const local=muraWorldToLocal(object,position.x,position.z),d=defs[object.kind];
    if(Math.abs(local.x)>=d.w/2||Math.abs(local.z)>=d.d/2)continue;
    const exit=Math.abs(local.x)>.35?muraLocalToWorld(object,0,Math.min(local.z,d.d/2-1.4)):muraEntry(object);
    return {...target,...exit,id:`journey-exit.${object.id}`,label:`出口 → ${target.label}`,destinationId:target.id};
  }
  const graph=graphFor(context,stations);
  const key=`${target.id}:${target.x}:${target.z}:${Math.floor(position.x/.75)}:${Math.floor(position.z/.75)}`;
  let request=graph.requests.get(consumer);
  if(request?.key!==key){request={key,path:route(context,graph,position,target)};graph.requests.set(consumer,request);}
  const next=request.path.find(p=>distance(position,p)>=1.35);
  return next?{...next,id:`journey-route.${target.id}.${next.id}`,label:`${next.label} → ${target.label}`,destinationId:target.id,destinationLabel:target.label}:target;
}

export function routeVillageGuidance(state,stations,guide){
  if(state.zone!=='village'||state.interior||state.phase==='birth'||state.activity||!guide?.target)return guide;
  return {...guide,target:nextJourneyTarget(state.position,guide.target,stations)};
}
