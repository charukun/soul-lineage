import {ACTIONS,DIRECTIONS,REFERENCE_VIEWS,createShinoDraft,assertSprite25dManifest,pruneSprite25dAssets,sprite25dCoverage} from '@soul/assets/sprite25d';
import {spriteAssetBlob,importSpriteAsset,validateSprite25dAtlas,cropSpriteReference,readSprite25dFile,loadSprite25dDraft,saveSprite25dDraft,deleteSprite25dDraft,downloadSprite25dDraft} from '@soul/assets/sprite25d/browser';
import {autoPrepareCharacterSheet} from './shino25d-auto.js';
import {REVIEW_DEV} from './review-lab-config.js';
import './shino25d-workshop.css';

const VIEW_NAMES={sheet:'材料画像',front:'正面',quarter:'斜め前',side:'側面',back:'背面'};
const DIRECTION_NAMES={s:'正面',sw:'左斜め前',w:'左側面',nw:'左斜め後',n:'背面',ne:'右斜め後',e:'右側面',se:'右斜め前'};
const playable=draft=>Boolean(draft.pose||ACTIONS.some(action=>DIRECTIONS.some(direction=>draft.animations[action][direction])));

export function mountShino25dWorkshop(lab){
  if(!lab)return;
  const {section,preview}=lab,host=document.createElement('section');host.className='lab-section shino25d-workshop';
  host.innerHTML=`<div class="section-head"><div><span>CHARACTER AUTO PREP</span><h2>画像を1枚入れるだけ</h2></div><small>端末内で自動処理</small></div>
    <p class="shino25d-lead">作りたいキャラの材料画像を1枚入れてください。身体と手持ち武器を一緒に動かします。三面図なら側面・背面も自動抽出。正面だけの絵では他の向きは推定表示です。</p>
    <label class="shino25d-drop" data-drop tabindex="0">
      <input data-auto-file type="file" accept="image/png,image/webp,image/jpeg" hidden>
      <strong>キャラ画像を選ぶ</strong><span>またはここへドロップ</span><small>PNG / JPG / WEBP · キャラシート1枚でOK</small>
    </label>
    <output class="shino25d-auto-status" data-workshop-status role="status" aria-live="polite">画像を1枚入れると自動で始まります</output>
    <div class="shino25d-auto-results" data-auto-results hidden>
      <div class="shino25d-result-grid">
        <figure data-result="sheet"><img alt="材料画像"><figcaption>材料画像</figcaption></figure>
        <figure data-result="front"><img alt="正面候補"><figcaption>正面</figcaption></figure>
        <figure data-result="side"><img alt="側面候補"><figcaption>側面</figcaption></figure>
        <figure data-result="back"><img alt="背面候補"><figcaption>背面</figcaption></figure>
        <figure data-result="pose"><img alt="ゲーム表示用透過素材"><figcaption>ゲーム表示</figcaption></figure>
      </div>
      <div class="shino25d-primary-actions">
        <button data-show-preview type="button">共存ビューで見る</button>
        <button data-rinne-auto type="button">RINNEで仮登場</button>
        <button data-replace type="button" class="quiet">別の画像にする</button>
      </div>
    </div>
    <details class="shino25d-advanced" data-advanced>
      <summary>うまくいかない時だけ詳細調整</summary>
      <p>自動判定を直したい時だけ使います。通常はここを触る必要はありません。</p>
      <fieldset data-editor><legend>基準画</legend>
        <label>枠<select data-reference-view></select></label>
        <label>画像を登録<input data-reference-file type="file" accept="image/png,image/webp,image/jpeg"></label>
        <small data-reference-status></small><img data-reference-preview hidden alt="登録した基準画">
      </fieldset>
      <fieldset data-editor><legend>透過素材</legend>
        <div class="shino25d-fields"><label>X<input data-crop="0" type="number" min="0" value="0"></label><label>Y<input data-crop="1" type="number" min="0" value="0"></label><label>幅<input data-crop="2" type="number" min="1" value="1"></label><label>高さ<input data-crop="3" type="number" min="1" value="1"></label></div>
        <label><input data-remove-white type="checkbox">外周につながる白を透明化</label><button data-crop-pose type="button">切り出して共存ビューへ</button>
        <label>完成済み透過画像<input data-pose-file type="file" accept="image/png,image/webp"></label>
      </fieldset>
      <fieldset data-editor><legend>アニメーション素材（任意）</legend>
        <p>8行 S / SW / W / NW / N / NE / E / SE。未登録でも静止画でゲーム確認できます。</p>
        <div class="shino25d-fields"><label>動作<select data-atlas-action><option value="idle">Idle</option><option value="walk">Walk</option></select></label><label>横フレーム数<input data-columns type="number" min="1" max="32" value="4"></label><label>FPS<input data-fps type="number" min="1" max="24" value="8"></label></div>
        <label>透過スプライトシート<input data-atlas-file type="file" accept="image/png,image/webp"></label>
        <div data-coverage class="shino25d-coverage"></div>
        <div class="shino25d-fields"><label>再生<select data-play-action><option value="idle">Idle</option><option value="walk">Walk</option></select></label><label>向き<select data-play-direction><option value="">カメラに連動</option></select></label></div>
        <output data-play-status aria-live="off"></output>
        <div class="shino25d-fields"><label>身長(m)<input data-height type="number" min=".3" max="3" step=".01" value="1.72"></label><label>接地点X<input data-pivot="0" type="number" min="0" max="1" step=".01" value=".5"></label><label>接地点Y<input data-pivot="1" type="number" min="0" max="1" step=".01" value="1"></label></div>
        <button data-render-settings type="button">接地・高さを適用</button>
      </fieldset>
      <fieldset data-editor><legend>入出力</legend>
        <label>既存bundleを読み込む<input data-bundle-file type="file" accept="application/json,.json"></label>
        <button data-export-pose type="button">透過画像を書き出す</button><button data-export type="button">素材bundleを書き出す</button><button data-reset type="button">端末の下書きを削除</button>
      </fieldset>
      <small>local-draftのみ。顔・衣装・権利の本番承認やRUNTIME_READYには昇格しません。</small>
    </details>`;
  section.after(host);
  const find=selector=>host.querySelector(selector),status=find('[data-workshop-status]'),abort=new AbortController();
  const setStatus=text=>{status.textContent=text;};
  for(const view of REFERENCE_VIEWS){const option=document.createElement('option');option.value=view;option.textContent=VIEW_NAMES[view];find('[data-reference-view]').append(option);}
  for(const direction of DIRECTIONS){const option=document.createElement('option');option.value=direction;option.textContent=DIRECTION_NAMES[direction];find('[data-play-direction]').append(option);}
  let draft=createShinoDraft(),busy=false,disposed=false,timer=0,pendingTransfer=null;
  const syncPlayback=()=>preview.setSpritePreview(null,find('[data-play-direction]').value||null);

  function resultAsset(key){return key==='pose'?draft.assets[draft.pose]:draft.assets[draft.references[key]];}
  function renderAutoResults(){
    const results=find('[data-auto-results]'),hasAny=Boolean(draft.references.sheet||draft.pose);results.hidden=!hasAny;
    for(const key of ['sheet','front','side','back','pose']){
      const figure=find(`[data-result="${key}"]`),asset=resultAsset(key),image=figure.querySelector('img');figure.dataset.ready=String(Boolean(asset));
      if(asset){image.src=asset.dataUrl;image.hidden=false;}else{image.removeAttribute('src');image.hidden=true;}
    }
    find('[data-rinne-auto]').disabled=!playable(draft);
  }
  function showReference(){
    const hash=draft.references[find('[data-reference-view]').value],asset=draft.assets[hash],image=find('[data-reference-preview]');image.hidden=!asset;
    if(asset){image.src=asset.dataUrl;find('[data-reference-status]').textContent=`${asset.name} · ${asset.width}×${asset.height}`;for(const input of host.querySelectorAll('[data-crop]'))input.value=String([0,0,asset.width,asset.height][Number(input.dataset.crop)]);}
    else{image.removeAttribute('src');find('[data-reference-status]').textContent='未登録';}
  }
  function render(){
    renderAutoResults();showReference();find('[data-coverage]').replaceChildren();
    for(const action of ACTIONS)for(const direction of DIRECTIONS){const cell=document.createElement('span');cell.textContent=`${action==='idle'?'Idle':'Walk'} ${direction.toUpperCase()} ${draft.animations[action][direction]?'登録済':'未登録'}`;cell.dataset.registered=String(Boolean(draft.animations[action][direction]));find('[data-coverage]').append(cell);}
    find('[data-height]').value=String(draft.render.height);for(const input of host.querySelectorAll('[data-pivot]'))input.value=String(draft.render.pivot[Number(input.dataset.pivot)]);
  }
  async function commit(next,message){
    pruneSprite25dAssets(next);assertSprite25dManifest(next);
    if(playable(next))await preview.setCharacter(next);else preview.clearCharacter();
    if(disposed)return;draft=next;render();syncPlayback();
    const counts=sprite25dCoverage(draft);let suffix=`${draft.appearance?'Actor生成済み':`Idle ${counts.idle}/8 · Walk ${counts.walk}/8`}`;
    try{await saveSprite25dDraft(draft);suffix+=' · 端末に保存済み';}catch(error){suffix+=` · ${error.message}`;}
    setStatus(`${message} · ${suffix}`);
  }
  async function run(work,message='素材を自動処理しています…'){
    if(busy||disposed)return;busy=true;host.dataset.busy='true';for(const fieldset of host.querySelectorAll('[data-editor]'))fieldset.disabled=true;setStatus(message);
    try{await work();}catch(error){if(!disposed){console.error(error);setStatus(error.message||'素材処理に失敗しました');find('[data-advanced]').open=true;}}
    finally{busy=false;if(!disposed){host.dataset.busy='false';for(const fieldset of host.querySelectorAll('[data-editor]'))fieldset.disabled=false;}}
  }
  async function autoInstall(file){
    setStatus('画像を解析中… 正面・側面・背面とゲーム表示用素材を探しています');
    const prepared=await autoPrepareCharacterSheet(file),next=createShinoDraft();Object.assign(next.assets,prepared.assets);Object.assign(next.references,prepared.references);next.pose=prepared.pose;next.appearance=prepared.appearance;
    const quality=prepared.diagnostics.confidence==='high'?'3方向を自動検出しました':prepared.diagnostics.views===3?'3方向候補を抽出しました':'正面候補を自動抽出しました';
    await commit(next,`${quality}。共存ビューに反映しました`);
  }
  const handleFile=(selector,handler)=>find(selector).addEventListener('change',event=>{const file=event.currentTarget.files?.[0];event.currentTarget.value='';if(file)void run(()=>handler(file));},{signal:abort.signal});
  handleFile('[data-auto-file]',autoInstall);
  const drop=find('[data-drop]'),autoInput=find('[data-auto-file]');
  drop.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();autoInput.click();}},{signal:abort.signal});
  for(const type of ['dragenter','dragover'])drop.addEventListener(type,event=>{event.preventDefault();drop.dataset.drag='true';},{signal:abort.signal});
  for(const type of ['dragleave','drop'])drop.addEventListener(type,event=>{event.preventDefault();drop.dataset.drag='false';},{signal:abort.signal});
  drop.addEventListener('drop',event=>{const file=event.dataTransfer?.files?.[0];if(file)void run(()=>autoInstall(file));},{signal:abort.signal});
  find('[data-replace]').addEventListener('click',()=>autoInput.click(),{signal:abort.signal});
  find('[data-show-preview]').addEventListener('click',()=>section.scrollIntoView({behavior:'smooth',block:'start'}),{signal:abort.signal});

  find('[data-rinne-auto]').addEventListener('click',()=>{
    if(!playable(draft))return setStatus('先にキャラ画像を1枚入れてください');
    const token=crypto.randomUUID(),url=new URL(REVIEW_DEV.rinne);url.searchParams.set('character25d','shino');url.searchParams.set('spriteTransfer',token);
    const target=window.open(url.href,'rinne-shino-25d');if(!target)return setStatus('RINNEを開けませんでした。ポップアップ許可を確認してください');
    pendingTransfer={token,target};setStatus('RINNEを開いて素材を自動転送しています…');
  },{signal:abort.signal});
  window.addEventListener('message',event=>{
    if(!pendingTransfer||event.origin!==new URL(REVIEW_DEV.rinne).origin||event.source!==pendingTransfer.target)return;
    if(event.data?.type==='rinne.character25d.ready'&&event.data?.token===pendingTransfer.token){
      pendingTransfer.target.postMessage({type:'rinne.character25d.transfer',token:pendingTransfer.token,bundle:structuredClone(draft)},event.origin);
    }else if(event.data?.type==='rinne.character25d.received'&&event.data?.token===pendingTransfer.token){setStatus('RINNEへ転送しました。村で仮登場を確認できます');pendingTransfer=null;}
  },{signal:abort.signal});

  handleFile('[data-reference-file]',async file=>{const view=find('[data-reference-view]').value,asset=await importSpriteAsset(file),next=structuredClone(draft);next.assets[asset.sha256] ||= asset;next.references[view]=asset.sha256;await commit(next,'基準画を更新しました');});
  async function installPose(asset){if(asset.width<8||asset.height<8||!asset.hasTransparency)throw new Error('透過PNG/WebPを選んでください');const next=structuredClone(draft);next.assets[asset.sha256] ||= asset;next.pose=asset.sha256;delete next.appearance;await commit(next,'透過キャラ画像を更新しました');}
  handleFile('[data-pose-file]',async file=>installPose(await importSpriteAsset(file)));
  find('[data-crop-pose]').addEventListener('click',()=>void run(async()=>{const source=draft.assets[draft.references[find('[data-reference-view]').value]];if(!source)throw new Error('切り出す基準画を選んでください');const rect=[...host.querySelectorAll('[data-crop]')].map(input=>Number(input.value));await installPose(await cropSpriteReference(source,{rect,removeBorderWhite:find('[data-remove-white]').checked}));}),{signal:abort.signal});
  handleFile('[data-atlas-file]',async file=>{const asset=await importSpriteAsset(file),next=structuredClone(draft),action=find('[data-atlas-action]').value,columns=Number(find('[data-columns]').value),fps=Number(find('[data-fps]').value);next.assets[asset.sha256] ||= asset;await validateSprite25dAtlas(asset,columns);for(const [row,direction] of DIRECTIONS.entries())next.animations[action][direction]={asset:asset.sha256,columns,rows:8,row,fps};await commit(next,`${action}の8方向シートを登録しました`);});
  handleFile('[data-bundle-file]',async file=>commit(await readSprite25dFile(file),'bundleを読み込みました'));
  find('[data-reference-view]').addEventListener('change',showReference,{signal:abort.signal});find('[data-play-action]').addEventListener('change',syncPlayback,{signal:abort.signal});find('[data-play-direction]').addEventListener('change',syncPlayback,{signal:abort.signal});
  find('[data-render-settings]').addEventListener('click',()=>void run(async()=>{const next=structuredClone(draft);next.render={height:Number(find('[data-height]').value),pivot:[...host.querySelectorAll('[data-pivot]')].map(input=>Number(input.value))};await commit(next,'接地・高さを更新しました');}),{signal:abort.signal});
  find('[data-export-pose]').addEventListener('click',()=>{const asset=draft.assets[draft.pose];if(!asset)return setStatus('透過キャラ画像は未登録です');const url=URL.createObjectURL(spriteAssetBlob(asset)),a=document.createElement('a');a.href=url;a.download='character-pose.'+({'image/png':'png','image/webp':'webp','image/jpeg':'jpg'}[asset.mediaType]);a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},{signal:abort.signal});
  find('[data-export]').addEventListener('click',()=>{try{downloadSprite25dDraft(draft);setStatus('素材bundleを書き出しました');}catch(error){setStatus(error.message);}},{signal:abort.signal});
  find('[data-reset]').addEventListener('click',()=>void run(async()=>{await deleteSprite25dDraft();draft=createShinoDraft();preview.clearCharacter();render();setStatus('下書きを削除しました。新しい画像を1枚入れてください');}),{signal:abort.signal});
  render();
  void run(async()=>{const saved=await loadSprite25dDraft();if(saved)await commit(saved,'前回の下書きを復元しました');else setStatus('画像を1枚入れると自動で始まります');},'前回の下書きを確認しています…');
  timer=setInterval(()=>{if(!disposed)find('[data-play-status]').textContent=preview.getState().spriteStatus||'透過素材は未登録です';},350);
  const dispose=()=>{if(disposed)return;disposed=true;abort.abort();clearInterval(timer);};addEventListener('pagehide',dispose,{once:true});
}

