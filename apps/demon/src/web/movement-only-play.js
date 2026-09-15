const SENSE_REFRESH_MS=16_250;

const byId=id=>document.getElementById(id);
let sessionKey='';
let lastSenseAt=-Infinity;
let returnActivated=false;

function readSnapshot(){
  try{return window.__NIGHT_HUNT__?.snapshot?.()||null;}catch{return null;}
}

function compactReturnHint(){
  const hint=byId('return-hint');
  if(!hint)return;
  const compact=hint.textContent.replace(/\s*·\s*輪の中で指を離す\s*$/,'');
  if(compact!==hint.textContent)hint.textContent=compact;
}

function installSystemActions(){
  const body=byId('sheet-body');
  if(!body||!body.querySelector('#sound-toggle')||body.querySelector('#movement-help'))return;
  const intro=body.querySelector(':scope > p');
  intro?.remove();

  const help=document.createElement('button');
  help.id='movement-help';
  help.className='inline-action';
  help.innerHTML='動きかた<small>通常の狩りで触るのは移動だけ。詳しい挙動を見る。</small>';

  const lineage=document.createElement('button');
  lineage.id='movement-lineage';
  lineage.className='inline-action';
  lineage.innerHTML='転生史<small>喰らった特能、写した動き、この生の記録を見る。</small>';

  help.addEventListener('click',()=>{
    byId('sheet-kicker').textContent='HOW TO HUNT';
    byId('sheet-title').textContent='動きかた';
    body.innerHTML='<p>狩場を指で滑らせると移動します。接敵すると戦闘、倒れた獲物のそばで止まると捕食が自動で始まります。</p><p>敵から距離を取る移動で戦闘を離れられます。捕食後は帰還口が自動で示され、輪の中で止まると帰還します。</p><p class="muted">素早く弾く移動は走りになります。走行中も次の移動入力で進行方向を変えるか止められます。</p><button class="inline-action" id="movement-help-back">闇へ戻る<small>設定と記録へ戻る。</small></button>';
    body.querySelector('#movement-help-back')?.addEventListener('click',()=>byId('pause')?.click());
  });
  lineage.addEventListener('click',()=>byId('title-memory')?.click());

  body.prepend(lineage);
  body.prepend(help);
}

function automate(now=performance.now()){
  const snap=readSnapshot();
  if(!snap||snap.mode!=='hunt')return;
  if(snap.village!==sessionKey){
    sessionKey=snap.village;
    lastSenseAt=-Infinity;
    returnActivated=false;
  }
  if(snap.paused)return;

  if(now-lastSenseAt>=SENSE_REFRESH_MS){
    const scent=byId('scent');
    if(scent&&!scent.disabled){
      scent.click();
      lastSenseAt=now;
    }
  }

  if(snap.eaten>0&&!returnActivated){
    const returnButton=byId('return');
    if(returnButton&&!returnButton.disabled&&!returnButton.classList.contains('locked')){
      returnButton.click();
      returnActivated=true;
    }
  }
}

export function installMovementOnlyPlay(){
  for(const id of ['return']){
    const el=byId(id);
    if(el){el.tabIndex=-1;el.setAttribute('aria-hidden','true');}
  }
  compactReturnHint();
  const returnHint=byId('return-hint');
  if(returnHint)new MutationObserver(compactReturnHint).observe(returnHint,{childList:true,characterData:true,subtree:true});
  const sheetBody=byId('sheet-body');
  if(sheetBody)new MutationObserver(installSystemActions).observe(sheetBody,{childList:true,subtree:true});
  installSystemActions();
  setInterval(()=>automate(),250);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installMovementOnlyPlay,{once:true});
else installMovementOnlyPlay();
