import {muraBlocked} from '@soul/world/mura';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function clearStorySegment(layout,a,b){const steps=Math.max(1,Math.ceil(distance(a,b)/.5));for(let i=0;i<=steps;i++)if(muraBlocked(layout,a.x+(b.x-a.x)*i/steps,a.z+(b.z-a.z)*i/steps,.55))return false;return true;}
/** Bounded A* over the current MURA collision rules, including its river crossings.
 * This is guidance only: it never moves an actor or writes the shared layout. */
export function storyRoute(layout,start,target){
 if(clearStorySegment(layout,start,target))return [{x:target.x,z:target.z}];
 const heap=[],best=new Map(),key=(i,j)=>`${i},${j}`;
 function push(n){heap.push(n);let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p].f<=n.f)break;heap[i]=heap[p];i=p;}heap[i]=n;}
 function pop(){const first=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(heap[c].f>=last.f)break;heap[i]=heap[c];i=c;}heap[i]=last;}return first;}
 const root={i:0,j:0,x:start.x,z:start.z,g:0,f:distance(start,target),parent:null};push(root);best.set('0,0',0);
 for(let visited=0;heap.length&&visited<18000;visited++){
  const n=pop();if(n.g!==best.get(key(n.i,n.j)))continue;
  if(distance(n,target)<3&&clearStorySegment(layout,n,target)){
   const raw=[{x:target.x,z:target.z}];for(let p=n;p.parent;p=p.parent)raw.unshift({x:p.x,z:p.z});
   const path=[];let from=start;for(let i=0;i<raw.length;){let next=i;while(next+1<raw.length&&clearStorySegment(layout,from,raw[next+1]))next++;path.push(raw[next]);from=raw[next];i=next+1;}return path;
  }
  for(let di=-1;di<=1;di++)for(let dj=-1;dj<=1;dj++){if(!di&&!dj)continue;
   const i=n.i+di,j=n.j+dj,p={i,j,x:start.x+i*2,z:start.z+j*2},g=n.g+Math.hypot(di,dj)*2,k=key(i,j);
   if(g>Math.max(240,distance(start,target)*2.5)||g>=(best.get(k)??Infinity)||!clearStorySegment(layout,n,p))continue;
   best.set(k,g);push({...p,g,f:g+distance(p,target),parent:n});
  }
 }
 return null;
}
