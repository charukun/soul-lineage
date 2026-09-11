/** Tidebreak Atelier 10 swipe thresholds and camera-relative direction.
 * No tap target/pathfinding. A quick flick keeps running; a held drag stops on release.
 */
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
export class SwipeInput {
 constructor(){this.id=null;this.dx=this.dy=this.amount=0;this.dash=false;this.dashX=this.dashY=0;this.samples=[];}
 down(id,x,y,t){if(this.id!==null)return false;this.cancel();this.id=id;this.x=x;this.y=y;this.started=t;this.samples=[{x,y,t}];return true;}
 move(id,x,y,t){if(id!==this.id)return false;this.dx=x-this.x;this.dy=y-this.y;this.amount=clamp((Math.hypot(this.dx,this.dy)-6)/40,0,1);this.samples.push({x,y,t});while(this.samples.length>2&&this.samples[1].t<t-130)this.samples.shift();return true;}
 up(id,x,y,t){if(this.id!==id)return false;const elapsed=t-this.started,dx=x-this.x,dy=y-this.y,d=Math.hypot(dx,dy),recent=this.samples.find(p=>p.t>=t-130)||this.samples.at(-1),tail=recent?Math.hypot(x-recent.x,y-recent.y)/Math.max(12,t-recent.t):0;
 const flick=elapsed<=340&&d>=34&&d/Math.max(24,elapsed)>=.38&&tail>=.22;
 this.cancel();if(flick){this.dash=true;this.dashX=dx/d;this.dashY=dy/d;}return flick;
 }
 cancel(){this.id=null;this.dx=this.dy=this.amount=0;this.samples=[];this.dash=false;}
 vector(angle=0){let x,y,amount;if(this.dash){x=this.dashX;y=this.dashY;amount=1;}else{const l=Math.hypot(this.dx,this.dy)||1;x=this.dx/l;y=this.dy/l;amount=this.amount;}return{x:Math.cos(angle)*x+Math.sin(angle)*y,z:-Math.sin(angle)*x+Math.cos(angle)*y,screenX:x,screenY:y,amount};}
}
export const SWIPE_RULES=Object.freeze({deadzone:6,range:40,nub:34,flickMs:340,flickMinPx:34,flickVelocity:.38,releaseVelocity:.22,releaseWindowMs:130,walkSpeed:2.85,combatSpeed:2.25,dashSpeed:4.65,notice:3.9});
