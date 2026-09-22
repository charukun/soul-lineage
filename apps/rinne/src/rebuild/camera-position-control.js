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
  const panel=doc.createElement('div');panel.className='camera-position-panel';panel.id='camera-position-panel';
  const rail=doc.createElement('span');rail.className='camera-position-rail';rail.setAttribute('aria-hidden','true');
  const thumb=doc.createElement('span');thumb.className='camera-position-thumb';thumb.dataset.icon='camcorder';thumb.setAttribute('aria-hidden','true');thumb.innerHTML='<svg viewBox="0 0 28 24"><rect x="3" y="6.4" width="14.5" height="11.2" rx="2.4"/><path d="M17.5 9.4 24.5 6.8v10.4l-7-2.6Z"/></svg>';
  const slider=doc.createElement('input');slider.id='camera-position';slider.type='range';slider.min='0';slider.max='100';slider.step='1';slider.setAttribute('aria-label','カメラ位置');slider.setAttribute('aria-orientation','vertical');
  panel.append(rail,thumb,slider);root.append(panel);container?.append(root);
  let current=.5,combat=false;
  const apply=value=>{
    current=clamp01(value);const percent=Math.round(current*100),visualTop=7+(100-percent)*.8;slider.value=String(percent);slider.setAttribute('aria-valuetext',`${percent}%`);thumb.style.top=`${visualTop}px`;panel.dataset.value=String(percent);onChange?.(current);return current;
  };
  const input=()=>apply(Number(slider.value)/100);
  slider.addEventListener('input',input,{passive:true});apply(initial);
  return{element:root,slider,thumb,value:()=>current,set:apply,setCombat(active){const next=Boolean(active);if(next===combat)return;combat=next;root.dataset.combat=String(combat);root.classList.toggle('is-combat',combat);slider.disabled=combat;slider.setAttribute('aria-disabled',String(combat));},dispose(){slider.removeEventListener('input',input);root.remove();}};
}
