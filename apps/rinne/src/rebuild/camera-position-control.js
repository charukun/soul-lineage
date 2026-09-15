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
  const root=doc.createElement('div');root.className='camera-position-control';
  const slider=doc.createElement('input');slider.id='camera-position';slider.type='range';slider.min='0';slider.max='100';slider.step='1';slider.setAttribute('aria-label','カメラ位置');slider.setAttribute('aria-orientation','vertical');
  root.append(slider);container?.append(root);
  let current=.5;
  const apply=value=>{
    current=clamp01(value);const percent=Math.round(current*100);slider.value=String(percent);slider.setAttribute('aria-valuetext',`${percent}%`);onChange?.(current);return current;
  };
  const input=()=>apply(Number(slider.value)/100);
  slider.addEventListener('input',input,{passive:true});apply(initial);
  return{element:root,slider,value:()=>current,set:apply,dispose(){slider.removeEventListener('input',input);root.remove();}};
}
