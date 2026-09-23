import {SWIPE_RULES,SwipeInput} from '@soul/input';

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
    else if(distance<SWIPE_RULES.deadzone&&duration<SWIPE_RULES.flickMs)tapUntil=now+140;
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
