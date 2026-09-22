const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
const wrapStep=value=>((Math.round(Number(value)||0)%8)+8)%8;

export const SNAP_CAMERA_STEP=Math.PI/4;

export function snapCameraYaw(index=0){return wrapStep(index)*SNAP_CAMERA_STEP;}

export function rotateCameraOffset(offset,yaw=0,zoom=1){
  const x=Number(offset?.x)||0,y=Number(offset?.y)||0,z=Number(offset?.z)||0,c=Math.cos(Number(yaw)||0),s=Math.sin(Number(yaw)||0),scale=Number.isFinite(Number(zoom))?Number(zoom):1;
  return{x:(x*c-z*s)*scale,y:y*scale,z:(x*s+z*c)*scale};
}

export function zoomFromVerticalSwipe(startZoom,deltaY,{min=.58,max=1.65,sensitivity=.006}={}){
  return clamp((Number(startZoom)||1)+(Number(deltaY)||0)*sensitivity,min,max);
}

export function createSnapCameraControl({document:doc,container,initialIndex=0,initialZoom=1,minZoom=.58,maxZoom=1.65,onChange=()=>{},ariaLabel='カメラ操作'}={}){
  if(!doc)throw new TypeError('document is required');
  const root=doc.createElement('button');root.type='button';root.className='snap-camera-control';root.setAttribute('aria-label',ariaLabel);root.dataset.enabled='true';
  root.innerHTML='<svg viewBox="0 0 64 44" aria-hidden="true"><path class="snap-camera-control__turn-band" d="M4 22c7-8.7 16.3-13 28-13s21 4.3 28 13c-7 8.7-16.3 13-28 13S11 30.7 4 22Z"/><path class="snap-camera-control__turn-arrow" d="M15 14 6.5 22l8.5 8M49 14l8.5 8-8.5 8"/><path class="snap-camera-control__eye" d="M16 22c4.2-6.2 9.5-9.3 16-9.3S43.8 15.8 48 22c-4.2 6.2-9.5 9.3-16 9.3S20.2 28.2 16 22Z"/><circle class="snap-camera-control__iris" cx="32" cy="22" r="6.1"/><circle class="snap-camera-control__pupil" cx="32" cy="22" r="2.5"/><path class="snap-camera-control__zoom-arrow" d="M32 3v6m-3-3 3-3 3 3M32 41v-6m-3 3 3 3 3-3"/></svg>';
  container?.append(root);
  let index=wrapStep(initialIndex),zoom=clamp(initialZoom,minZoom,maxZoom),enabled=true,pointerId=null,startX=0,startY=0,startZoom=zoom,axis='';
  const snapshot=()=>Object.freeze({index,yaw:snapCameraYaw(index),zoom});
  const emit=()=>{const state=snapshot();root.dataset.step=String(index);root.dataset.zoom=zoom.toFixed(3);onChange(state);return state;};
  const setIndex=value=>{index=wrapStep(value);return emit();};
  const setZoom=value=>{zoom=clamp(value,minZoom,maxZoom);return emit();};
  const stop=event=>{event.preventDefault();event.stopPropagation();};
  const down=event=>{if(!enabled||pointerId!==null)return;stop(event);pointerId=event.pointerId;startX=event.clientX;startY=event.clientY;startZoom=zoom;axis='';root.classList.add('is-active');root.setPointerCapture?.(pointerId);};
  const move=event=>{if(event.pointerId!==pointerId)return;stop(event);const dx=event.clientX-startX,dy=event.clientY-startY;if(!axis&&Math.max(Math.abs(dx),Math.abs(dy))>=7)axis=Math.abs(dx)>Math.abs(dy)?'x':'y';if(axis==='y')setZoom(zoomFromVerticalSwipe(startZoom,dy,{min:minZoom,max:maxZoom}));};
  const finish=event=>{if(event.pointerId!==pointerId)return;stop(event);const dx=event.clientX-startX,dy=event.clientY-startY;if((axis==='x'||(!axis&&Math.abs(dx)>Math.abs(dy)))&&Math.abs(dx)>=14)index=wrapStep(index+(dx>0?-1:1));pointerId=null;axis='';root.classList.remove('is-active');emit();};
  root.addEventListener('pointerdown',down,{passive:false});root.addEventListener('pointermove',move,{passive:false});root.addEventListener('pointerup',finish,{passive:false});root.addEventListener('pointercancel',finish,{passive:false});
  emit();
  return Object.freeze({
    element:root,snapshot,setIndex,setZoom,
    rotate(direction=1){return setIndex(index+(Number(direction)>=0?1:-1));},
    setEnabled(value){enabled=Boolean(value);root.dataset.enabled=String(enabled);root.disabled=!enabled;return enabled;},
    dispose(){root.removeEventListener('pointerdown',down);root.removeEventListener('pointermove',move);root.removeEventListener('pointerup',finish);root.removeEventListener('pointercancel',finish);root.remove();}
  });
}
