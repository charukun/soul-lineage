// Match 百年転生's swipe thresholds in the review input adapter.
const DEADZONE=6,DRAG_RANGE=40,FLICK_MS=420,FLICK_DISTANCE=30,FLICK_SPEED=.32;
class SwipeInput{
  constructor(){this.cancel();}
  down(id,x,y,t){if(this.id!==null)return false;this.cancel();this.id=id;this.x=x;this.y=y;this.started=t;this.samples=[{x,y,t}];return true;}
  move(id,x,y,t){if(id!==this.id)return false;this.dx=x-this.x;this.dy=y-this.y;this.amount=Math.min(1,Math.max(0,(Math.hypot(this.dx,this.dy)-DEADZONE)/DRAG_RANGE));this.samples.push({x,y,t});while(this.samples.length>2&&this.samples[1].t<t-130)this.samples.shift();return true;}
  up(id,x,y,t){if(id!==this.id)return false;const dx=x-this.x,dy=y-this.y,d=Math.hypot(dx,dy),elapsed=t-this.started,recent=this.samples.find(p=>p.t>=t-130)||this.samples.at(-1),rx=x-recent.x,ry=y-recent.y,rd=Math.hypot(rx,ry),velocity=rd/Math.max(12,t-recent.t);const terminal=rd>=16&&velocity>=.22,quick=elapsed<=FLICK_MS&&d>=FLICK_DISTANCE&&d/Math.max(24,elapsed)>=FLICK_SPEED&&rd>=8&&velocity>=.165,flick=terminal||quick,aimX=terminal?rx:dx,aimY=terminal?ry:dy,aimD=terminal?rd:d;this.cancel();if(flick&&aimD>0){this.dash=true;this.dashX=aimX/aimD;this.dashY=aimY/aimD;}return flick;}
  cancel(){this.id=null;this.dx=this.dy=this.amount=0;this.dash=false;this.samples=[];}
  vector(){const x=this.dash?this.dashX:this.dx/(Math.hypot(this.dx,this.dy)||1),y=this.dash?this.dashY:this.dy/(Math.hypot(this.dx,this.dy)||1);return{screenX:x,screenY:y,amount:this.dash?1:this.amount};}
}


export function battle2ScreenVector(axis,camera){
  const position=camera?.camera?.position,look=camera?.camera?.lookTarget;
  let fx=Number(look?.x)-Number(position?.x),fz=Number(look?.z)-Number(position?.z);
  if(!Number.isFinite(fx)||!Number.isFinite(fz)||Math.hypot(fx,fz)<.001){fx=-Math.sin(.65);fz=-Math.cos(.65);}
  const length=Math.hypot(fx,fz),forward={x:fx/length,z:fz/length};
  const x=-forward.z*axis.x-forward.x*axis.y,z=forward.x*axis.x-forward.z*axis.y;
  const magnitude=Math.hypot(x,z),amount=Math.min(1,Math.max(0,Number(axis.amount)||0));
  return magnitude>.001?{x:x/magnitude*amount,z:z/magnitude*amount,dash:Boolean(axis.dash)}:null;
}

export function createBattle2MovementInput({canvas,camera,win=window,clock=()=>performance.now()}={}){
  if(!canvas)throw new TypeError('battle canvas is required');
  const swipe=new SwipeInput(),keys=new Set();
  let tapUntil=0,dashUntil=0;
  const moveKeys=new Set(['ArrowRight','ArrowLeft','ArrowUp','ArrowDown','KeyW','KeyA','KeyS','KeyD']);
  function down(event){
    if(event.pointerType==='mouse'&&event.button!==0)return;
    if(!swipe.down(event.pointerId,event.clientX,event.clientY,clock()))return;
    canvas.setPointerCapture?.(event.pointerId);event.preventDefault();
  }
  function move(event){if(swipe.move(event.pointerId,event.clientX,event.clientY,clock()))event.preventDefault();}
  function up(event){
    if(event.pointerId!==swipe.id)return;
    const now=clock(),distance=Math.hypot(event.clientX-swipe.x,event.clientY-swipe.y),duration=now-swipe.started;
    if(event.type==='pointercancel')swipe.cancel();
    else if(swipe.up(event.pointerId,event.clientX,event.clientY,now))dashUntil=now+180;
    else if(distance<6&&duration<420)tapUntil=now+140;
    if(canvas.hasPointerCapture?.(event.pointerId))canvas.releasePointerCapture(event.pointerId);
    event.preventDefault();
  }
  const textEntry=target=>Boolean(target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])'));
  function keydown(event){if(event.isComposing||textEntry(event.target)||!moveKeys.has(event.code))return;keys.add(event.code);event.preventDefault();}
  function keyup(event){if(keys.delete(event.code))event.preventDefault();}
  function blur(){reset();}
  function reset(){swipe.cancel();keys.clear();tapUntil=0;dashUntil=0;}
  canvas.addEventListener('pointerdown',down,{passive:false});canvas.addEventListener('pointermove',move,{passive:false});
  canvas.addEventListener('pointerup',up,{passive:false});canvas.addEventListener('pointercancel',up,{passive:false});
  win.addEventListener('keydown',keydown);win.addEventListener('keyup',keyup);win.addEventListener('blur',blur);
  return Object.freeze({
    vector(){
      let axis=null;
      if(keys.size)axis={x:Number(keys.has('ArrowRight')||keys.has('KeyD'))-Number(keys.has('ArrowLeft')||keys.has('KeyA')),y:Number(keys.has('ArrowDown')||keys.has('KeyS'))-Number(keys.has('ArrowUp')||keys.has('KeyW')),amount:1,dash:false};
      else if(swipe.id!==null){const v=swipe.vector();axis={x:v.screenX,y:v.screenY,amount:v.amount,dash:false};}
      else if(swipe.dash&&clock()<dashUntil){const v=swipe.vector();axis={x:v.screenX,y:v.screenY,amount:1,dash:true};}
      else if(clock()<tapUntil)axis={x:0,y:-1,amount:1,dash:false};
      else swipe.cancel();
      return axis?battle2ScreenVector(axis,camera?.()):null;
    },
    reset,
    dispose(){reset();canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);win.removeEventListener('keydown',keydown);win.removeEventListener('keyup',keyup);win.removeEventListener('blur',blur);}
  });
}
