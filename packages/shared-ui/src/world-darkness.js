const STYLE_ID='soul-world-darkness-style';
const PHASE_TEXT={
  open:['闇が晴れていく','世界との繋がりが戻りました'],
  migrating:['闇が村へ迫っている','次の魂へ世界を継いでいます'],
  closed:['村は闇に閉ざされている','安全に世界を継げる仲間を待っています'],
};

function installStyle(documentRef){
  if(documentRef.getElementById(STYLE_ID))return;
  const style=documentRef.createElement('style');style.id=STYLE_ID;style.textContent=`
.soul-world-darkness{position:fixed;inset:0;z-index:2147483000;opacity:0;pointer-events:none;transition:opacity 1.1s ease;background:radial-gradient(circle at 50% 45%,transparent 0 16%,rgba(3,12,18,.3) 48%,rgba(1,5,10,.92) 100%);overflow:hidden}
.soul-world-darkness::before,.soul-world-darkness::after{content:"";position:absolute;inset:-30%;background:conic-gradient(from 20deg,transparent,rgba(22,34,45,.62),transparent 28%,rgba(6,12,23,.72),transparent 62%);animation:soul-world-darkness-spin 8s linear infinite}
.soul-world-darkness::after{animation-direction:reverse;animation-duration:13s;filter:blur(28px)}
.soul-world-darkness[data-phase="migrating"],.soul-world-darkness[data-phase="closed"]{opacity:1;pointer-events:auto;touch-action:none}
.soul-world-darkness[data-phase="closed"]{background:rgba(1,5,10,.97)}
.soul-world-darkness__message{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(88vw,420px);text-align:center;color:#e8dfc8;font-family:serif;letter-spacing:.13em;text-shadow:0 2px 12px #000}
.soul-world-darkness__message strong{display:block;font-size:clamp(18px,3vw,27px);font-weight:400}.soul-world-darkness__message small{display:block;margin-top:12px;font:10px system-ui;letter-spacing:.08em;color:#b8c5c6;opacity:.82;line-height:1.6}
.soul-world-darkness[data-long="true"] .soul-world-darkness__message small{color:#e1cfaa}
@keyframes soul-world-darkness-spin{to{transform:rotate(1turn) scale(1.08)}}
@media(prefers-reduced-motion:reduce){.soul-world-darkness::before,.soul-world-darkness::after{animation:none}}
`;
  documentRef.head.append(style);
}

export function installWorldDarknessOverlay({documentRef=globalThis.document,globalRef=globalThis.window,longNoticeMs=30_000,onPauseChange=()=>{}}={}){
  if(!documentRef?.body)return{setPhase(){},dispose(){},get phase(){return'open';}};
  installStyle(documentRef);
  const root=documentRef.createElement('div');root.className='soul-world-darkness';root.dataset.phase='open';root.dataset.long='false';
  root.innerHTML='<div class="soul-world-darkness__message"><strong>闇が晴れていく</strong><small>世界との繋がりが戻りました</small></div>';
  documentRef.body.append(root);
  let phase='open',noticeTimer=null;
  const strong=root.querySelector('strong'),small=root.querySelector('small');
  function setPhase(next='open',detail={}){
    next=PHASE_TEXT[next]?next:'closed';
    phase=next;root.dataset.phase=next;root.dataset.long='false';
    const [title,note]=PHASE_TEXT[next];strong.textContent=detail.title||title;
    small.textContent=detail.note||note+(detail.candidateId?` · 継承候補 ${detail.candidateId}`:'');
    clearTimeout(noticeTimer);noticeTimer=null;
    if(next!=='open')noticeTimer=setTimeout(()=>{root.dataset.long='true';small.textContent=detail.longNote||'接続を守りながら復旧を続けています';},longNoticeMs);
    const paused=next!=='open';if(globalRef)globalRef.__SHARED_WORLD_PAUSED__=paused;onPauseChange(paused,next,detail);
  }
  function dispose(){clearTimeout(noticeTimer);if(globalRef)globalRef.__SHARED_WORLD_PAUSED__=false;root.remove();}
  return{setPhase,dispose,get phase(){return phase;},root};
}
