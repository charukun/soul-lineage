import {Vector3} from 'three';
// Screen-space light, particles and projected marks. No 3D model geometry is generated.
export class Effects {
  constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.items=[];this.vector=new Vector3();this.w=1;this.h=1;this.shake=0;}
  resize(w,h){this.w=w;this.h=h;const d=Math.min(devicePixelRatio||1,1.5);this.canvas.width=Math.round(w*d);this.canvas.height=Math.round(h*d);this.ctx.setTransform(d,0,0,d,0,0);}
  project(x,y,z){this.vector.set(x,y,z).project(this.camera);return {x:(this.vector.x*.5+.5)*this.w,y:(-.5*this.vector.y+.5)*this.h};}
  add(type,data,life){this.items.push({type,age:0,life,...data});if(this.items.length>260)this.items.splice(0,this.items.length-260);}
  event(e){
    if(e.type==='hit'){
      const u=e.unit,hero=u.team==='hero',color=hero?'#f2a68d':e.critical?'#ffe4a3':'#dfebd8';
      this.add('number',{x:u.x,z:u.z,y:u.height+ .3,value:e.value,color,critical:e.critical},.85);
      this.add('slash',{x:u.x,y:u.height*.65,z:u.z,color:hero?'#eaa482':e.source.kind==='anne'?'#aafcf0':'#ffe5a1',angle:Math.atan2(u.z-e.source.z,u.x-e.source.x)},.24);
      for(let i=0;i<7;i++)this.add('spark',{x:u.x,y:u.height*.65,z:u.z,vx:(Math.random()-.5)*6,vy:1+Math.random()*4,vz:(Math.random()-.5)*6,color},.28+Math.random()*.4);
      if(e.critical)this.shake=.055;
    }
    if(e.type==='heal')this.add('number',{x:e.unit.x,z:e.unit.z,y:e.unit.height+.4,value:'+'+e.value,color:'#a5e8be'},1.1);
    if(e.type==='attack'&&e.ranged)this.add('bolt',{from:{x:e.unit.x,y:1.4,z:e.unit.z},to:{x:e.target.x,y:1.4,z:e.target.z},color:'#b8e0f4'},.42);
    if(e.type==='song')this.add('bolt',{from:{x:e.unit.x,y:1.6,z:e.unit.z},to:{x:e.target.x,y:1.5,z:e.target.z},color:'#aae7c2'},.9);
    if(e.type==='nova'){this.add('nova',e,.65);this.shake=.1;}
    if(e.type==='telegraph')this.add('telegraph',e,e.life);
    if(e.type==='guard')this.add('guard',{unit:e.unit},1.3);
    if(e.type==='rally')this.add('rally',e,2.2);
    if(e.type==='death'&&e.unit.team==='enemy'){for(let i=0;i<12;i++)this.add('spark',{x:e.unit.x,y:.8,z:e.unit.z,vx:(Math.random()-.5)*3,vy:1+Math.random()*3,vz:(Math.random()-.5)*3,color:'#d5c78c'},.8+Math.random()*.6);}
  }
  ring(x,z,y,r,color,alpha,line=1,fill=false){const c=this.ctx;c.beginPath();for(let i=0;i<=48;i++){const a=i/48*Math.PI*2,p=this.project(x+Math.cos(a)*r,y,z+Math.sin(a)*r);if(i===0)c.moveTo(p.x,p.y);else c.lineTo(p.x,p.y);}c.closePath();c.globalAlpha=alpha;c.strokeStyle=color;c.lineWidth=line;c.stroke();if(fill){c.globalAlpha=alpha*.13;c.fillStyle=color;c.fill();}c.globalAlpha=1;}
  glow(x,y,r,color,opacity=1){if(r<=0)return;const c=this.ctx,g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');c.globalAlpha=opacity;c.fillStyle=g;c.fillRect(x-r,y-r,2*r,2*r);c.globalAlpha=1;}
  render(camera,units,t,dt,flames,playing){
    this.camera=camera;this.shake=Math.max(0,this.shake-dt*1.2);const c=this.ctx;c.clearRect(0,0,this.w,this.h);
    // Quiet airborne embers bind the static environment to the combat lighting.
    c.globalCompositeOperation='lighter';
    for(let i=0;i<33;i++){const x=Math.sin(i*17.13)*12,z=Math.cos(i*9.7)*12,y=((t*.21+i*.43)%4)+.3,p=this.project(x+Math.sin(t*.2+i)*.5,y,z);const alpha=.15+Math.max(0,Math.sin(t*.6+i*3))*.38;c.globalAlpha=alpha;c.fillStyle=i%3?'#d8b57a':'#8accc8';c.fillRect(p.x,p.y,1.8,1.8);}
    c.globalAlpha=1;
    for(const f of flames){const p=this.project(f.x,f.y,f.z),scale=(this.w<600?13:21)*f.scale,sway=Math.sin(t*8+f.x)*3;this.glow(p.x,p.y,scale*2.8,'#e2a35a',.18);c.beginPath();c.moveTo(p.x-scale*.25,p.y);c.bezierCurveTo(p.x-scale*.4,p.y-scale*.6,p.x+sway,p.y-scale*.7,p.x+sway*.6,p.y-scale*1.6);c.bezierCurveTo(p.x+scale*.65,p.y-scale*.4,p.x+scale*.4,p.y+3,p.x-scale*.25,p.y);c.fillStyle='#ffc881';c.globalAlpha=.65;c.fill();c.globalAlpha=1;this.glow(p.x,p.y-scale*.2,scale*.35,'#fff0b4',.9);}
    if(playing)for(const u of units){if(u.dead)continue;if(u.team==='hero')this.ring(u.x,u.z,.04,.7,u.color,.43,1.15);}
    for(const f of this.items){
      f.age+=dt;const q=Math.min(1,f.age/f.life),fade=1-q;
      if(f.type==='number'){
        c.globalCompositeOperation='source-over';const p=this.project(f.x,f.y+q*.95,f.z);c.globalAlpha=Math.min(1,fade*3);c.font=(f.critical?'bold 23px':'bold 15px')+' Georgia';c.textAlign='center';c.strokeStyle='#071719';c.lineWidth=3.5;c.strokeText(f.value,p.x,p.y);c.fillStyle=f.color;c.fillText(f.value,p.x,p.y);c.globalAlpha=1;c.globalCompositeOperation='lighter';
      }else if(f.type==='spark'){
        const p=this.project(f.x+f.vx*f.age,f.y+f.vy*f.age-f.age*f.age*3,f.z+f.vz*f.age);c.globalAlpha=fade;c.fillStyle=f.color;c.fillRect(p.x,p.y,2.2*fade+1,2.2*fade+1);c.globalAlpha=1;
      }else if(f.type==='slash'){
        const p=this.project(f.x,f.y,f.z),r=(this.w<600?20:30)*(1+q*.65);c.save();c.translate(p.x,p.y);c.rotate(f.angle);c.scale(1,.48);c.globalAlpha=fade;c.beginPath();c.arc(0,0,r,-2.4+q,1.1+q);c.strokeStyle=f.color;c.lineWidth=7*fade;c.shadowColor=f.color;c.shadowBlur=14;c.stroke();c.beginPath();c.arc(0,-2,r-3,-1.8+q,.7+q);c.strokeStyle='#ffffff';c.lineWidth=2*fade;c.stroke();c.restore();
      }else if(f.type==='bolt'){
        const p=this.project(f.from.x+(f.to.x-f.from.x)*q,f.from.y+(f.to.y-f.from.y)*q+Math.sin(q*Math.PI)*.5,f.from.z+(f.to.z-f.from.z)*q);this.glow(p.x,p.y,16,f.color,.45);c.fillStyle='#efffff';c.beginPath();c.arc(p.x,p.y,3,0,Math.PI*2);c.fill();const last=this.project(f.from.x+(f.to.x-f.from.x)*Math.max(0,q-.15),f.from.y+(f.to.y-f.from.y)*q+Math.sin(q*Math.PI)*.5,f.from.z+(f.to.z-f.from.z)*Math.max(0,q-.15));c.beginPath();c.moveTo(last.x,last.y);c.lineTo(p.x,p.y);c.strokeStyle=f.color;c.lineWidth=2;c.stroke();
      }else if(f.type==='nova'){
        this.ring(f.x,f.z,.12,f.radius*(.3+q*.7),f.color,fade,5*fade+1,true);this.ring(f.x,f.z,.16,f.radius*(.18+q*.7),f.color,fade*.65,1.5);
      }else if(f.type==='telegraph'){
        this.ring(f.x,f.z,.08,f.radius,'#fa8b70',.5+q*.4,2,true);this.ring(f.x,f.z,.1,f.radius*q,'#ffd3a3',.7,1.6);
      }else if(f.type==='guard'){
        this.ring(f.unit.x,f.unit.z,.1,1.05,'#edd7a5',fade*.65,2);const p=this.project(f.unit.x,1,f.unit.z);this.glow(p.x,p.y,38,'#e8c383',fade*.12);
      }else if(f.type==='rally'){
        this.ring(f.x,f.z,.08,.45+Math.sin(q*10)*.12,'#c5f4df',fade,.8);this.ring(f.x,f.z,.08,.9,'#c5f4df',fade*.35,.8);
      }
    }
    this.items=this.items.filter(f=>f.age<f.life);c.globalAlpha=1;c.globalCompositeOperation='source-over';
    if(playing)for(const u of units){if(u.dead||u.kind==='boss'||(u.team==='enemy'&&u.hp===u.maxHp))continue;const p=this.project(u.x,u.height+.26,u.z),w=u.team==='hero'?31:22;c.fillStyle='#041719ab';c.fillRect(p.x-w/2-1,p.y-1,w+2,4);c.fillStyle=u.team==='hero'?u.color:'#c77d62';c.fillRect(p.x-w/2,p.y,w*Math.max(0,u.hp/u.maxHp),2);}
  }
}
