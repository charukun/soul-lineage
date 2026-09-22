import {ACTIONS,DIRECTIONS,REFERENCE_VIEWS,createShinoDraft,assertSprite25dManifest,pruneSprite25dAssets,sprite25dCoverage} from '@soul/assets/sprite25d';
import {spriteAssetBlob,importSpriteAsset,validateSprite25dAtlas,cropSpriteReference,readSprite25dFile,loadSprite25dDraft,saveSprite25dDraft,deleteSprite25dDraft,downloadSprite25dDraft} from '@soul/assets/sprite25d/browser';
import {REVIEW_DEV} from './review-lab-config.js';
import './shino25d-workshop.css';
const VIEW_NAMES={sheet:'基準シート全体',front:'正面',quarter:'斜め前',side:'側面',back:'背面'};
const DIRECTION_NAMES={s:'正面',sw:'左斜め前',w:'左側面',nw:'左斜め後',n:'背面',ne:'右斜め後',e:'右側面',se:'右斜め前'};
const playable=draft=>Boolean(draft.pose||ACTIONS.some(a=>DIRECTIONS.some(d=>draft.animations[a][d])));

export function mountShino25dWorkshop(lab){
  if(!lab)return;
  const {section,preview}=lab,host=document.createElement('section');host.className='lab-section shino25d-workshop';
  host.innerHTML=`<div class="section-head"><div><span>SHINO · LOCAL DRAFT</span><h2>しのちゃん素材工房</h2></div></div>
    <p>正本の絵を登録し、切り出した透過素材を上の共存ビューへ配置します。別人の代替画像・自動反転・未作成モーションの捏造はしません。</p>
    <output data-workshop-status role="status" aria-live="polite">正本画像は未登録です</output>
    <fieldset data-editor><legend>1 · 基準画を固定する</legend>
      <label>基準画の枠<select data-reference-view></select></label>
      <label>画像を登録<input data-reference-file type="file" accept="image/png,image/webp,image/jpeg"></label>
      <small data-reference-status></small><img data-reference-preview hidden alt="登録したしのちゃんの基準画">
      <p>同じ枠の正本は上書きしません。別の正本に変える場合は「端末の下書きを削除」で作り直してください。</p>
    </fieldset>
    <fieldset data-editor><legend>2 · 透過キャラ画像を作る</legend>
      <p>基準画を等倍で切り出します。白背景除去は任意で、服や髪の白も外周につながっていると消えるため、必ず元絵と比較してください。</p>
      <div class="shino25d-fields"><label>X<input data-crop="0" type="number" min="0" value="0"></label><label>Y<input data-crop="1" type="number" min="0" value="0"></label><label>幅<input data-crop="2" type="number" min="1" value="1"></label><label>高さ<input data-crop="3" type="number" min="1" value="1"></label></div>
      <label><input data-remove-white type="checkbox">外周につながる白だけ透明化</label><button data-crop-pose type="button">切り出して共存ビューへ</button>
      <label>または、完成済みの透過キャラ画像<input data-pose-file type="file" accept="image/png,image/webp"></label>
    </fieldset>
    <fieldset data-editor><legend>3 · 8方向 / Idle / Walk</legend>
      <p>1枚につき8行、各行を同じサイズのフレームに分割。行順は S / SW / W / NW / N / NE / E / SE。足元・余白を全セルでそろえてください。</p>
      <div class="shino25d-fields"><label>動作<select data-atlas-action><option value="idle">Idle</option><option value="walk">Walk</option></select></label><label>横のフレーム数<input data-columns type="number" min="1" max="32" value="4"></label><label>FPS<input data-fps type="number" min="1" max="24" value="8"></label></div>
      <label>透過スプライトシート<input data-atlas-file type="file" accept="image/png,image/webp"></label>
      <div data-coverage class="shino25d-coverage" aria-label="方向と動作の登録状況"></div>
      <div class="shino25d-fields"><label>再生<select data-play-action><option value="idle">Idle</option><option value="walk">Walk</option></select></label><label>向き<select data-play-direction><option value="">カメラに連動</option></select></label></div>
      <output data-play-status aria-live="off"></output>
      <div class="shino25d-fields"><label>身長(m)<input data-height type="number" min=".3" max="3" step=".01" value="1.72"></label><label>接地点X(0–1)<input data-pivot="0" type="number" min="0" max="1" step=".01" value=".5"></label><label>接地点Y(0–1)<input data-pivot="1" type="number" min="0" max="1" step=".01" value="1"></label></div>
      <button data-render-settings type="button">接地・高さを適用</button>
    </fieldset>
    <fieldset data-editor><legend>4 · 保存してRINNEへ</legend>
      <label>bundleを読み込む<input data-bundle-file type="file" accept="application/json,.json"></label>
      <button data-export-pose type="button">透過画像を書き出す</button><button data-export type="button">素材＋manifestを書き出す</button><button data-reset type="button">端末の下書きを削除</button>
      <a data-rinne-link target="_blank" rel="noopener">RINNEに仮登場</a>
      <p>書き出した shino.character25d.json をRINNE側で選択します。アプリ間で端末保存は共有されません。画像は外部へ送信しません。</p>
      <small>すべて local-draft。顔・衣装の一致と権利は未承認です。本番配信・RUNTIME_READY・3D完成には昇格しません。</small>
    </fieldset>`;
  section.after(host);
  const find=selector=>host.querySelector(selector),status=find('[data-workshop-status]');
  const setStatus=text=>{status.textContent=text;};
  for(const view of REFERENCE_VIEWS){const option=document.createElement('option');option.value=view;option.textContent=VIEW_NAMES[view];find('[data-reference-view]').append(option);}
  for(const direction of DIRECTIONS){const option=document.createElement('option');option.value=direction;option.textContent=DIRECTION_NAMES[direction];find('[data-play-direction]').append(option);}
  const gameURL=new URL(REVIEW_DEV.rinne);gameURL.searchParams.set('character25d','shino');find('[data-rinne-link]').href=gameURL.href;
  let draft=createShinoDraft(),busy=false,disposed=false,timer=0;
  const syncPlayback=()=>preview.setSpritePreview(find('[data-play-action]').value,find('[data-play-direction]').value||null);
  function showReference(){
    const hash=draft.references[find('[data-reference-view]').value],asset=draft.assets[hash],image=find('[data-reference-preview]');image.hidden=!asset;
    if(asset){image.src=asset.dataUrl;find('[data-reference-status]').textContent=`${asset.name} · ${asset.width}×${asset.height} · SHA-256 ${asset.sha256}`;for(const input of host.querySelectorAll('[data-crop]'))input.value=String([0,0,asset.width,asset.height][Number(input.dataset.crop)]);}
    else{image.removeAttribute('src');find('[data-reference-status]').textContent='この枠は未登録です';}
  }
  function render(){
    showReference();find('[data-coverage]').replaceChildren();
    for(const action of ACTIONS)for(const direction of DIRECTIONS){const cell=document.createElement('span');cell.textContent=`${action==='idle'?'Idle':'Walk'} ${direction.toUpperCase()} ${draft.animations[action][direction]?'登録済':'未登録'}`;cell.dataset.registered=String(Boolean(draft.animations[action][direction]));find('[data-coverage]').append(cell);}
    find('[data-height]').value=String(draft.render.height);for(const input of host.querySelectorAll('[data-pivot]'))input.value=String(draft.render.pivot[Number(input.dataset.pivot)]);
  }
  async function commit(next,message){
    pruneSprite25dAssets(next);assertSprite25dManifest(next);
    if(playable(next))await preview.setCharacter(next);else preview.clearCharacter();
    if(disposed)return;
    draft=next;render();syncPlayback();
    const counts=sprite25dCoverage(draft);let suffix=`Idle ${counts.idle}/8 · Walk ${counts.walk}/8`;
    try{await saveSprite25dDraft(draft);suffix+=' · この端末に保存済み';}catch(error){suffix+=` · ${error.message}`;}
    setStatus(`${message} · ${suffix}`);
  }
  async function run(work){
    if(busy||disposed)return;busy=true;for(const fieldset of host.querySelectorAll('[data-editor]'))fieldset.disabled=true;setStatus('素材を処理しています');
    try{await work();}catch(error){if(!disposed)setStatus(error.message||'素材処理に失敗しました');}
    finally{busy=false;if(!disposed)for(const fieldset of host.querySelectorAll('[data-editor]'))fieldset.disabled=false;}
  }
  const handleFile=(selector,handler)=>find(selector).addEventListener('change',event=>{const file=event.currentTarget.files?.[0];event.currentTarget.value='';if(file)void run(()=>handler(file));});
  handleFile('[data-reference-file]',async file=>{
    const view=find('[data-reference-view]').value;if(draft.references[view])throw new Error('この正本は固定済みです。別の枠を選ぶか下書きを削除してください');
    const asset=await importSpriteAsset(file),next=structuredClone(draft);next.assets[asset.sha256] ||= asset;next.references[view]=asset.sha256;await commit(next,'基準画を登録しました。透過素材を指定してください');
  });
  async function installPose(asset){if(asset.width<8||asset.height<8)throw new Error('透過素材は8×8以上にしてください');if(!asset.hasTransparency)throw new Error('背景が不透明です。透過素材または外周の白背景除去を使用してください');const next=structuredClone(draft);next.assets[asset.sha256] ||= asset;next.pose=asset.sha256;await commit(next,'透過キャラ画像を共存ビューへ配置しました');}
  handleFile('[data-pose-file]',async file=>installPose(await importSpriteAsset(file)));
  find('[data-crop-pose]').addEventListener('click',()=>void run(async()=>{
    const source=draft.assets[draft.references[find('[data-reference-view]').value]];if(!source)throw new Error('切り出す基準画の枠を選んでください');
    const rect=[...host.querySelectorAll('[data-crop]')].map(input=>Number(input.value));await installPose(await cropSpriteReference(source,{rect,removeBorderWhite:find('[data-remove-white]').checked}));
  }));
  handleFile('[data-atlas-file]',async file=>{
    const asset=await importSpriteAsset(file),next=structuredClone(draft),action=find('[data-atlas-action]').value,columns=Number(find('[data-columns]').value),fps=Number(find('[data-fps]').value);next.assets[asset.sha256] ||= asset;
    await validateSprite25dAtlas(asset,columns);
    for(const [row,direction] of DIRECTIONS.entries())next.animations[action][direction]={asset:asset.sha256,columns,rows:8,row,fps};await commit(next,`${action}の8方向シートを登録しました`);
  });
  handleFile('[data-bundle-file]',async file=>commit(await readSprite25dFile(file),'bundleを読み込みました'));
  find('[data-reference-view]').addEventListener('change',showReference);
  find('[data-play-action]').addEventListener('change',syncPlayback);find('[data-play-direction]').addEventListener('change',syncPlayback);
  find('[data-render-settings]').addEventListener('click',()=>void run(async()=>{const next=structuredClone(draft);next.render={height:Number(find('[data-height]').value),pivot:[...host.querySelectorAll('[data-pivot]')].map(input=>Number(input.dataset.pivot)===0?Number(input.value):Number(input.value))};await commit(next,'接地・高さを更新しました');}));
  find('[data-export-pose]').addEventListener('click',()=>{
    const asset=draft.assets[draft.pose];if(!asset){setStatus('透過キャラ画像は未登録です');return;}
    const url=URL.createObjectURL(spriteAssetBlob(asset)),a=document.createElement('a');a.href=url;a.download='shino-pose.'+({"image/png":'png',"image/webp":'webp',"image/jpeg":'jpg'}[asset.mediaType]);a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  find('[data-export]').addEventListener('click',()=>{try{downloadSprite25dDraft(draft);setStatus('bundleを書き出しました。RINNE側で同じファイルを選んでください');}catch(error){setStatus(error.message);}});
  find('[data-reset]').addEventListener('click',()=>void run(async()=>{await deleteSprite25dDraft();draft=createShinoDraft();preview.clearCharacter();render();setStatus('端末の下書きを削除しました。正本画像は未登録です');}));
  render();
  void run(async()=>{const saved=await loadSprite25dDraft();if(saved)await commit(saved,'端末の下書きを復元しました');else setStatus('正本画像は未登録です。旧Shinoや既存主人公は代用しません');});
  timer=setInterval(()=>{if(!disposed)find('[data-play-status]').textContent=preview.getState().spriteStatus||'透過キャラ画像・スプライトは未登録です';},300);
  addEventListener('pagehide',()=>{disposed=true;clearInterval(timer);},{once:true});
}
