const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
const wrapStep=value=>((Math.round(Number(value)||0)%8)+8)%8;

export const SNAP_CAMERA_STEP=Math.PI/4;

export function snapCameraYaw(index=0){return wrapStep(index)*SNAP_CAMERA_STEP;}

export function rotateCameraOffset(offset,yaw=0,zoom=1){
  const x=Number(offset?.x)||0,y=Number(offset?.y)||0,z=Number(offset?.z)||0,c=Math.cos(Number(yaw)||0),s=Math.sin(Number(yaw)||0),scale=Number.isFinite(Number(zoom))?Number(zoom):1;
  return{x:(x*c-z*s)*scale,y:y*scale,z:(x*s+z*c)*scale};
}


// Keep the horizontal orbit and distance under the existing zoom controls while
// bringing the camera closer to eye level as the user zooms in.
export function tiltCameraOffsetForZoom(offset,zoom=1){
  const x=Number(offset?.x)||0,y=Number(offset?.y)||0,z=Number(offset?.z)||0;
  const horizontal=Math.hypot(x,z);
  if(horizontal<.001)return{x,y,z};
  const scale=Number.isFinite(Number(zoom))?Number(zoom):1;
  const pitch=Math.max(Math.PI/12,Math.min(Math.PI*5/18,Math.atan2(y,horizontal)+(scale-1)*.65));
  return{x,y:horizontal*Math.tan(pitch),z};
}

export function zoomFromVerticalSwipe(startZoom,deltaY,{min=.58,max=1.65,sensitivity=.006}={}){
  return clamp((Number(startZoom)||1)+(Number(deltaY)||0)*sensitivity,min,max);
}

export function createSnapCameraControl({document:doc,container,initialIndex=0,initialZoom=1,minZoom=.58,maxZoom=1.65,onChange=()=>{},ariaLabel='視点操作'}={}){
  if(!doc)throw new TypeError('document is required');
  const root=doc.createElement('button');root.type='button';root.className='snap-camera-control';root.setAttribute('aria-label',ariaLabel);root.dataset.enabled='true';
  root.innerHTML='<svg viewBox="0 0 52 52" aria-hidden="true"><path class="snap-camera-control__ring" d="M15.4 12.7A18 18 0 0 1 36.6 12.7M39.3 15.4A18 18 0 0 1 39.3 36.6M36.6 39.3A18 18 0 0 1 15.4 39.3M12.7 36.6A18 18 0 0 1 12.7 15.4"/><path class="snap-camera-control__arrow snap-camera-control__arrow--up" d="M26 3.8 21.8 10h8.4Z"/><path class="snap-camera-control__arrow snap-camera-control__arrow--right" d="M48.2 26 42 21.8v8.4Z"/><path class="snap-camera-control__arrow snap-camera-control__arrow--down" d="M26 48.2 30.2 42h-8.4Z"/><path class="snap-camera-control__arrow snap-camera-control__arrow--left" d="M3.8 26 10 30.2v-8.4Z"/><path class="snap-camera-control__eye" d="M12.2 26c3.8-5.6 8.4-8.4 13.8-8.4S36 20.4 39.8 26c-3.8 5.6-8.4 8.4-13.8 8.4S16 31.6 12.2 26Z"/><circle class="snap-camera-control__iris" cx="26" cy="26" r="6.2"/><circle class="snap-camera-control__pupil" cx="26" cy="26" r="2.6"/><circle class="snap-camera-control__shine" cx="23.9" cy="23.7" r="1.25"/></svg>';
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
