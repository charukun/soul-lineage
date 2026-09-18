/** The scene's only gesture owner. Releasing a pointer never commits placement. */
export function installSceneInput(canvas, {view, ui, tap, activity = () => {},
  raf = requestAnimationFrame, caf = cancelAnimationFrame, now = () => performance.now()}) {
  const pointers = new Map();
  const abort = new AbortController();
  let gesture = null, coast = 0, vx = 0, vy = 0, lastCoast = 0;
  const on = (type, fn, options = {}) => canvas.addEventListener(type, fn, {...options, signal: abort.signal});
  const stop = () => {if (coast) caf(coast); coast = 0; vx = vy = 0;};
  const pair = () => {
    const [a, b] = [...pointers.values()];
    return {distance: Math.max(1, Math.hypot(a.x-b.x,a.y-b.y)), angle: Math.atan2(b.y-a.y,b.x-a.x), x:(a.x+b.x)/2,y:(a.y+b.y)/2};
  };
  const coasting = time => {
    if (ui.pending || ui.drawer || ui.entryOpen || ui.dialogPage) {stop(); return;}
    const dt = Math.min(32, time-lastCoast);lastCoast=time;
    vx *= Math.pow(.94,dt/16);vy *= Math.pow(.94,dt/16);
    if (Math.hypot(vx,vy)<.018) {stop();return;}
    view.pan(vx*dt,vy*dt);activity();coast=raf(coasting);
  };
  on('pointerdown', e => {
    if (e.button !== undefined && e.button !== 0) return;
    stop();activity();view.lastInteraction=now();
    canvas.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,time:now(),drag:false,multi:false});
    view.interacting=true;
    if (pointers.size>=2) {for (const p of pointers.values()) p.multi=true;gesture=pair();}
  });
  on('pointermove', e => {
    const p=pointers.get(e.pointerId);if(!p)return;
    const dx=e.clientX-p.x,dy=e.clientY-p.y,elapsed=Math.max(1,now()-p.time);
    p.x=e.clientX;p.y=e.clientY;p.time=now();
    if(pointers.size>=2){
      const next=pair();
      if(gesture){
        let angle=next.angle-gesture.angle;
        if(angle>Math.PI)angle-=2*Math.PI;if(angle<-Math.PI)angle+=2*Math.PI;
        view.zoom(gesture.distance/next.distance);view.yaw+=angle;
        view.pan(next.x-gesture.x,next.y-gesture.y);view.updateCamera();
      }
      gesture=next;activity();e.preventDefault();return;
    }
    gesture=null;
    if(Math.hypot(p.x-p.sx,p.y-p.sy)>7)p.drag=true;
    if(!p.drag)return;
    // A camera drag does not change the candidate's world/local coordinates.
    view.pan(dx,dy);activity();e.preventDefault();
    vx=vx*.62+dx/elapsed*.38;vy=vy*.62+dy/elapsed*.38;
  },{passive:false});
  const finish = (e, cancelled=false) => {
    const p=pointers.get(e.pointerId);if(!p)return;
    pointers.delete(e.pointerId);
    if(!cancelled&&!p.drag&&!p.multi&&Math.hypot(e.clientX-p.sx,e.clientY-p.sy)<7)tap(e.clientX,e.clientY);
    if(!cancelled&&p.drag&&!p.multi&&!pointers.size&&!ui.pending&&!ui.drawer&&Math.hypot(vx,vy)>.045){lastCoast=now();coast=raf(coasting);}
    else stop();
    if(canvas.hasPointerCapture?.(e.pointerId))canvas.releasePointerCapture(e.pointerId);
    gesture=pointers.size>=2?pair():null;
    view.interacting=!!ui.pending||pointers.size>0;view.lastInteraction=now();activity();
  };
  on('pointerup',e=>finish(e));
  on('pointercancel',e=>finish(e,true));
  on('lostpointercapture',e=>finish(e,true));
  on('wheel',e=>{stop();activity();e.preventDefault();view.zoom(Math.exp(e.deltaY*.001));},{passive:false});
  return {pointers,stop,dispose(){stop();abort.abort();pointers.clear();}};
}

/** Keep long-press catalog dragging, but dropping only chooses a preview. */
export function installCatalogDrag(button, kind, {ui, begin, preview, canvas}) {
  let start=null,timer=null;
  const clear=()=>{clearTimeout(timer);timer=null;};
  button.addEventListener('pointerdown',e=>{
    start={id:e.pointerId,x:e.clientX,y:e.clientY,touch:e.pointerType==='touch'};
    timer=setTimeout(()=>{
      if(!start||!button.isConnected)return;
      ui.drag={...start,kind};ui.lastDrag=performance.now();begin(kind);
    },280);
  });
  button.addEventListener('pointermove',e=>{
    if(!start||ui.drag)return;
    if(Math.hypot(e.clientX-start.x,e.clientY-start.y)>7){clear();if(!start.touch){ui.drag={...start,kind};begin(kind);}}
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>{clear();start=null;});
}

export function installCatalogDrop({ui, view, preview, activity, cancel}, doc=document) {
  const abort=new AbortController();
  doc.addEventListener('pointermove',e=>{
    if(!ui.drag||ui.drag.id!==e.pointerId)return;
    const r=view.canvas.getBoundingClientRect();
    if(e.clientX<r.left||e.clientY<r.top||e.clientX>r.right||e.clientY>r.bottom)return;
    const point=view.ground(e.clientX,e.clientY);if(point)preview(point.x,point.z);
  },{signal:abort.signal});
  doc.addEventListener('pointerup',e=>{
    if(!ui.drag||ui.drag.id!==e.pointerId)return;
    // Use the last rendered candidate, not a new raycast after pointer capture ends.
    ui.lastDrag=performance.now();ui.drag=null;view.lastInteraction=performance.now();activity();
  },{signal:abort.signal});
  doc.addEventListener('pointercancel',()=>{if(ui.drag){ui.drag=null;cancel();}},{signal:abort.signal});
  return()=>abort.abort();
}
