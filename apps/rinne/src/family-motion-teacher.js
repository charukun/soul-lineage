// Village teaching is a preview surface. Commerce fulfillment is not wired yet.
const OFFERS=Object.freeze([
  {id:'family.moonfall',kind:'葬焉',label:'月影の介錯',description:'倒れた相手を見届けてから、二秒の一手で決着する。'},
  {id:'family.moonstill',kind:'残心',label:'月影の残心',description:'決着のあと一呼吸置き、刀を静かに納める。'},
]);
export function createFamilyMotionTeacher(root,stations){
  const station=stations.find(row=>row.familyMotionTeacher);
  const button=document.createElement('button');button.type='button';button.className='family-motion-talk';button.textContent='型の教え手と話す';button.hidden=true;
  const dialog=document.createElement('dialog');dialog.className='family-motion-dialog';
  const heading=document.createElement('h2');heading.textContent='一族に伝える型';
  const intro=document.createElement('p');intro.textContent='「見て覚えるだけでは残らん。一族の芸として受け継ぐかい」';
  const list=document.createElement('div');list.className='family-motion-offers';
  const close=document.createElement('button');close.type='button';close.textContent='話を終える';close.onclick=()=>dialog.close();
  dialog.append(heading,intro,list,close);root.append(button,dialog);
  let state=null;
  button.onclick=()=>{if(!state)return;list.replaceChildren();for(const offer of OFFERS){
    const card=document.createElement('section'),title=document.createElement('h3'),copy=document.createElement('p'),status=document.createElement('small');
    title.textContent=`${offer.kind} · ${offer.label}`;copy.textContent=offer.description;
    status.textContent=state.family?.familyMotions?.includes(offer.id)?'一族に継承済み · 体・身法で装備できます':'試演・伝授の受付は準備中';
    card.append(title,copy,status);list.append(card);
  }dialog.showModal();};
  return{update(next){state=next;button.hidden=!station||next.zone!=='village'||Boolean(next.interior)||next.ageYears<7||next.ended||Math.hypot(next.position.x-station.x,next.position.z-station.z)>2.6;},dispose(){dialog.close();button.remove();dialog.remove();}};
}
