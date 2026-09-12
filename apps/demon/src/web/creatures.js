import * as T from 'three';
import {sampleDevourMotion} from './devour-motion.js';
const up=new T.Vector3(0,1,0),temp=new T.Vector3();
const palette=new Map();
function mat(c,emissive=0){const k=c+':'+emissive;if(!palette.has(k))palette.set(k,new T.MeshStandardMaterial({color:c,roughness:.72,metalness:.12,emissive,emissiveIntensity:emissive?1.4:0}));return palette.get(k);}
const geo={sphere:new T.IcosahedronGeometry(1,1),bone:new T.CylinderGeometry(.68,1,1,8),cone:new T.ConeGeometry(1,1,6),box:new T.BoxGeometry(1,1,1)};
function part(g,type,c,p,s){const m=new T.Mesh(geo[type],mat(c));m.position.set(...p);m.scale.set(...s);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;}
function segment(g,c,r=.05){const m=new T.Mesh(geo.bone,mat(c));m.userData.radius=r;m.castShadow=true;g.add(m);return m;}
function connect(m,a,b,r=m.userData.radius){const av=new T.Vector3(...a),bv=new T.Vector3(...b);m.position.copy(av).add(bv).multiplyScalar(.5);m.quaternion.setFromUnitVectors(up,temp.copy(bv).sub(av).normalize());m.scale.set(r,av.distanceTo(bv),r);}
function horn(g,a,b,r=.07,c=0xb2b0a0){const o=part(g,'cone',c,[0,0,0],[r,1,r]);connect(o,a,b,r);return o;}
export function createCreature(monster=false,role='traveller'){
 const g=new T.Group(),body=new T.Group();g.add(body);const skin=monster?0x697773:0xa18c77,cloth=monster?0x26342f:({smith:0x63463d,hunter:0x354b40,knight:0x657078,arcanist:0x494256,acolyte:0x817961}[role]||0x4b514d),bone=0x849888;
 const torso=part(body,'sphere',cloth,[0,1.22,0],monster?[.31,.54,.25]:[.25,.35,.17]);
 part(body,'sphere',monster?0x27342f:0x343c39,[0,.9,0],monster?[.27,.25,.2]:[.24,.17,.17]);
 const head=new T.Group();head.position.set(0,monster?1.8:1.65,monster?.19:0);body.add(head);
 if(monster){part(head,'sphere',bone,[0,0,0],[.15,.31,.24]);part(head,'box',0x101c19,[0,-.045,.236],[.21,.12,.05]);
  for(const s of [-1,1]){const eye=part(head,'sphere',0x191b16,[s*.105,.09,.238],[.041,.019,.027]);eye.material=mat(0xbf6945,0xbb3322);part(head,'cone',0xc1c3ab,[s*.10,-.105,.27],[.025,.13,.026]).rotation.x=Math.PI;
   horn(head,[s*.12,.15,-.035],[s*.38,.61,-.22],.065);horn(head,[s*.34,.55,-.2],[s*.26,.83,-.33],.03);horn(head,[s*.26,.41,-.16],[s*.53,.63,-.12],.034);}
  for(const sign of [-1,1]){const brow=part(head,'box',0x475e51,[sign*.098,.137,.16],[.15,.06,.11]);brow.rotation.z=sign*.24;horn(body,[sign*.3,1.5,-.02],[sign*.55,1.82,-.12],.095,0x6d8477);}
  for(let i=0;i<5;i++){for(const s of [-1,1]){const rib=part(body,'sphere',0x72887a,[s*(.13+i*.015),1.47-i*.1,.12],[.16,.020,.16]);rib.rotation.z=s*(.35-i*.035);}horn(body,[0,1.5-i*.13,-.22],[0,1.63-i*.13,-.47],.048);}
 }else{
  part(head,'sphere',skin,[0,0,0],[.15,.19,.135]);part(head,'sphere',role==='knight'?0x6d797b:0x31332e,[0,.095,-.025],[.16,.12,.145]);part(head,'box',skin,[0,-.02,.137],[.04,.065,.041]);
  for(const s of [-1,1])part(head,'box',0x151e1e,[s*.06,.027,.13],[.044,.014,.024]);
  if(['arcanist','acolyte','gravekeeper'].includes(role)){part(head,'cone',cloth,[0,.22,-.03],[.2,.33,.17]);part(body,'cone',cloth,[0,.65,0],[.31,.60,.21]);}
  if(role==='knight'){part(head,'box',0x293538,[0,-.014,.151],[.23,.06,.035]);for(const s of [-1,1])part(body,'sphere',0x79868a,[s*.27,1.4,0],[.19,.12,.19]);}
 }
 const jaw=new T.Group();jaw.position.set(0,-.15,.12);head.add(jaw);if(monster){part(jaw,'sphere',0x899a89,[0,0,.12],[.145,.07,.20]);for(const s of [-1,1])horn(jaw,[s*.09,0,.24],[s*.08,.15,.23],.025);}
 const limbs=[];
 for(const s of [-1,1]){
  const leg={s,upper:segment(body,monster?0x65756c:0x393e3a,monster?.083:.066),lower:segment(body,monster?0x839284:0x343a37,monster?.055:.05),foot:part(body,'sphere',monster?0x273c34:0x242e2b,[s*.17,.07,.1],monster?[.12,.073,.25]:[.11,.07,.18])};
  const arm={s,upper:segment(body,cloth,monster?.105:.067),lower:segment(body,monster?0x9ba797:cloth,monster?.071:.055),hand:part(body,'sphere',skin,[0,0,0],monster?[.13,.15,.10]:[.07,.075,.065]),claws:[]};
  if(monster)for(let j=0;j<3;j++){const claw=part(body,'cone',0xc8c8b1,[0,0,0],[.026,.25,.026]);arm.claws.push(claw);}
  limbs.push({leg,arm});
 }
 const weapon=new T.Group();body.add(weapon);
 if(!monster&&role!=='traveller'&&role!=='bellkeeper'&&role!=='gravekeeper'){
  part(weapon,'box',0xb9c9c9,[0,.55,0],[.065,.88,.027]);part(weapon,'box',0x8b7d59,[0,.1,0],[.25,.045,.07]);part(weapon,'bone',0x42332d,[0,-.03,0],[.031,.24,.031]);
 }
 const wings=new T.Group();body.add(wings);wings.visible=false;
 if(monster)for(const s of [-1,1]){const pts=[[s*.2,1.49,-.16],[s*.68,2.03,-.43],[s*1.47,1.86,-.61],[s*1.0,.98,-.45],[s*.71,1.26,-.32],[s*.48,.72,-.33]];const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute([0,1,2,0,2,3,0,3,4,0,4,5].flatMap(i=>pts[i]),3));geometry.computeVertexNormals();const wm=new T.MeshStandardMaterial({color:0x3d524c,roughness:.9,side:T.DoubleSide});const mesh=new T.Mesh(geometry,wm);mesh.castShadow=true;wings.add(mesh);for(const i of [1,2,3,4,5]){const sp=segment(wings,0x8b9c87,.028);connect(sp,pts[0],pts[i]);}}
 g.userData={monster,body,head,jaw,torso,limbs,weapon,wings};return g;
}
export function animateCreature(g,a,time,options={}){
 const u=g.userData,m=u.monster,q=a.dead?null:a.pose,walking=!q&&((a.speed||0)>.05||a.state==='flee'||a.state==='pursue'||a.state==='idle'&&Math.sin((a.clock||0)*.45)>.35),phase=q?.phase??a.walk??time*3,step=walking?.24:0;
 const crouch=q?.crouch||0,lift=q?.lift||0;
 g.position.set(a.x,lift*.8,a.z);g.rotation.y=a.yaw||0;g.scale.setScalar(m?(options.form==='brute'?1.12:options.form==='stalker'?1.04:1):1);
 u.body.position.set(0,crouch*.75+(walking?Math.sin(phase*2)*.025:Math.sin(time*1.7)*.018),0);u.body.rotation.set((q?.pitch||0)+(m?.16:0),q?.twist||Math.cos(phase)*step*.25,q?.roll||Math.sin(time)*.012);
 u.head.rotation.set(-u.body.rotation.x*.6,Math.sin(time*.8)*.06,Math.sin(time*.5)*.025);
 u.jaw.rotation.x=-.035-Math.sin(time*1.1)*.025;
 u.wings.visible=m&&options.form==='wraith';u.wings.rotation.y=Math.sin(time*2)*.07;
 u.torso.scale.x=(m?.35:.25)*(options.form==='brute'?1.22:1);u.torso.scale.z=(m?.25:.17)*(1+Math.sin(time*2)*.025);
 for(const {leg,arm} of u.limbs){const s=leg.s,sw=Math.cos(phase+(s===1?0:Math.PI)),ank=[s*.17,.07+Math.max(0,sw)*step*.5,sw*step];const knee=[s*.19,.46,Math.max(0,sw)*step*.7+(m?.14:0)];connect(leg.upper,[s*.16,.91,0],knee);connect(leg.lower,knee,ank);leg.foot.position.set(ank[0],ank[1],ank[2]+.08);leg.foot.rotation.set(0,0,0);
 let hand=q?(s===1?q.hand:q.left).slice():[s*(m?.47:.36),m?.71:1.03,.05-sw*step*.8];
 const shoulder=[s*.28,1.47,-.025],elbow=[s*(m?.58:.38),(1.47+hand[1])*.5-.1,hand[2]*.47-.10];connect(arm.upper,shoulder,elbow);connect(arm.lower,elbow,hand);arm.hand.position.set(...hand);for(let j=0;j<arm.claws.length;j++){let c=arm.claws[j];c.position.set(hand[0]+(j-1)*.066,hand[1]-.12,hand[2]+.085);c.rotation.x=Math.PI*.83;}
 if(s===1){const tip=q?.tip||[hand[0],hand[1]+.9,hand[2]+.3];u.weapon.position.set(...hand);u.weapon.quaternion.setFromUnitVectors(up,temp.set(tip[0]-hand[0],tip[1]-hand[1],tip[2]-hand[2]).normalize());}}
 if(m&&!a.dead&&options.eating&&Number.isFinite(a.devourProgress))applyDevourPose(g,sampleDevourMotion(a.devourProgress));
 u.weapon.visible=!a.dead;
 if(a.dead){g.rotation.z=m?.35:1.45;g.position.y=.13;u.body.rotation.x=.12;}else g.rotation.z=0;
 if(!m&&a.dead&&a.capturedBy)applyCapturedPose(g,a.capturedBy);
}


const pivot=new T.Vector3(0,.91,0),inverse=new T.Quaternion(),point=new T.Vector3();
function bodyLocal(body,x,y,z){return point.set(x,y,z).sub(body.position).applyQuaternion(inverse).toArray();}
function applyDevourPose(g,p){
 const u=g.userData;
 // Pivot at the pelvis, not the ground. Solve feet back into body space so
 // the crouch never drags the soles below the terrain or swings them in air.
 u.body.rotation.set(p.pitch,p.twist,p.roll);
 u.body.position.copy(pivot).sub(point.copy(pivot).applyQuaternion(u.body.quaternion));
 u.body.position.y+=p.drop;inverse.copy(u.body.quaternion).invert();
 u.head.rotation.set(p.headPitch,p.headYaw,p.headRoll);u.jaw.rotation.x=p.jaw;
 u.torso.scale.z*=1+p.throat*.10;
 u.wings.rotation.y=p.twist*.55;
 for(const {leg,arm} of u.limbs){
  const s=leg.s,stance=p.stance;
  const foot=bodyLocal(u.body,s*(.17+.065*stance),.07,.08+s*.07*stance);
  const knee=bodyLocal(u.body,s*(.19+.075*stance),.46+p.drop*.5,.14+.20*stance);
  connect(leg.upper,[s*.16,.91,0],knee);connect(leg.lower,knee,foot);
  leg.foot.position.set(...foot);leg.foot.quaternion.copy(inverse);
  const hand=bodyLocal(u.body,s*p.handX,p.handY+(s<0?.035*stance:0),p.handZ+(s<0?.025*stance:0));
  const shoulder=[s*.28,1.47,-.025];
  const elbow=[s*(.58-.10*stance),(1.47+hand[1])*.5-.12,hand[2]*.45-.10];
  connect(arm.upper,shoulder,elbow);connect(arm.lower,elbow,hand);arm.hand.position.set(...hand);
  for(const [j,claw] of arm.claws.entries()){
   claw.position.set(hand[0]+(j-1)*.054,hand[1]-.08,hand[2]+.045);
   claw.rotation.x=Math.PI*(.83-.22*stance);
  }
 }
}
function applyCapturedPose(g,capture){
 const p=sampleDevourMotion(capture.progress),k=p.hold;
 const size=capture.form==='brute'?1.12:capture.form==='stalker'?1.04:1;
 const yaw=capture.yaw||0,cs=Math.cos(yaw),sn=Math.sin(yaw);
 // Present the prone torso between the hands. This only moves the render
 // group; NPC/world coordinates and collision geometry remain unchanged.
 const forward=(.66-p.preyLift*.35)*size;
 const tx=capture.x+cs*1.15+sn*forward,tz=capture.z-sn*1.15+cs*forward;
 g.position.x+=(tx-g.position.x)*k;g.position.z+=(tz-g.position.z)*k;
 g.position.y+=p.preyLift*k;
 g.rotation.y+=Math.atan2(Math.sin(yaw-g.rotation.y),Math.cos(yaw-g.rotation.y))*k;
 g.rotation.z+=(Math.PI/2-g.rotation.z)*k;
 g.userData.head.rotation.z+=p.headYaw*.28*k;
}
