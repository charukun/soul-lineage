const TAU=Math.PI*2;
function seeded(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
export class SoulParticles {
 constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:true});const r=seeded(90210);this.dust=Array.from({length:68},()=>({x:r(),y:r(),z:.3+r()*.7,size:.5+r()*1.2,phase:r()*TAU,speed:.003+r()*.018}));this.glyphs=Array.from({length:95},()=>({x:r(),y:r(),phase:r()*TAU,speed:.05+r()*.07,char:'輪廻転焦心技体命縁魂風星夢'.at(Math.floor(r()*13))}));this.ripples=[];this.resize();}
 resize(){const r=this.canvas.getBoundingClientRect();this.w=r.width;this.h=r.height;const d=Math.min(devicePixelRatio||1,1.5);this.canvas.width=Math.round(this.w*d);this.canvas.height=Math.round(this.h*d);this.ctx?.setTransform(d,0,0,d,0,0);}
 touch(x,y,t){this.ripples.push({x,y,t});if(this.ripples.length>5)this.ripples.shift();}
 draw(t,reveal,reduced){const c=this.ctx;if(!c)return;const w=this.w,h=this.h;c.clearRect(0,0,w,h);if(reduced)return;c.globalCompositeOperation='lighter';
  for(const p of this.dust){let y=((p.y-t*p.speed)%1+1)%1*h,x=(p.x+Math.sin(t*.11+p.phase)*.04)*w;let a=(.24+Math.sin(t*.8+p.phase)*.16)*p.z;c.beginPath();c.fillStyle=`rgba(255,221,145,${a})`;c.arc(x,y,p.size*p.z,0,TAU);c.fill();if(p.z>.8){c.strokeStyle=`rgba(232,185,109,${a*.38})`;c.lineWidth=.6;c.beginPath();c.moveTo(x,y+1);c.quadraticCurveTo(x-5,y+9,x-3,y+22*p.z);c.stroke();}}
  const intro=Math.max(0,1-reveal*1.13);if(intro>.005){c.textAlign='center';for(const g of this.glyphs){const convergence=Math.pow(1-intro,2),x=(g.x+(0.52-g.x)*convergence*.42)*w+Math.sin(g.phase+t)*5,y=(g.y*h+t*8*(1-intro))%h;c.font=`${9+g.phase*1.1}px serif`;c.fillStyle=`rgba(226,203,149,${intro*(.12+.26*Math.sin(g.phase+t*.7)**2)})`;c.fillText(g.char,x,y);}}
  // Long, infrequent soul arcs; no rapid strobe or screen flashes.
  const phase=t%14;if(phase<3.8&&reveal>.65){let q=phase/3.8;c.beginPath();c.strokeStyle=`rgba(237,209,144,${Math.sin(q*Math.PI)*.15})`;c.lineWidth=.7;c.moveTo(-w*.15,h*.68);c.bezierCurveTo(w*.28,h*.40,w*.45,h*.80,w*(.3+q),h*(.59-q*.32));c.stroke();}
  this.ripples=this.ripples.filter(r=>t-r.t<1.5);for(const r of this.ripples){const age=t-r.t;c.beginPath();c.strokeStyle=`rgba(252,219,153,${(1-age/1.5)*.35})`;c.lineWidth=.6;c.arc(r.x,r.y,6+age*32,0,TAU);c.stroke();}c.globalCompositeOperation='source-over';}
 dispose(){this.ripples=[];this.ctx?.clearRect(0,0,this.w,this.h);}
}
