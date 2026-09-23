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
  const thumb=doc.createElement('span');thumb.className='camera-position-thumb';thumb.dataset.icon='eye';thumb.setAttribute('aria-hidden','true');thumb.innerHTML='<svg viewBox="0 0 28 24"><path d="M2 12c3.5-4.5 7-6.8 12-6.8S22.5 7.5 26 12c-3.5 4.5-7 6.8-12 6.8S5.5 16.5 2 12Z"/><circle cx="14" cy="12" r="3.6"/></svg>';
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
