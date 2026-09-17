/** Tidebreak Atelier 10 swipe thresholds and camera-relative direction.
 * No tap target/pathfinding. A quick terminal flick keeps running; a held drag stops on release.
 */
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
export const SWIPE_RULES=Object.freeze({deadzone:6,range:40,nub:34,flickMs:420,flickMinPx:30,flickVelocity:.32,releaseMinPx:16,releaseVelocity:.22,releaseWindowMs:130,walkSpeed:2.85,combatSpeed:2.25,dashSpeed:4.65,notice:3.9});
export class SwipeInput {
 constructor(){this.id=null;this.dx=this.dy=this.amount=0;this.dash=false;this.dashX=this.dashY=0;this.samples=[];}
 down(id,x,y,t){if(this.id!==null)return false;this.cancel();this.id=id;this.x=x;this.y=y;this.started=t;this.samples=[{x,y,t}];return true;}
 move(id,x,y,t){if(id!==this.id)return false;this.dx=x-this.x;this.dy=y-this.y;this.amount=clamp((Math.hypot(this.dx,this.dy)-SWIPE_RULES.deadzone)/SWIPE_RULES.range,0,1);this.samples.push({x,y,t});while(this.samples.length>2&&this.samples[1].t<t-SWIPE_RULES.releaseWindowMs)this.samples.shift();return true;}
 up(id,x,y,t){
  if(this.id!==id)return false;
  const elapsed=t-this.started,dx=x-this.x,dy=y-this.y,d=Math.hypot(dx,dy),recent=this.samples.find(p=>p.t>=t-SWIPE_RULES.releaseWindowMs)||this.samples.at(-1);
  const releaseDx=recent?x-recent.x:dx,releaseDy=recent?y-recent.y:dy,releaseDist=Math.hypot(releaseDx,releaseDy),releaseDt=recent?Math.max(12,t-recent.t):Math.max(12,elapsed),releaseVelocity=releaseDist/releaseDt;
  const terminal=releaseDist>=SWIPE_RULES.releaseMinPx&&releaseVelocity>=SWIPE_RULES.releaseVelocity;
  const releaseMoving=releaseDist>=SWIPE_RULES.releaseMinPx*.5&&releaseVelocity>=SWIPE_RULES.releaseVelocity*.75;
  const quick=elapsed<=SWIPE_RULES.flickMs&&d>=SWIPE_RULES.flickMinPx&&d/Math.max(24,elapsed)>=SWIPE_RULES.flickVelocity&&releaseMoving;
  const flick=terminal||quick,aimX=terminal?releaseDx:dx,aimY=terminal?releaseDy:dy,aimDist=terminal?releaseDist:d;
  this.cancel();if(flick&&aimDist>0){this.dash=true;this.dashX=aimX/aimDist;this.dashY=aimY/aimDist;}return flick;
 }
 cancel(){this.id=null;this.dx=this.dy=this.amount=0;this.samples=[];this.dash=false;}
 vector(angle=0){let x,y,amount;if(this.dash){x=this.dashX;y=this.dashY;amount=1;}else{const l=Math.hypot(this.dx,this.dy)||1;x=this.dx/l;y=this.dy/l;amount=this.amount;}return{x:Math.cos(angle)*x+Math.sin(angle)*y,z:-Math.sin(angle)*x+Math.cos(angle)*y,screenX:x,screenY:y,amount};}
}
