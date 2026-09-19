import * as THREE from 'three';
const GOLD='#ffe1a0',CYAN='#87e9ff',ROSE='#ff71b3';
export class Effects {
  constructor(canvas,world){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:true});this.world=world;this.items=[];this.particles=[];this.numbers=[];this.time=0;this.vector=new THREE.Vector3();this.resize();}
  resize(){this.w=innerWidth;this.h=innerHeight;this.dpr=Math.min(devicePixelRatio||1,1.5);this.canvas.width=this.w*this.dpr;this.canvas.height=this.h*this.dpr;this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);}
  project(x,y,z){this.vector.set(x,y,z).project(this.world.camera);return{x:(this.vector.x+1)*this.w/2,y:(1-this.vector.y)*this.h/2};}
  add(type,pos,options={}){this.items.push({type,x:pos.x,y:pos.y??.13,z:pos.z,age:0,life:.7,color:GOLD,...options});}
  ring(pos,radius=4,color=GOLD){this.add('ring',pos,{radius,color,life:.7});}
  slash(pos,heading,radius=2.5,color=GOLD,spin=false){this.add('slash',pos,{heading,radius,color,spin,life:spin?.7:.38,y:1});this.burst(pos,color,spin?26:9,spin?5:2);}
  burst(pos,color=GOLD,count=15,power=3){for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=(.3+Math.random())*power;this.particles.push({x:pos.x,y:Math.max(.5,pos.y||0)+Math.random()*.8,z:pos.z,vx:Math.cos(a)*s,vz:Math.sin(a)*s,vy:2+Math.random()*4,age:0,life:.35+Math.random()*.5,color,size:1+Math.random()*2.5});}if(this.particles.length>400)this.particles.splice(0,this.particles.length-400);}
  damage(pos,amount,critical=false,hero=false){this.numbers.push({x:pos.x+(Math.random()-.5)*.4,y:2+(pos.y||0),z:pos.z,age:0,life:critical?1.1:.8,text:critical?`${Math.round(amount)}!`:String(Math.round(amount)),critical,hero});if(this.numbers.length>45)this.numbers.shift();}
  heal(pos,amount){this.numbers.push({x:pos.x,y:2,z:pos.z,age:0,life:1.2,text:`+${Math.round(amount)}`,heal:true});this.ring(pos,2.4,'#a5efc8');}
  beam(a,b,color=ROSE){this.add('beam',a,{to:{x:b.x,y:.5,z:b.z},color,life:.4,y:1.25});this.burst(b,color,14,3);}
  nova(pos){this.add('column',pos,{color:'#ffe4c0',life:.95});this.ring(pos,7,ROSE);this.ring(pos,5.8,GOLD);this.burst({...pos,y:1},GOLD,65,8);}
  update(dt){this.time+=dt;for(const list of[this.items,this.numbers])for(let i=list.length-1;i>=0;i--){list[i].age+=dt;if(list[i].age>=list[i].life)list.splice(i,1);}for(let i=this.particles.length-1;i>=0;i--){const p=this.particles[i];p.age+=dt;p.x+=p.vx*dt;p.z+=p.vz*dt;p.y+=p.vy*dt;p.vy-=12*dt;if(p.age>p.life||p.y<0)this.particles.splice(i,1);}}
  circle(x,z,r,y=0,start=0,end=Math.PI*2){const ctx=this.ctx;ctx.beginPath();const steps=48;for(let i=0;i<=steps;i++){const a=start+(end-start)*i/steps,p=this.project(x+Math.sin(a)*r,y,z+Math.cos(a)*r);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);} }
  render(hero,enemies=[],telegraphs=[]){
    const c=this.ctx;c.clearRect(0,0,this.w,this.h);c.lineCap='round';c.lineJoin='round';c.save();c.globalCompositeOperation='screen';
    // Projected Canvas2D motes and glows are effects, not generated scene/model geometry.
    for(const p of this.world.firePositions){const s=this.project(p.x,p.y,p.z),r=30+Math.sin(this.time*7+p.x)*3,g=c.createRadialGradient(s.x,s.y,0,s.x,s.y,r);g.addColorStop(0,'#ffcf8655');g.addColorStop(1,'#ffad4900');c.fillStyle=g;c.fillRect(s.x-r,s.y-r,r*2,r*2);}
    for(let i=0;i<35;i++){const x=Math.sin(i*135.2)*16,z=Math.cos(i*21.7)*13,y=(i*.37+this.time*.15)%5,s=this.project(x,y,z);c.fillStyle=i%4?'#f0d49f':'#9cdef1';c.globalAlpha=.13+Math.sin(i+this.time)*.09;c.fillRect(s.x,s.y,1.3,1.3);}
    c.globalAlpha=1;
    if(hero?.alive){this.circle(hero.position.x,hero.position.z,.77,.14);c.strokeStyle='#ebd8ab88';c.lineWidth=1.2;c.stroke();}
    for(const t of telegraphs){
      const a=Math.min(1,t.age/t.duration);c.globalAlpha=.35+a*.45;c.strokeStyle=t.boss?GOLD:ROSE;c.fillStyle=t.boss?'#e8b46a12':'#fb45871c';c.lineWidth=1.8;
      this.circle(t.x,t.z,t.radius,.16);c.fill();c.stroke();this.circle(t.x,t.z,t.radius*a,.17);c.lineWidth=1;c.stroke();
      const center=this.project(t.x,.18,t.z);c.beginPath();c.moveTo(center.x-4,center.y);c.lineTo(center.x+4,center.y);c.moveTo(center.x,center.y-4);c.lineTo(center.x,center.y+4);c.stroke();
    }
    for(const e of this.items){
      const p=e.age/e.life,fade=Math.pow(1-p,1.4);c.globalAlpha=fade;c.strokeStyle=e.color;c.shadowColor=e.color;c.shadowBlur=15;
      if(e.type==='ring'){
        const r=e.radius*(.15+.85*(1-Math.pow(1-p,3)));this.circle(e.x,e.z,r,.17);c.lineWidth=4*(1-p)+.5;c.stroke();c.shadowBlur=0;this.circle(e.x,e.z,r*.9,.2);c.lineWidth=1;c.stroke();
        if(e.color===CYAN)for(let j=0;j<12;j++){const a=j/12*Math.PI*2,q=this.project(e.x+Math.sin(a)*r,.2,e.z+Math.cos(a)*r),top=this.project(e.x+Math.sin(a)*r,(1-p)*1.5,e.z+Math.cos(a)*r);c.beginPath();c.moveTo(q.x,q.y);c.lineTo(top.x,top.y);c.stroke();}
      } else if(e.type==='slash'){
        const sweep=e.spin?Math.PI*2:Math.PI*1.35,start=e.heading-sweep*.65+p*.8,end=start+sweep*Math.min(1,p*7+.2);
        for(let j=0;j<4;j++){this.circle(e.x,e.z,e.radius-j*.12,e.y+j*.09,start,end);c.lineWidth=(4-j)*1.4;c.globalAlpha=fade*(1-j*.19);c.stroke();}
        c.strokeStyle='#fff9e1';this.circle(e.x,e.z,e.radius-.12,e.y+.08,start+.2,end);c.lineWidth=1.7;c.stroke();
      } else if(e.type==='beam'){
        const a=this.project(e.x,e.y,e.z),b=this.project(e.to.x,e.to.y,e.to.z);c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.lineWidth=11*(1-p);c.stroke();c.strokeStyle='#fff2fa';c.lineWidth=3*(1-p);c.stroke();
      } else if(e.type==='column'){
        const b=this.project(e.x,0,e.z),top=this.project(e.x,16,e.z),w=35*(1-p)+3,g=c.createLinearGradient(b.x,b.y,top.x,top.y);g.addColorStop(0,'#fff5dc');g.addColorStop(1,'#ffecd000');c.strokeStyle=g;c.lineWidth=w;c.beginPath();c.moveTo(b.x,b.y);c.lineTo(top.x,top.y);c.stroke();c.shadowBlur=0;
      }
    }
    c.shadowBlur=0;
    for(const p of this.particles){const s=this.project(p.x,p.y,p.z),b=this.project(p.x-p.vx*.023,p.y-p.vy*.025,p.z-p.vz*.023);c.globalAlpha=1-p.age/p.life;c.strokeStyle=p.color;c.lineWidth=p.size;c.beginPath();c.moveTo(b.x,b.y);c.lineTo(s.x,s.y);c.stroke();}
    c.restore();
    for(const a of enemies){if(!a.alive||a.hp>=a.maxHp||a.isBoss)continue;const p=this.project(a.position.x,2.6*a.scale,a.position.z);c.globalAlpha=.8;c.fillStyle='#152127';c.fillRect(p.x-15,p.y,30,3);c.fillStyle=a.isMage?'#c274ac':'#bb8b71';c.fillRect(p.x-15,p.y,30*Math.max(0,a.hp/a.maxHp),2);}
    c.globalAlpha=1;
    for(const n of this.numbers){const p=this.project(n.x,n.y+n.age*1.9,n.z);c.globalAlpha=Math.min(1,(1-n.age/n.life)*2);c.font=`${n.critical?'bold ':''}${n.critical?25:n.hero?18:16}px Georgia,serif`;c.textAlign='center';c.lineWidth=3;c.strokeStyle='#122025';c.fillStyle=n.heal?'#a8f4d1':n.hero?'#ff867c':n.critical?'#ffe7af':'#f0e8d8';c.strokeText(n.text,p.x,p.y);c.fillText(n.text,p.x,p.y);}
    c.globalAlpha=1;
  }
  clear(){this.items.length=this.particles.length=this.numbers.length=0;}
}
