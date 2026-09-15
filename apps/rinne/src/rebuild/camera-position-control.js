const CAMERA_NEAR_OFFSET=[6,4.5,8];
const CAMERA_FAR_OFFSET=[15,18.5,21];

const clamp01=value=>{
  const number=Number(value);
  return Math.min(1,Math.max(0,Number.isFinite(number)?number:.5));
};

export function cameraOffsetForPosition(value){
  const position=clamp01(value);
  return CAMERA_NEAR_OFFSET.map((near,index)=>near+(CAMERA_FAR_OFFSET[index]-near)*position);
}

export function createCameraPositionControl({document:doc,container,onChange,initial=.5}={}){
  if(!doc)throw new TypeError('document is required');
  const root=doc.createElement('div');root.className='camera-position-control';root.dataset.combat='false';
  const button=doc.createElement('button');button.type='button';button.className='camera-position-trigger';button.dataset.icon='camcorder';button.setAttribute('aria-label','カメラ位置');button.setAttribute('aria-expanded','false');button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="7.4" width="11.5" height="9.2" rx="2"/><path d="M15 10.1 20.5 7.8v8.4L15 13.9Z"/></svg>';
  const panel=doc.createElement('div');panel.className='camera-position-panel';panel.id='camera-position-panel';panel.hidden=true;
  const rail=doc.createElement('span');rail.className='camera-position-rail';rail.setAttribute('aria-hidden','true');
  const knob=doc.createElement('span');knob.className='camera-position-knob';knob.setAttribute('aria-hidden','true');
  const slider=doc.createElement('input');slider.id='camera-position';slider.type='range';slider.min='0';slider.max='100';slider.step='1';slider.setAttribute('aria-label','カメラ位置');slider.setAttribute('aria-orientation','vertical');
  button.setAttribute('aria-controls',panel.id);panel.append(rail,knob,slider);root.append(button,panel);container?.append(root);
  let current=.5,open=false,combat=false;
  const setOpen=value=>{open=Boolean(value)&&!combat;panel.hidden=!open;button.setAttribute('aria-expanded',String(open));root.classList.toggle('is-open',open);return open;};
  const apply=value=>{
    current=clamp01(value);const percent=Math.round(current*100),visualTop=8+(100-percent)*.84;slider.value=String(percent);slider.setAttribute('aria-valuetext',`${percent}%`);knob.style.top=`${visualTop}%`;panel.dataset.value=String(percent);onChange?.(current);return current;
  };
  const input=()=>apply(Number(slider.value)/100);
  const toggle=()=>setOpen(!open);
  const outside=event=>{if(open&&!root.contains(event.target))setOpen(false);};
  const escape=event=>{if(event.key==='Escape'&&open){setOpen(false);button.focus();}};
  slider.addEventListener('input',input,{passive:true});button.addEventListener('click',toggle);doc.addEventListener('pointerdown',outside);doc.addEventListener('keydown',escape);apply(initial);
  return{element:root,button,slider,value:()=>current,set:apply,setCombat(active){const next=Boolean(active);if(next===combat)return;combat=next;root.dataset.combat=String(combat);button.disabled=combat;button.setAttribute('aria-disabled',String(combat));if(combat)setOpen(false);},dispose(){slider.removeEventListener('input',input);button.removeEventListener('click',toggle);doc.removeEventListener('pointerdown',outside);doc.removeEventListener('keydown',escape);root.remove();}};
}
