import {compileCharacter25D,loadCharacter25DDraft,saveCharacter25DDraft,readCharacter25DFile,downloadCharacter25D,deleteCharacter25DDraft,reassociateCharacter25D} from '@soul/assets/character25d/browser';
import {mountShino25dWorkshop} from './shino25d-workshop.js';
import {REVIEW_DEV} from './review-lab-config.js';
import './character25d-forge.css';

export function mountCharacter25DForge(lab) {
  if(!lab)return;const {section,preview}=lab,host=document.createElement('section');host.className='lab-section character25d-forge';
  host.innerHTML=`<div class="section-head"><div><span>CHARACTER FORGE</span><h2>絵から、動くキャラクターへ。</h2></div></div>
    <label class="character25d-drop" tabindex="0"><input data-character-image type="file" accept="image/png,image/webp,image/jpeg" hidden><strong>キャラ画像を1枚入れる</strong><span>選ぶ、またはここへドロップ</span></label>
    <output data-forge-status role="status" aria-live="polite">読み込み後、下のPlaygroundですぐ動かせます。</output>
    <div class="character25d-ready" hidden><button data-rinne type="button">RINNEで確認</button><button data-change-image type="button">別の画像にする</button><span data-views></span></div>
    <details data-forge-advanced><summary>詳細調整・復旧</summary>
      <p>正面だけの絵では、側面・背面の原画は未収録です。三面図は左から正面・側面・背面の候補として扱います。判定が違う場合だけ直してください。</p>
      <div class="character25d-view-grid" data-appearance-previews></div>
      <button data-swap-views type="button">側面と背面を入れ替える</button>
      <label>既存bundleを読み込む<input data-character-bundle type="file" accept="application/json,.json"></label>
      <button data-character-export type="button">下書きを書き出す</button><button data-character-delete type="button">この下書きを削除</button>
      <details data-legacy-tools><summary>旧v1・atlas・切り出しツール</summary><button data-open-legacy type="button">旧ツールを開く</button></details>
      <small>端末内のlocal-draftです。原画・権利の確認は未承認のまま保持します。</small>
    </details>`;
  section.before(host);const find=s=>host.querySelector(s),abort=new AbortController();let draft=null,busy=false,disposed=false,pending=null,expiry=null;
  const status=text=>{if(!disposed)find('[data-forge-status]').textContent=text;};
  function render() {
    find('.character25d-ready').hidden=!draft;find('[data-appearance-previews]').replaceChildren();
    if(!draft)return;
    const views=draft.appearance?Object.entries(draft.appearance).filter(([,v])=>v):[];
    find('[data-views]').textContent=views.length>1?`${views.length}方向の候補 · 歩いて見てみましょう`:draft.appearance?'正面のみ · 他方向の原画は未収録':'旧v1素材';
    for(const key of ['front','frontQuarter','side','backQuarter','back']) {
      const figure=document.createElement('figure'),caption=document.createElement('figcaption');caption.textContent=({front:'正面',frontQuarter:'斜め前',side:'側面',backQuarter:'斜め後',back:'背面'})[key];
      const appearance=draft.appearance?.[key];if(appearance){const img=document.createElement('img');img.src=draft.assets[appearance.asset].dataUrl;img.alt=caption.textContent+'候補';figure.append(img);}else{const missing=document.createElement('span');missing.textContent='未収録';figure.append(missing);}figure.append(caption);find('[data-appearance-previews]').append(figure);
    }
  }
  async function install(next,{save=true}={}) {
    await preview.setCharacter(next);if(disposed)return;draft=next;render();host.dataset.actorReady='true';
    status('準備できました。下の画面でWASD、スマホは移動スティックで動かせます。');
    if(save)try{await saveCharacter25DDraft(draft);}catch(error){status('表示できました。'+error.message+'。詳細調整から書き出せます。');}
  }
  async function run(work) {if(busy||disposed)return;busy=true;host.dataset.busy='true';try{await work();}catch(error){status(error.message||'画像を処理できませんでした');}finally{busy=false;host.dataset.busy='false';}}
  const fileInput=find('[data-character-image]'),drop=find('.character25d-drop');
  const compile=file=>run(async()=>{const result=await compileCharacter25D(file,{onProgress:status});await install(result);section.scrollIntoView({behavior:'smooth',block:'start'});});
  fileInput.addEventListener('change',event=>{const file=event.target.files?.[0];event.target.value='';if(file)void compile(file);},{signal:abort.signal});
  drop.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();fileInput.click();}},{signal:abort.signal});
  for(const type of ['dragover','dragenter'])drop.addEventListener(type,event=>{event.preventDefault();drop.dataset.drag='true';},{signal:abort.signal});
  for(const type of ['dragleave','drop'])drop.addEventListener(type,event=>{event.preventDefault();drop.dataset.drag='false';if(type==='drop'&&event.dataTransfer?.files?.[0])void compile(event.dataTransfer.files[0]);},{signal:abort.signal});
  find('[data-change-image]').addEventListener('click',()=>fileInput.click(),{signal:abort.signal});
  find('[data-character-bundle]').addEventListener('change',event=>{const file=event.target.files?.[0];event.target.value='';if(file)void run(async()=>install(await readCharacter25DFile(file)));},{signal:abort.signal});
  find('[data-character-export]').addEventListener('click',()=>{if(draft)downloadCharacter25D(draft);},{signal:abort.signal});
  find('[data-character-delete]').addEventListener('click',()=>void run(async()=>{if(draft)await deleteCharacter25DDraft(draft.id);draft=null;preview.clearCharacter();delete host.dataset.actorReady;render();status('キャラ画像を1枚入れてください');}),{signal:abort.signal});
  find('[data-swap-views]').addEventListener('click',()=>void run(async()=>{if(draft?.appearance)await install(await reassociateCharacter25D(draft,{side:'back',back:'side'}));}),{signal:abort.signal});
  find('[data-open-legacy]').addEventListener('click',event=>{mountShino25dWorkshop(lab);const old=section.parentElement.querySelector('.shino25d-workshop');if(old)find('[data-legacy-tools]').append(old);event.target.remove();},{once:true,signal:abort.signal});
  function targetURL() {const url=new URL(REVIEW_DEV.rinne);if(['localhost','127.0.0.1'].includes(location.hostname)){url.protocol=location.protocol;url.hostname=location.hostname;url.port=location.port==='5276'?'5273':'5173';url.pathname='/';}return url;}
  find('[data-rinne]').addEventListener('click',()=>{
    if(!draft||busy)return;const url=targetURL(),token=crypto.randomUUID();url.searchParams.set('character25d','actor');url.searchParams.set('spriteTransfer',token);
    const target=window.open(url.href,'rinne-character25d');if(!target){status('RINNEを開くポップアップを許可してください');return;}
    clearTimeout(expiry);pending={target,token,origin:url.origin,bundle:structuredClone(draft)};expiry=setTimeout(()=>{pending=null;status('転送を終了しました。再度「RINNEで確認」で開けます');},90000);status('RINNEへ素材を転送しています');
  },{signal:abort.signal});
  window.addEventListener('message',event=>{if(!pending||event.source!==pending.target||event.origin!==pending.origin||event.data?.token!==pending.token)return;
    if(event.data.type==='rinne.character25d.ready')pending.target.postMessage({type:'rinne.character25d.transfer',token:pending.token,bundle:pending.bundle},pending.origin);
    if(event.data.type==='rinne.character25d.received'){clearTimeout(expiry);pending=null;status('RINNEへ転送しました。村で追従するActorを確認できます');}
    if(event.data.type==='rinne.character25d.rejected'){clearTimeout(expiry);pending=null;status('転送できませんでした。'+String(event.data.message||''));}
  },{signal:abort.signal});
  void run(async()=>{const saved=await loadCharacter25DDraft();if(saved)await install(saved,{save:false});});
  addEventListener('pagehide',()=>{disposed=true;abort.abort();clearTimeout(expiry);pending=null;},{once:true});
}
