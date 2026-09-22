export function setReviewStatus(target,message,{error=false,state=null}={}){
  if(!target)return;
  target.textContent=String(message??'');
  target.dataset.error=String(Boolean(error));
  if(state===null||state===undefined)delete target.dataset.state;
  else target.dataset.state=String(state);
}
