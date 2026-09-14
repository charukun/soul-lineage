import { BufferGeometry, Float32BufferAttribute, SphereGeometry, CylinderGeometry, TorusGeometry, BoxGeometry,
  CatmullRomCurve3, Vector3, Matrix4, Euler, Quaternion } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Immutable procedural geometry is shared across every actor and released only after the
// last lease. Parts are built on demand, not 36 haircuts and every outfit per resident.
const cache = new Map();
export function wardrobeCacheStats() { return { geometries: cache.size, leases: [...cache.values()].reduce((n, e) => n + e.refs, 0) }; }
export function leaseWardrobeGeometry(key, factory) {
  let entry = cache.get(key);
  if (!entry) { entry = { geometry: factory(), refs: 0 }; cache.set(key, entry); }
  entry.refs++; let released = false;
  return { geometry: entry.geometry, release() { if (released) return; released = true;
    if (--entry.refs === 0) { entry.geometry.dispose(); cache.delete(key); } } };
}
function transform(geo, position = [0,0,0], scale = [1,1,1], rotation = [0,0,0]) {
  geo.applyMatrix4(new Matrix4().compose(new Vector3(...position), new Quaternion().setFromEuler(new Euler(...rotation)), new Vector3(...scale))); return geo;
}
function merged(parts) {
  if (!parts.length) return new BufferGeometry().setAttribute('position', new Float32BufferAttribute([],3));
  const input = parts.map(g => { const n = g.index ? g.toNonIndexed() : g;
    for (const key of Object.keys(n.attributes)) if (!['position','normal'].includes(key)) n.deleteAttribute(key); return n; });
  const result = mergeGeometries(input, false);
  new Set([...input,...parts]).forEach(g => g.dispose());
  if (!result) throw new Error('Wardrobe geometry merge failed');
  result.computeBoundingSphere(); return result;
}
function ellipsoid(position, scale, segments=12) { return transform(new SphereGeometry(1,segments,8), position, scale); }
function cylinder(position,r1,r2,height,rotation=[0,0,0],segments=10) { return transform(new CylinderGeometry(r1,r2,height,segments),position,[1,1,1],rotation); }
function box(position,scale,rotation=[0,0,0]) { return transform(new BoxGeometry(1,1,1),position,scale,rotation); }
function ring(position,radius,thickness,scale=[1,1,1],rotation=[Math.PI/2,0,0]) { return transform(new TorusGeometry(radius,thickness,5,16),position,scale,rotation); }

/** Closed, tapered, curved lock. Longitudinal ridges read as sculpted hair, not cylinders. */
function lock(points, width, depth, segments=9, sides=6) {
  const curve = new CatmullRomCurve3(points.map(p=>new Vector3(...p))), positions=[],indices=[];
  const up=new Vector3(0,0,1), side=new Vector3(), normal=new Vector3();
  for(let i=0;i<=segments;i++) {
    const t=i/segments,p=curve.getPoint(t),tangent=curve.getTangent(t).normalize();
    side.crossVectors(tangent,up); if(side.lengthSq()<.001)side.set(1,0,0);else side.normalize(); normal.crossVectors(side,tangent).normalize();
    const taper=Math.max(.025,Math.pow(1-t,.45)),root=.6+.4*Math.sin(Math.min(1,t*4)*Math.PI/2);
    for(let j=0;j<sides;j++) { const a=j/sides*Math.PI*2,v=p.clone().addScaledVector(side,Math.cos(a)*width*taper*root).addScaledVector(normal,Math.sin(a)*depth*taper);positions.push(v.x,v.y,v.z); }
  }
  for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides,c=a+sides,d=b+sides;indices.push(a,b,c,b,d,c);}
  for(let j=1;j<sides-1;j++){indices.push(0,j+1,j);const e=segments*sides;indices.push(e,e+j,e+j+1);}
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}

/** Head-local coordinates fitted to the audited bind pose (head pivot y=1.4224m).
 * Crown clears the scalp; front locks finish above or beside the eye, never through it.
 */
export function hairGeometry(family, front='parted', back='close') {
  const pieces=[];
  const crown=transform(new SphereGeometry(1,18,10,0,Math.PI*2,0,Math.PI*.57),[0,.112,-.014],[.116,.115,.106]);pieces.push(crown);
  const short=family==='crop', bob=family==='bob';
  // Nape/sides follow the skull; layered bob is a different volume from a short crop.
  const length=short?(back==='layered'?.065:.043):bob?(back==='layered'?.17:.125):.07;
  for(let i=0;i<11;i++){
    const angle=.18+i/10*(Math.PI*2-.36),x=Math.sin(angle)*.104,z=-Math.cos(angle)*.091-.014;
    // The front 70 degrees are reserved for explicit front locks.
    if(z>.060&&Math.abs(x)<.085)continue;
    pieces.push(lock([[x*.62,.205,z*.64-.014],[x,.145,z],[x*(bob?1.10:1.01),.07,z*(bob?1.06:1)],
      [x*(bob?.97:.90),.06-length,z*.96]],short?.037:.040,.018,8));
  }
  if(front==='fringe'){
    for(let i=0;i<7;i++){const x=(i-3)*.026;pieces.push(lock([[x*.65,.202,.04],[x*.95,.149,.086],[x,.102,.094],[x+(i%2?.006:-.004),.077+(i%3)*.004,.090]],.025,.011,7));}
  }else if(front==='swept'){
    for(let i=0;i<6;i++){const x=-.082+i*.029;pieces.push(lock([[x,.198,.038],[x+.03,.156,.085],[x+.035,.106,.098],[Math.min(.105,x+.045),.077+i*.004,.085]],.029,.013));}
  }else if(front==='parted'){
    for(const sign of[-1,1])for(let i=0;i<4;i++)pieces.push(lock([[sign*(.010+i*.018),.215-i*.006,.020],
      [sign*(.033+i*.020),.162,.079],[sign*(.062+i*.016),.106,.091],[sign*(.075+i*.012),.060-i*.006,.072]],.023,.012));
  }else{
    for(const sign of[-1,1])for(let i=0;i<3;i++)pieces.push(lock([[sign*.027,.217,.006],[sign*(.061+i*.02),.178,.06],[sign*(.102+i*.003),.094,.04],[sign*.105,.048,.020]],.029,.014));
  }
  if(family==='tail'){
    if(back==='tied'){
      pieces.push(ellipsoid([0,.124,-.143],[.064,.058,.053]));
      for(let i=0;i<5;i++){const a=i/5*Math.PI*2;pieces.push(lock([[Math.sin(a)*.04,.16,-.151],[Math.sin(a)*.060,.123,-.188],[Math.sin(a)*.036,.085,-.177]],.019,.012,7));}
    }else{
      const high=back==='layered',start=high?.162:.071;
      for(let i=0;i<5;i++){const x=(i-2)*.021;pieces.push(lock([[x*.6,start,-.094],[x*1.1,start-.045,-.17],[x*1.15,start-.20,-.19],[x*.65,start-.33,-.155]],.031,.020,12));}
    }
  }else if(bob&&back==='tied'){
    // Half-up bob, preserving the bob's shorter nape instead of an incompatible long tail.
    pieces.push(ellipsoid([0,.103,-.131],[.050,.045,.036]));
  }
  return merged(pieces);
}

/** Elliptical tailored shell, with sewn hem/collar geometry supplied separately. */
function shell(rows, start=0, arc=Math.PI*2, segments=20) {
  const p=[],idx=[];
  rows.forEach(([y,x,z],r)=>{for(let i=0;i<=segments;i++){const a=start+i/segments*arc;p.push(Math.sin(a)*x,y,Math.cos(a)*z);}});
  for(let r=0;r<rows.length-1;r++)for(let i=0;i<segments;i++){const a=r*(segments+1)+i,b=a+segments+1;idx.push(a,b,a+1,a+1,b,b+1);}
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
function panel(rows, depth=.16) {
  const p=[],idx=[];rows.forEach(([y,w,z=depth])=>{for(let i=0;i<7;i++){const x=(i/6*2-1)*w;p.push(x,y,z+.025*(1-(x/w)**2));}});
  for(let r=0;r<rows.length-1;r++)for(let i=0;i<6;i++){const a=r*7+i,b=a+7;idx.push(a,b,a+1,a+1,b,b+1);}
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
export function outfitGeometry(outfit, trim=false) {
  if(trim) {
    if(outfit==='apron')return merged([box([-.086,.20,.145],[.023,.29,.015],[0,0,-.12]),box([.086,.20,.145],[.023,.29,.015],[0,0,.12]),ring([0,-.02,0],.165,.014,[1,1,.81])]);
    if(outfit==='mantle')return merged([ring([0,.337,-.012],.080,.018,[1,1,.84]),panel([[.31,.095,.15],[.16,.082,.166],[.03,.050,.17]])]);
    return merged([ring([0,-.025,0],.167,.014,[1,1,.82]),ring([0,.36,0],.073,.011,[1,1,.83])]);
  }
  if(outfit==='tunic')return shell([[.36,.077,.067],[.305,.216,.13],[.23,.201,.143],[.09,.162,.125],[-.025,.17,.142],[-.17,.225,.16],[-.39,.255,.17]]);
  if(outfit==='mantle')return merged([shell([[.36,.077,.075],[.305,.24,.15],[.19,.255,.18],[-.05,.28,.198],[-.31,.32,.215],[-.56,.365,.22]],.70,Math.PI*2-1.40),
    panel([[.31,.12,.132],[.22,.12,.165],[.11,.105,.17]])]);
  if(outfit==='apron')return panel([[.292,.086,.143],[.17,.12,.17],[.02,.155,.166],[-.16,.215,.186],[-.39,.232,.20]]);
  throw new Error('Unsupported wardrobe shell');
}

export function gearGeometry(gear, metal=false) {
  const p=[];
  if(gear==='pauldron'||gear==='armor'){
    if(metal){for(const x of[-.235,.235])p.push(ellipsoid([x,.274,-.006],[.101,.067,.102]));
      if(gear==='armor')p.push(shell([[.282,.148,.146],[.16,.18,.16],[.015,.161,.14]],-.83,1.66,12));}
    else p.push(ring([0,-.027,0],.171,.017,[1,1,.85]));
  }else if(gear==='quiver'){
    if(!metal){p.push(cylinder([.13,.14,-.185],.051,.044,.37,[0,0,-.20]));
      for(let i=0;i<4;i++){const x=.085+i*.020;p.push(cylinder([x,.37,-.183],.003,.003,.20,[0,0,-.20],5));}}
    else for(let i=0;i<4;i++)p.push(ellipsoid([.065+i*.020,.472,-.183],[.012,.024,.007],8));
  }else if(gear==='tools'){
    if(!metal){p.push(ring([0,-.025,0],.17,.014,[1,1,.85]),ellipsoid([.14,-.072,.16],[.049,.060,.027]),cylinder([-.18,-.082,.159],.009,.012,.19,[0,0,-.12],6));}
    else p.push(box([-.171,.004,.16],[.069,.027,.030],[0,0,-.12]));
  }else if(gear==='pack'||gear==='satchel'){
    if(!metal){const side=gear==='satchel'?.19:0;p.push(ellipsoid([side,.09,-.20],[gear==='pack'?.134:.071,.15,.074]));
      if(gear==='pack')p.push(cylinder([0,.253,-.21],.047,.047,.30,[0,0,Math.PI/2]));}
    else p.push(box([gear==='satchel'?.19:0,.12,-.277],[.028,.035,.008]));
  }else if(gear==='cowl'||gear==='shawl'||gear==='stole'){
    if(!metal){if(gear==='stole')for(const x of[-.10,.10])p.push(box([x,.13,.166],[.065,.36,.02]));
      else p.push(shell([[.37,.079,.077],[.305,.24,.152],[.22,.25,.17],[.17,.23,.165]]));}
    else p.push(ellipsoid([.096,.268,.164],[.024,.030,.010],8));
  }else if(gear==='chain'){
    if(metal)p.push(ring([0,.223,.137],.075,.007,[1,.8,1],[0,0,0]),ellipsoid([0,.14,.145],[.023,.029,.008],8));
  }else if(gear==='belt'&&!metal)p.push(ring([0,-.025,0],.169,.010,[1,1,.83]));
  return p.length?merged(p):null;
}
export function accessoryGeometry(accessory) {
  if(accessory==='glasses')return merged([ring([-.048,.055,.075],.036,.0048,[1,.74,1],[0,0,0]),ring([.048,.055,.075],.036,.0048,[1,.74,1],[0,0,0]),box([0,.055,.075],[.027,.005,.006])]);
  if(accessory==='headband')return ring([0,.114,-.005],.113,.010,[1,1,.85]);
  if(accessory==='scarf')return ring([0,.352,0],.079,.023,[1,1,.83]);
  throw new Error('Unsupported accessory');
}
