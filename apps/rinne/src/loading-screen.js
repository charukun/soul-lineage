const loadingCard=document.getElementById('loading-card');
const loadingMessage=document.getElementById('loading-message');
const progress=document.getElementById('loading-progress');
const progressBar=document.getElementById('loading-progress-bar');
const progressMeta=document.getElementById('loading-progress-meta');
const gameCanvas=document.getElementById('game');

const STEPS=[
  {match:'世界のしくみを呼び出しています',step:1,label:'仕組み'},
  {match:'村の地図をひらいています',step:2,label:'地図'},
  {match:'景色を描いています',step:3,label:'景色'},
  {match:'旅人を迎えています',step:4,label:'旅人'},
];

function applyProgress(message){
  if(!loadingCard||!progress||!progressBar||!progressMeta)return;
  const found=STEPS.find(({match})=>String(message||'').includes(match));
  if(!found)return;
  const total=STEPS.length;
  const ratio=found.step/total;
  progressBar.style.transform=`scaleX(${ratio})`;
  progress.setAttribute('aria-valuemin','0');
  progress.setAttribute('aria-valuemax',String(total));
  progress.setAttribute('aria-valuenow',String(found.step));
  progressMeta.textContent=`${found.step} / ${total} · ${found.label}`;
  loadingCard.dataset.loadingStep=String(found.step);
}

if(loadingMessage){
  applyProgress(loadingMessage.textContent);
  const messageObserver=new MutationObserver(()=>applyProgress(loadingMessage.textContent));
  messageObserver.observe(loadingMessage,{childList:true,characterData:true,subtree:true});
}

if(gameCanvas){
  const canvasObserver=new MutationObserver(()=>{
    if(gameCanvas.dataset.runtime==='prepared')loadingCard?.setAttribute('data-world-ready','true');
  });
  canvasObserver.observe(gameCanvas,{attributes:true,attributeFilter:['data-runtime']});
}
