import { CoopWorld } from '../rebuild/coop-world.js';
import { createCoopHost, joinCoopHost } from './session.js';
import { readInvitation, invitationUrl } from './wire.js';
import './menu.css';

export function installCoopMenu({container,buildInfo,getPrepared,getName,onPlay,onLeave}){
  let session=null,playing=false,locked=false,releaseLock=null;
  const contentVersion=String(buildInfo.commit||'local');
  container.innerHTML=`<section class="coop-menu"><p>友達との試遊の村。ひとり用の人生とは別に残ります。</p><div class="coop-actions"><button id="coop-host">村を開く</button><button id="coop-resume">前の村を開く</button><button id="coop-invite" hidden>友達を招く</button></div><label>招待リンク<textarea id="coop-link" autocomplete="off" spellcheck="false"></textarea></label><div class="coop-actions"><button id="coop-copy">招待をコピー</button><button id="coop-share">招待を渡す</button><button id="coop-join">この招待で参加</button></div><label>返事のコード<textarea id="coop-answer" autocomplete="off" spellcheck="false"></textarea></label><div class="coop-actions"><button id="coop-copy-answer">返事をコピー</button><button id="coop-accept">届いた返事を受け取る</button></div><button id="coop-cancel" hidden>接続をやめる / 村を離れる</button><p id="coop-status" role="status" aria-live="polite">村を開くか、友達からの招待を貼り付けてください。</p><details><summary>試遊について</summary><p>招待を渡したら、友達の返事を受け取るとつながります。村を開いた人の画面が閉じると世界は闇に包まれます。同じ村を開き直して新しい招待を渡すと再接続できます。</p><p>この試遊は、村を開いた友達を信頼して遊びます。村の記録はその端末に残ります。自動で別の友達へ引き継ぐことはできません。回線によってはつながらない場合があります。</p></details></section>`;
  const $=id=>container.querySelector(`#${id}`),status=text=>{$('coop-status').textContent=text;};
  const run=fn=>async()=>{if(locked)return;locked=true;try{await fn();}catch(error){status(error.message);}finally{locked=false;}};
  const copy=async id=>{await navigator.clipboard.writeText($(id).value);status('コピーしました。');};
  const storage=()=>getPrepared().platform.storage;
  async function persist(value){await storage().write(`coop-v1:${value.world.worldId}`,JSON.stringify(value));await storage().write('coop-last',value.world.worldId);}
  function changed(){const snapshot=session?.snapshot();if(!snapshot)return;status(snapshot.error||(snapshot.phase==='open'?`${snapshot.view?.connected||1}人 · 村は開いています`:'村とのつながりを待っています。'));
    if(!playing&&session?.selfId&&session?.layout&&snapshot.view){playing=true;Promise.resolve(onPlay(session)).catch(error=>{void leave().finally(()=>status(error.message));});}}
  async function acquire(){
    if(!navigator.locks)throw Error('このブラウザでは村の二重起動を防げません。対応ブラウザから村を開いてください。');
    await new Promise((resolve,reject)=>{void navigator.locks.request('rinne-coop-host',{ifAvailable:true},async lock=>{if(!lock){reject(Error('別の画面で試遊の村が開いています。'));return;}resolve();await new Promise(done=>{releaseLock=done;});}).catch(reject);});
  }
  async function host(resume){
    if(session)throw Error('いったんタイトルへ戻ってから村を開いてください。');await acquire();
    try{
      let saved=null;if(resume){const id=await storage().read('coop-last');if(!id)throw Error('保存された試遊の村はありません。');const raw=await storage().read(`coop-v1:${id}`);saved=JSON.parse(raw);}
      const prepared=getPrepared(),worldId=saved?.world.worldId||`room-${crypto.randomUUID()}`,ownerId=saved?.world.ownerId||`p-${crypto.randomUUID()}`;
      const world=new CoopWorld({worldId,ownerId,name:getName(),layout:saved?.layout||prepared.layout,saved:saved?.world});
      session=await createCoopHost({world,contentVersion,save:persist,RTCPeerConnection,onChange:changed});$('coop-invite').hidden=false;$('coop-cancel').hidden=false;changed();
    }catch(error){releaseLock?.();releaseLock=null;throw error;}
  }
  $('coop-host').onclick=run(()=>host(false));$('coop-resume').onclick=run(()=>host(true));
  $('coop-invite').onclick=run(async()=>{status('招待を用意しています。');const invite=await session.invite();$('coop-link').value=invitationUrl(location.href,invite);$('coop-answer').value='';status('招待を渡し、友達から届く返事を受け取ってください。');});
  $('coop-copy').onclick=run(()=>copy('coop-link'));$('coop-copy-answer').onclick=run(()=>copy('coop-answer'));
  $('coop-share').onclick=run(async()=>{const url=$('coop-link').value;if(!url)throw Error('先に友達を招いてください。');if(navigator.share)await navigator.share({title:'輪廻転焦 · 友達との試遊',url});else await copy('coop-link');});
  $('coop-join').onclick=run(async()=>{
    if(session)throw Error('いったんタイトルへ戻ってから参加してください。');const invite=readInvitation($('coop-link').value);if(!invite)throw Error('招待リンクを貼り付けてください。');
    let resume=null;try{resume=JSON.parse(await storage().read(`coop-ticket:${invite.worldId}`)||'null');}catch{}
    session=await joinCoopHost({invite,name:getName(),contentVersion,RTCPeerConnection,resume,onChange:changed,remember:ticket=>{void storage().write(`coop-ticket:${invite.worldId}`,JSON.stringify(ticket)).catch(error=>status(`再接続の記録に失敗: ${error.message}`));}});
    $('coop-cancel').hidden=false;$('coop-answer').value=session.answerCode;status('返事をコピーして、村を開いた友達へ渡してください。');
  });
  $('coop-accept').onclick=run(async()=>{if(session?.role!=='host')throw Error('先に村を開いて友達を招いてください。');await session.accept($('coop-answer').value);status('友達との接続を待っています。');});
  try{const invite=readInvitation(location.hash);if(invite)$('coop-link').value=location.href;}catch(error){status(error.message);}
  async function leave(){const old=session;session=null;playing=false;$('coop-invite').hidden=true;$('coop-cancel').hidden=true;try{await old?.dispose();}finally{releaseLock?.();releaseLock=null;status('試遊の村を離れました。');}}
  $('coop-cancel').onclick=run(async()=>{if(playing)await onLeave();else await leave();});
  return{leave,get session(){return session;}};
}
