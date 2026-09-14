/** Sword silhouette uses the simulator's existing blade rings and half-size socket. */
import * as T from '../vendor/three.js';
export function createReviewSword(){
  const group=new T.Group(),positions=[];
  const rings=[[.18,.080,.024],[.245,.104,.033],[.35,.083,.023],[1.36,.058,.012],[1.62,0,0]];
  const point=(k,i)=>{const[y,w,d]=rings[k];return[[-w,y,0],[0,y,d],[w,y,0],[0,y,-d]][i%4];};
  for(let k=0;k<rings.length-1;k++)for(let i=0;i<4;i++){const a=point(k,i),b=point(k,i+1),c=point(k+1,i+1),d=point(k+1,i);positions.push(...a,...b,...c,...a,...c,...d);}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();
  group.add(new T.Mesh(geometry,new T.MeshStandardMaterial({color:'#c9d9e5',metalness:.65,roughness:.28,side:T.DoubleSide})));
  const gold=new T.MeshStandardMaterial({color:'#d7bd81',metalness:.5,roughness:.35});
  const guard=new T.Mesh(new T.BoxGeometry(.47,.055,.083),gold);guard.position.y=.14;group.add(guard);
  const grip=new T.Mesh(new T.CylinderGeometry(.043,.046,.32,10),new T.MeshStandardMaterial({color:'#233244',roughness:.8}));grip.position.y=-.065;group.add(grip);
  const pommel=new T.Mesh(new T.SphereGeometry(.065,10,6),gold);pommel.position.y=-.245;group.add(pommel);
  return group;
}
