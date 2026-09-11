/** Palm-fitted handles and bevel/fullered blades. Original blade endpoints are retained.
 * Vertex format is Tidebreak's existing [position3, normal3, color4, material1].
 * No VRM mesh, texture, rig or vendor bytes are edited.
 */
import {smooth01} from './quality-math.js';
const CLAMP=(x,a,b)=>Math.min(b,Math.max(a,x));
const HANDLE={
 sword:{radius:.045,lo:-.225,hi:.083,feather:.045},
 great:{radius:.046,lo:-.405,hi:.095,feather:.05},
 katana:{radius:.040,lo:-.312,hi:.075,feather:.033},
 spear:{radius:.038,lo:-.62,hi:1.42,feather:.10},
 axe:{radius:.049,lo:-.36,hi:.93,feather:.075}
};
export function measuredGripRadius(character) {
  const s=character?.sockets?.right;
  const palm=(s?.palmLength||.09)*(character?.unit||1);
  const width=(s?.palmWidth||.058)*(character?.unit||1);
  return CLAMP(Math.min(palm*.23,width*.42),.017,.032);
}
function gripEnvelope(y,p) {
 return smooth01((y-p.lo+p.feather)/p.feather)*smooth01((p.hi+p.feather-y)/p.feather);
}
function triangle(out,a,b,c,col,g) {
 const u=b.map((n,i)=>n-a[i]),v=c.map((n,i)=>n-a[i]);
 const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
 const len=Math.hypot(...n); if(len<1e-12)return;
 for(const p of [a,b,c])out.push(...p,...n.map(x=>x/len),...col,1,g);
}
function fulleredBlade(out,great=false) {
 const sx=great?1.52:1,sy=great?1.198:1,sz=great?1.20:1;
 const rings=[[.18,.080,.024],[.245,.104,.033],[.35,.083,.023],[1.36,.058,.012],[1.62,0,0]];
 // Beveled cutting edges, broad faces, shallow central fuller. No texture flicker.
 const profile=[[-1,0],[-.79,.70],[-.24,1],[-.15,.74],[.15,.74],[.24,1],[.79,.70],[1,0],[.79,-.70],[.24,-1],[.15,-.74],[-.15,-.74],[-.24,-1],[-.79,-.70]];
 const p=(r,i)=>{const [y,w,d]=rings[r],[x,z]=profile[i%profile.length];return[x*w*sx,y*sy,z*d*sz];};
 for(let r=0;r<rings.length-1;r++)for(let i=0;i<profile.length;i++) {
   const edge=[0,6,7,13].includes(i),groove=[2,3,4,9,10,11].includes(i);
   const col=edge?[.91,.94,.92]:groove?[.43,.54,.60]:[.65,.75,.80];
   triangle(out,p(r,i),p(r,i+1),p(r+1,i+1),col,edge?-.97:groove?-.72:-.90);
   triangle(out,p(r,i),p(r+1,i+1),p(r+1,i),col,edge?-.97:groove?-.72:-.90);
 }
}
export function fitWeaponGeometry(input,weapon,character) {
 if (!input || input.length%33!==0) throw new Error('Invalid triangle vertex stream');
 const p=HANDLE[weapon];if(!p)return input.slice();
 const target=measuredGripRadius(character),ratio=CLAMP(target/p.radius,.32,.88),out=[];
 for(let i=0;i<input.length;i+=33) {
   const blade=(weapon==='sword'||weapon==='great') && Math.abs(input[i+10]+.96)<.002
     && Math.min(input[i+1],input[i+12],input[i+23])>=.179;
   if(blade)continue;
   // Ornament sizing follows palm scale, independent of damaging blade geometry.
   const minY=Math.min(input[i+1],input[i+12],input[i+23]),maxY=Math.max(input[i+1],input[i+12],input[i+23]);
   const guard=(weapon==='katana'&&minY>.099&&maxY<.145)
     ||(['sword','great'].includes(weapon)&&Math.abs(input[i+10]+.83)<.002);
   const pommel=['sword','great'].includes(weapon)&&Math.abs(input[i+10]+.8)<.002&&maxY<0;
   const ornament=guard?CLAMP(target/(weapon==='katana'?.032:.030),.48,.78):pommel?.78:1;
   for(let j=0;j<3;j++) {
     const k=i+j*11,x=input[k],y=input[k+1],z=input[k+2];
     const f=(1+(ratio-1)*gripEnvelope(y,p))*ornament;
     const eps=.0001,df=(ratio-1)*(gripEnvelope(y+eps,p)-gripEnvelope(y-eps,p))/(2*eps)*ornament;
     // Inverse-transpose of the tapered deformation, not a guessed normal scale.
     const nx=input[k+3]/f,nz=input[k+5]/f,ny=input[k+4]-df*(x*nx+z*nz);
     const len=Math.hypot(nx,ny,nz)||1;
     out.push(x*f,y,z*f,nx/len,ny/len,nz/len,...input.slice(k+6,k+11));
   }
 }
 if(weapon==='sword'||weapon==='great')fulleredBlade(out,weapon==='great');
 return new Float32Array(out);
}
export const weaponSurfaceVersion='palm-fit-bevel-2';
