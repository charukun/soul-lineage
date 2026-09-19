function project(pos){const v=pos.clone().project(camera);return{x:(v.x*.5+.5)*W,y:(-.5*v.y+.5)*H,z:v.z};}
function groundPath(pos,radius,begin=0,end=TAU){
 ctx.beginPath();const steps=Math.ceil((end-begin)*12);
 for(let i=0;i<=steps;i++){const a=begin+(end-begin)*i/steps,p=project(new V(pos.x+Math.sin(a)*radius,pos.y+.045,pos.z+Math.cos(a)*radius));i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);}
 if(end-begin>=TAU-.01)ctx.closePath();
}
function glow(x,y,r,color,alpha=1){
 if(r<=0)return;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');ctx.globalAlpha=alpha;ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.globalAlpha=1;
}
function drawEffects(){
 ctx.clearRect(0,0,W,H);const scale=H/(camera.top-camera.bottom);
 // Every effect here is drawn on a 2D canvas, never as modeled geometry.
 for(const t of torches){
  const p=project(new V(t.x,.6,t.z)),flicker=1+Math.sin(clock*7+t.seed)*.12;
  ctx.globalCompositeOperation='screen';glow(p.x,p.y,scale*2.3,'#ea731a',.22*flicker);glow(p.x,p.y,scale*.42,'#ffd38a',.85);ctx.globalCompositeOperation='source-over';
  for(let i=0;i<4;i++){const phase=(clock*.6+i*.25+t.seed)%1,q=project(new V(t.x+Math.sin(clock*2+i)*.11,.3+phase*1.5,t.z));ctx.fillStyle='#ffd08e';ctx.globalAlpha=(1-phase)*.75;ctx.beginPath();ctx.ellipse(q.x,q.y,scale*.045,scale*.13*(1-phase),Math.sin(clock+i)*.3,0,TAU);ctx.fill();}ctx.globalAlpha=1;
 }
 for(let i=0;i<34;i++){
  const x=Math.sin(i*124.7)*18+Math.sin(clock*.07+i)*2,z=Math.cos(i*48.3)*18,y=1+(Math.sin(clock*.16+i)*.5+.5)*3.5,p=project(new V(x,y,z));
  ctx.fillStyle=i%3?'#c7d4b9':'#e6d19a';ctx.globalAlpha=(.18+.16*Math.sin(clock+i))*(i%3?.55:1);ctx.beginPath();ctx.arc(p.x,p.y,i%3?.75:1.3,0,TAU);ctx.fill();
 }ctx.globalAlpha=1;
 if(hero&&!hero.dead){groundPath(hero.pos,.85);ctx.strokeStyle='#e9d59c';ctx.lineWidth=1;ctx.globalAlpha=.45;ctx.stroke();ctx.globalAlpha=1;}
 for(const r of rings){
  const f=1-r.life/r.max;groundPath(r.pos,r.radius*(r.warn?1:.2+.8*f));ctx.strokeStyle=r.color;ctx.lineWidth=r.warn?1.5:3*(1-f)+1;ctx.globalAlpha=r.warn?.2+f*.55:(1-f)*.8;ctx.stroke();
  if(r.warn){ctx.fillStyle=r.color;ctx.globalAlpha=.04+f*.09;ctx.fill();}ctx.globalAlpha=1;
 }
 ctx.globalCompositeOperation='screen';
 for(const a of arcs){
  const f=1-a.life/a.max,start=a.angle-a.sweep*.6+f*.8;groundPath(a.pos,a.radius*(.88+f*.17),start,start+a.sweep);ctx.strokeStyle=a.color;ctx.lineWidth=Math.max(1,scale*.15*(1-f));ctx.globalAlpha=(1-f)*.86;ctx.shadowColor=a.color;ctx.shadowBlur=14;ctx.stroke();groundPath(a.pos,a.radius*.85,start+.3,start+a.sweep);ctx.lineWidth=Math.max(1,scale*.045);ctx.globalAlpha=(1-f)*.75;ctx.stroke();
 }ctx.shadowBlur=0;ctx.globalAlpha=1;
 for(const p of projectiles){
  const pt=project(p.pos);glow(pt.x,pt.y,20,'#b271ee',.75);ctx.fillStyle='#e4bcff';ctx.beginPath();ctx.arc(pt.x,pt.y,3.5,0,TAU);ctx.fill();const tail=project(p.pos.clone().addScaledVector(p.vel,-.16));ctx.beginPath();ctx.moveTo(tail.x,tail.y);ctx.lineTo(pt.x,pt.y);ctx.strokeStyle='#b871eb';ctx.lineWidth=2;ctx.stroke();
 }
 for(const p of particles){const pt=project(p.pos);ctx.globalAlpha=Math.min(1,p.life/p.max);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(pt.x,pt.y,p.size,0,TAU);ctx.fill();}
 ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
 if(game.phase!=='title')for(const a of actors){
  if(a.dead||a.kind==='hero'||a.boss||a.spawn>0)continue;const p=project(a.pos.clone().add(new V(0,a.height+.28,0))),width=Math.max(24,scale*.95);
  ctx.fillStyle='#081b17b0';ctx.fillRect(p.x-width/2-1,p.y-1,width+2,5);ctx.fillStyle=a.kind==='mage'?'#b88aa4':'#b87169';ctx.fillRect(p.x-width/2,p.y,width*a.hp/a.maxHp,3);
 }
 for(const n of numbers){
  const p=project(n.pos),f=1-n.life/n.max;ctx.globalAlpha=Math.min(1,n.life*2.8);ctx.font=`${n.critical?'bold ':''}${n.critical?21:15}px Georgia`;ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#10241bcc';ctx.strokeText(n.text,p.x+n.drift*f,p.y-f*43);ctx.fillStyle=n.color;ctx.fillText(n.text,p.x+n.drift*f,p.y-f*43);
 }ctx.globalAlpha=1;
 const mist=ctx.createLinearGradient(0,H*.18,0,H*.9);mist.addColorStop(0,'#739d970b');mist.addColorStop(.5,'transparent');mist.addColorStop(1,'#2c726807');ctx.fillStyle=mist;ctx.fillRect(0,0,W,H);
}
