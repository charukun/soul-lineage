// The field and battle radar share one visual and update path.
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
export function rinneFieldRadarMarkup({interactive=true}={}){
  const tag=interactive?'button':'aside',attrs=interactive?'type="button"':'role="img"';
  return `<${tag} data-field-radar class="rinne-field-radar" ${attrs} aria-label="${interactive?'地図を開く':'戦闘位置'}">
    <span class="rinne-field-radar__face" aria-hidden="true"><span class="rinne-field-radar__rings"></span><span data-radar-places class="rinne-field-radar__places"></span><em data-radar-target class="rinne-field-radar__target" hidden></em><i data-radar-player class="rinne-field-radar__player"></i><u>N</u></span>
    <small data-radar-label class="rinne-field-radar__label">村</small><strong data-radar-distance class="rinne-field-radar__distance">MAP</strong>
  </${tag}>`;
}
export function updateRinneFieldRadar(root,{position={x:0,z:0},yaw=0,places=[],target=null,range=28,label='村',interactive=true}={}){
  if(!root)return;
  const at=selector=>root.querySelector(selector),dots=at('[data-radar-places]'),pointer=at('[data-radar-target]'),player=at('[data-radar-player]');
  if(!dots||!pointer||!player)return;
  const distance=Math.max(1,Number(range)||28),originX=Number(position?.x)||0,originZ=Number(position?.z)||0;
  dots.innerHTML=places.filter(row=>Number.isFinite(row.x)&&Number.isFinite(row.z)).slice(0,8).map(row=>{
    const dx=(row.x-originX)/distance*42,dz=(row.z-originZ)/distance*42,category=escapeHtml(row.category||'place');
    return `<i data-category="${category}" style="left:${50+clamp(dx,-42,42)}%;top:${50-clamp(dz,-42,42)}%" title="${escapeHtml(row.label||row.id)}"></i>`;
  }).join('');
  player.style.transform=`translate(-50%,-50%) rotate(${Number(yaw)||0}rad)`;
  if(target&&Number.isFinite(target.x)&&Number.isFinite(target.z)){
    const dx=target.x-originX,dz=target.z-originZ,length=Math.max(.001,Math.hypot(dx,dz)),scale=Math.min(42,length/distance*42);
    pointer.hidden=false;pointer.style.left=`${50+dx/length*scale}%`;pointer.style.top=`${50-dz/length*scale}%`;
    at('[data-radar-distance]').textContent=target.distance==null?'':`${target.distance}m`;
    at('[data-radar-label]').textContent=target.label||label;
    root.setAttribute('aria-label',`${interactive?'地図を開く。':''}${target.label||label}${target.distance==null?'':`まで${target.distance}m`}`);
  }else{
    pointer.hidden=true;at('[data-radar-distance]').textContent=interactive?'MAP':'';
    at('[data-radar-label]').textContent=label;root.setAttribute('aria-label',interactive?'地図を開く':label);
  }
}
