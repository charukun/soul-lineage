import './review-choice-visual.css';

const esc=value=>String(value||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const hash=value=>Array.from(String(value||'')).reduce((n,ch)=>((n*33)^ch.charCodeAt(0))>>>0,5381);

function objectSvg(id){
  const v=String(id||'').toLowerCase();
  if(v.includes('barrel'))return '<ellipse cx="50" cy="22" rx="24" ry="8"/><rect x="26" y="22" width="48" height="50" rx="8"/><ellipse cx="50" cy="72" rx="24" ry="8"/><path d="M27 38h46M27 57h46"/>';
  if(v.includes('box'))return '<path d="M25 32 50 20l25 12v40L50 82 25 72Z"/><path d="m25 32 25 12 25-12M50 44v38"/>';
  if(v.includes('rubble')||v.includes('wall'))return '<path d="M18 70 29 48l17 8 11-27 25 41Z"/><path d="m30 70 10-16m16 16 10-22"/>';
  if(v.includes('torch')||v.includes('lamp')||v.includes('hearth'))return '<path d="M46 78h8V43h-8Z"/><path d="M50 45c-16-8-12-24 0-31 0 10 14 11 8 24-2 5-5 7-8 7Z"/>';
  if(v.includes('tree')||v.includes('pine')||v.includes('plant')||v.includes('flowers')||v.includes('hedge'))return '<path d="M46 78h8V48h-8Z"/><circle cx="50" cy="32" r="19"/><circle cx="35" cy="43" r="12"/><circle cx="65" cy="43" r="12"/>';
  if(v.includes('fence'))return '<path d="M20 72V28m20 44V22m20 50V28m20 44V22M16 42h68M16 59h68"/>';
  if(v.includes('bench')||v.includes('chair')||v.includes('sofa'))return '<path d="M24 56h52v16H24Z"/><path d="M30 72v10m40-10v10M27 54V36h46v18"/>';
  if(v.includes('bed'))return '<path d="M18 50h64v24H18Z"/><path d="M20 50V32h14v18M24 74v8m52-8v8"/>';
  if(v.includes('table')||v.includes('counter')||v.includes('workbench'))return '<path d="M18 43h64v14H18Z"/><path d="M27 57v25m46-25v25"/>';
  if(v.includes('shelf'))return '<path d="M24 20h52v62H24Z"/><path d="M24 39h52M24 59h52"/>';
  if(v.includes('rug'))return '<path d="M18 34h64v38H18Z"/><path d="m25 41 8 8-8 8 8 8m42-24-8 8 8 8-8 8"/>';
  if(v.includes('dummy')||v.includes('armor'))return '<circle cx="50" cy="22" r="9"/><path d="M50 31v31M26 42h48M36 82l14-20 14 20"/>';
  if(v.includes('spear'))return '<path d="M28 78 69 25"/><path d="m69 25 8-13 2 15-10-2Z"/>';
  if(v.includes('axe'))return '<path d="M38 80 62 20"/><path d="M61 20c16 0 21 8 17 20L58 32Z"/>';
  if(v.includes('great')||v.includes('sword'))return '<path d="m34 76 32-55 6 5-32 55Z"/><path d="M29 68 46 78"/>';
  return '<circle cx="50" cy="50" r="25"/><path d="M29 50h42M50 29v42"/>';
}
function equipmentSvg(id){
  const v=String(id||'').toLowerCase();
  if(v.includes('shield'))return '<path d="M50 16 76 27v20c0 18-12 30-26 38-14-8-26-20-26-38V27Z"/><path d="M50 24v50"/>';
  if(v.includes('bow'))return '<path d="M28 18c28 18 28 46 0 64M28 18l18 32-18 32"/>';
  if(v.includes('staff'))return '<path d="M34 82 62 18"/><circle cx="64" cy="17" r="8"/>';
  if(v.includes('axe'))return objectSvg('axe');
  if(v.includes('quiver'))return '<path d="M32 30h28l8 50H40Z"/><path d="M43 32 34 14m21 18 2-20m10 22 10-17"/>';
  return objectSvg('sword');
}
function modelSvg(seed){
  const n=hash(seed)%3,arm=n===0?18:n===1?30:10,leg=n===2?18:11;
  return `<circle cx="50" cy="20" r="9"/><path d="M50 29v31M50 38 32 ${38-arm/3}M50 38 68 ${38+arm/4}M50 60 39 ${80-leg/3}M50 60 63 ${80+leg/5}"/>`;
}
function motionSvg(category,seed){
  const n=hash(seed)%4;
  if(category==='combat')return '<circle cx="46" cy="18" r="7"/><path d="M46 25 42 50 28 64M42 50l16 25M44 32 70 39M44 32 24 23"/>';
  if(category==='move')return '<circle cx="46" cy="17" r="7"/><path d="M46 24 48 48 30 60M48 48l23 18M46 31 28 43M46 31 68 25"/>';
  if(category==='reaction')return '<circle cx="50" cy="18" r="7"/><path d="M50 25 54 52 37 77M54 52l20 17M50 33 26 25M50 33 72 20"/>';
  const dy=2+n*2;return `<circle cx="50" cy="${18+dy}" r="7"/><path d="M50 ${25+dy}v29M50 ${35+dy} 31 ${40-dy}M50 ${35+dy} 69 ${40+dy}M50 ${54+dy} 39 79M50 ${54+dy} 62 79"/>`;
}
function effectSvg(id,category){
  const v=(String(id||'')+' '+String(category||'')).toLowerCase();
  if(v.includes('impact')||v.includes('hit'))return '<path d="m50 12 7 24 21-12-13 21 23 6-24 7 12 21-21-13-6 23-7-24-21 12 13-21-23-6 24-7-12-21 21 13Z"/>';
  if(v.includes('storm')||v.includes('area'))return '<circle cx="50" cy="50" r="28"/><circle cx="50" cy="50" r="16"/><path d="M18 50h64M50 18v64"/>';
  if(v.includes('slash')||v.includes('blade'))return '<path d="M18 72C42 28 62 18 83 17 58 31 43 48 28 78Z"/><path d="M29 76C48 48 62 39 78 35"/>';
  return '<circle cx="50" cy="50" r="12"/><path d="M50 12v20M50 68v20M12 50h20M68 50h20M23 23l14 14m26 26 14 14m0-54-14 14M37 63 23 77"/>';
}
export function createReviewChoiceVisual({type='object',variant='',category='',label='',seed=''}) {
  const visual=document.createElement('span');visual.className='review-choice-visual';visual.dataset.reviewVisual=type;visual.setAttribute('aria-hidden','true');
  const body=type==='equipment'?equipmentSvg(variant):type==='model'?modelSvg(seed||variant||label):type==='motion'?motionSvg(category,seed||variant||label):type==='effect'?effectSvg(variant,category):objectSvg(variant||label);
  visual.innerHTML=`<svg viewBox="0 0 100 100" focusable="false" aria-hidden="true"><g>${body}</g></svg>`;
  visual.title=esc(label);
  return visual;
}
