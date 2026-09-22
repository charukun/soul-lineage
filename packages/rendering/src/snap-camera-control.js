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
  root.innerHTML='<svg viewBox="0 0 44 44" aria-hidden="true"><path class="snap-camera-control__eye" d="M5.5 22c4.1-6.4 9.7-9.6 16.5-9.6S34.4 15.6 38.5 22c-4.1 6.4-9.7 9.6-16.5 9.6S9.6 28.4 5.5 22Z"/><circle class="snap-camera-control__iris" cx="22" cy="22" r="6.4"/><circle class="snap-camera-control__pupil" cx="22" cy="22" r="2.6"/><path class="snap-camera-control__ring" d="M11.2 9.8A17 17 0 0 1 32.8 9.8M34.2 11.2l-1.4-5.1 5.1 1.4M32.8 34.2A17 17 0 0 1 11.2 34.2M9.8 32.8l1.4 5.1-5.1-1.4"/><path class="snap-camera-control__zoom" d="M22 4.5v4M20 6.5h4M22 35.5v4M20 37.5h4"/></svg>';
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
