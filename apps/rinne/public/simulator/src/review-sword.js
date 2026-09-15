/** Sword silhouette uses the simulator's existing blade rings and half-size socket. */
import * as T from '../vendor/three.js';
// Existing simulator weapon dimensions/silhouettes, for attachment observation.
// These are the game's current blockout meshes, not newly approved production art.
export const REVIEW_WEAPONS=Object.freeze({
 sword:{base:.21,tip:1.62,width:.065},great:{base:.26,tip:1.94,width:.095},
 katana:{base:.16,tip:1.72,width:.055},spear:{base:1.60,tip:2.25,width:.08},axe:{base:.99,tip:1.53,width:.23}
});
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

/** Adapt the simulator's existing atelier geometry to Three's review renderer. */
export function createReviewWeapon(weapon='sword'){
 if(weapon==='sword')return createReviewSword();
 if(!REVIEW_WEAPONS[weapon])throw Error('Unsupported review weapon: '+weapon);
 const group=new T.Group(),gold=new T.MeshStandardMaterial({color:'#d7bd81',metalness:.5,roughness:.35}),steel=new T.MeshStandardMaterial({color:'#c9d9e5',metalness:.65,roughness:.28,side:T.DoubleSide}),dark=new T.MeshStandardMaterial({color:'#233244',roughness:.8}),wood=new T.MeshStandardMaterial({color:'#5c4c3c',roughness:.8});
 const add=(geometry,material,x=0,y=0,z=0)=>{const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);group.add(mesh);return mesh;};
 const cylinder=(y,r1,r2,length,material)=>add(new T.CylinderGeometry(r1,r2,length,12),material,0,y);
 const polygon=(points,depth,material)=>{const shape=new T.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();return add(new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false}),material,0,0,-depth/2);};
 if(weapon==='great'){
  const blade=createReviewSword();
  // A two-hand hilt has one pommel at its end; the short sword pommel would sit inside the support palm.
  const shortPommel=blade.children.at(-1);shortPommel.removeFromParent();shortPommel.geometry.dispose();
  blade.scale.set(1.52,1.198,1.20);group.add(blade);
  cylinder(-.22,.046,.046,.34,dark);for(let i=0;i<6;i++)cylinder(-.36+i*.045,.051,.051,.012,gold);
  add(new T.SphereGeometry(1,10,6),gold,0,-.44).scale.set(.085,.10,.065);
 }else if(weapon==='katana'){
  const rings=[[.15,.033,.010,0],[.36,.037,.010,.008],[.70,.035,.009,.032],[1.10,.030,.008,.077],[1.46,.026,.006,.143],[1.72,0,0,.19]],positions=[];
  const point=(k,i)=>{const[y,w,d,x]=rings[k];return[[x-w,y,0],[x,y,d],[x+w,y,0],[x,y,-d]][i%4];};
  for(let k=0;k<rings.length-1;k++)for(let i=0;i<4;i++)positions.push(...point(k,i),...point(k,i+1),...point(k+1,i+1),...point(k,i),...point(k+1,i+1),...point(k+1,i));
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();add(geometry,steel);
  cylinder(.12,.115,.115,.034,gold);cylinder(-.115,.038,.040,.41,dark);cylinder(-.34,.043,.043,.034,gold);
  for(let i=0;i<7;i++)add(new T.BoxGeometry(.052,.026,.010),gold,0,-.28+i*.053,.038).rotation.z=.5;
 }else if(weapon==='spear'){
  cylinder(.47,.032,.042,2.32,wood);for(const y of[-.42,.27,1.30])cylinder(y,.048,.048,.12,gold);
  cylinder(1.60,.044,.07,.28,steel);polygon([[-.024,1.57],[-.10,1.81],[0,2.25],[.10,1.81],[.024,1.57]],.047,steel);
  add(new T.BoxGeometry(.018,.32,.025),steel,0,1.57,.028);
 }else{
  cylinder(.33,.046,.050,1.40,wood);for(let i=0;i<5;i++)cylinder(-.21+i*.075,.057,.057,.044,dark);
  add(new T.SphereGeometry(1,10,6),gold,0,-.42).scale.set(.075,.084,.072);
  add(new T.BoxGeometry(.16,.52,.11),gold,0,1.13);
  polygon([[-.06,.92],[-.20,1.01],[-.55,.93],[-.64,1.27],[-.57,1.53],[-.19,1.37],[-.06,1.39]],.065,steel);
  polygon([[.03,1.02],[.30,1.04],[.41,1.22],[.16,1.36],[.03,1.39]],.068,steel);
 }
 group.name='ReviewWeapon:'+weapon;return group;
}
