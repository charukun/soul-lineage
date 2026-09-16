import {DAYS_YEAR} from '../game/core.js';

const CRITICAL_TYPES=new Set(['threat','loss']);
const TYPE_LABELS={
 threat:'警戒',loss:'弔い',rescue:'救助',voyage:'航海',arrival:'来訪',discovery:'発見',construction:'建築',moment:'暮らし',life:'暮らし'
};

export function collectAddedNews(news,lastHead){
 const list=Array.isArray(news)?news:[];
 const head=list[0]||null;
 if(!head||head===lastHead)return{added:[],head};
 if(lastHead===null)return{added:list.slice(0,12),head};
 const previous=list.indexOf(lastHead);
 return{added:previous>0?list.slice(0,previous):[head],head};
}

const isCritical=entry=>CRITICAL_TYPES.has(entry?.type);
const typeLabel=entry=>TYPE_LABELS[entry?.type]||'記録';
const dayLabel=day=>{
 const value=Number(day)||0;
 return`${Math.floor(value/DAYS_YEAR)+1}年 · ${Math.floor(value%DAYS_YEAR)+1}日`;
};

/**
 * Village news stays in the world state. This controller only decides how much
 * of it deserves the player's attention right now.
 */
export function installEventChronicle({world,eventButton}){
 if(!world||!eventButton)return{sync(){},toggle(){},close(){},isOpen:()=>false};

 eventButton.title='村の年代記';
 eventButton.setAttribute('aria-label','村の年代記');
 eventButton.setAttribute('aria-expanded','false');
 eventButton.setAttribute('aria-controls','muraChronicle');

 const badge=document.createElement('span');
 badge.className='muraEventBadge';
 badge.hidden=true;
 badge.setAttribute('aria-hidden','true');
 eventButton.append(badge);

 const ticker=document.createElement('button');
 ticker.type='button';
 ticker.id='muraEventTicker';
 ticker.hidden=true;
 ticker.innerHTML='<small class="muraEventTickerLabel">村の便り</small><span class="muraEventTickerText"></span>';
 ticker.setAttribute('aria-label','村の年代記を開く');

 const panel=document.createElement('section');
 panel.id='muraChronicle';
 panel.hidden=true;
 panel.setAttribute('aria-label','村の年代記');
 panel.innerHTML='<header class="muraChronicleHeader"><div><small>村の記録</small><h2>村の年代記</h2></div><span class="muraChronicleCount"></span><button type="button" class="muraChronicleClose" aria-label="年代記を閉じる">×</button></header><div class="muraChronicleList"></div>';
 document.body.append(ticker,panel);

 const tickerLabel=ticker.querySelector('.muraEventTickerLabel');
 const tickerText=ticker.querySelector('.muraEventTickerText');
 const count=panel.querySelector('.muraChronicleCount');
 const list=panel.querySelector('.muraChronicleList');
 const closeButton=panel.querySelector('.muraChronicleClose');
 let lastHead=world.state.news?.[0]||null;
 let unread=0;
 let previewBatch=[];
 let previewUntil=0;
 let nextPreviewAt=0;
 let nextCriticalPreviewAt=0;
 let renderedHead=null;
 let renderedLength=-1;

 function updateBadge(){
  const value=Math.min(999,unread);
  badge.hidden=value===0;
  badge.textContent=value>99?'99+':String(value);
  eventButton.dataset.unread=value?'true':'false';
  eventButton.setAttribute('aria-label',value?`村の年代記・未確認 ${value}件`:'村の年代記');
 }

 function renderTicker(){
  const featured=previewBatch.find(isCritical)||previewBatch[0];
  if(!featured)return;
  const critical=previewBatch.some(isCritical);
  ticker.dataset.priority=critical?'critical':'normal';
  tickerLabel.textContent=critical?'急報':'村の便り';
  tickerText.textContent=previewBatch.length===1?featured.text:`村で${previewBatch.length}件 · ${featured.text}`;
 }

 function renderChronicle(force=false){
  const news=Array.isArray(world.state.news)?world.state.news:[];
  const head=news[0]||null;
  if(!force&&head===renderedHead&&news.length===renderedLength)return;
  renderedHead=head;renderedLength=news.length;
  count.textContent=news.length?`${news.length}件の記録`:'まだ記録はありません';
  list.replaceChildren();
  if(!news.length){
   const empty=document.createElement('p');empty.className='muraChronicleEmpty';empty.textContent='村の暮らしが動くと、ここに記録が積み重なります。';list.append(empty);return;
  }
  const fragment=document.createDocumentFragment();
  for(const entry of news.slice(0,40)){
   const article=document.createElement('article');
   article.className='muraChronicleEntry';
   article.dataset.priority=isCritical(entry)?'critical':'normal';
   const meta=document.createElement('small');meta.textContent=`${dayLabel(entry.day)} · ${typeLabel(entry)}`;
   const body=document.createElement('p');body.textContent=String(entry.text||'');
   article.append(meta,body);fragment.append(article);
  }
  list.append(fragment);
 }

 function open(){
  panel.hidden=false;
  ticker.hidden=true;
  previewBatch=[];previewUntil=0;
  unread=0;updateBadge();renderChronicle(true);
  eventButton.setAttribute('aria-expanded','true');
 }
 function close({restoreFocus=false}={}){
  if(panel.hidden)return;
  panel.hidden=true;
  eventButton.setAttribute('aria-expanded','false');
  if(restoreFocus)eventButton.focus({preventScroll:true});
 }
 function toggle(){panel.hidden?open():close();}

 function ingest(added,now){
  if(!added.length)return;
  if(panel.hidden)unread=Math.min(999,unread+added.length);else unread=0;
  updateBadge();
  if(!panel.hidden){renderChronicle();return;}

  if(now<previewUntil){
   previewBatch=[...added,...previewBatch].slice(0,8);
   renderTicker();
   return;
  }

  const critical=added.some(isCritical);
  const mayInterruptCooldown=critical&&now>=nextCriticalPreviewAt;
  if(now<nextPreviewAt&&!mayInterruptCooldown)return;

  previewBatch=added.slice(0,8);
  previewUntil=now+(critical?3200:2400);
  nextPreviewAt=now+(critical?7000:9000);
  if(critical)nextCriticalPreviewAt=now+7000;
  renderTicker();
 }

 function sync(now=performance.now(),{blocked=false}={}){
  const news=Array.isArray(world.state.news)?world.state.news:[];
  const result=collectAddedNews(news,lastHead);
  lastHead=result.head;
  if(result.added.length)ingest(result.added,now);

  if(blocked){
   previewBatch=[];previewUntil=0;ticker.hidden=true;
   if(!panel.hidden)close();
   return;
  }
  if(!panel.hidden){unread=0;updateBadge();renderChronicle();ticker.hidden=true;return;}
  if(now>=previewUntil){previewBatch=[];ticker.hidden=true;return;}
  if(previewBatch.length){renderTicker();ticker.hidden=false;}
 }

 eventButton.onclick=toggle;
 ticker.onclick=open;
 closeButton.onclick=()=>close({restoreFocus:true});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden)close({restoreFocus:true});});
 updateBadge();
 return{sync,toggle,close,isOpen:()=>!panel.hidden};
}
