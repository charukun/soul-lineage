import {PLAYABLE_CHARACTERS,playableCharacter,selectCharacter} from '../characters.js';
import './character-selection.css';

export function openCharacterSelection({store,view,sheet,onSaved,onClose}) {
  let candidate=playableCharacter(store.read()).id,request=0,active=true;
  sheet('狩る姿を選ぶ','VESSEL OF THE NIGHT',`
    <div class="character-choices" role="group" aria-label="キャラクター">${PLAYABLE_CHARACTERS.map(c=>`
      <button class="character-choice" data-character="${c.id}" aria-pressed="${candidate===c.id}">
        <span aria-hidden="true">${c.glyph}</span><strong>${c.name}</strong><small>${c.detail}</small>
      </button>`).join('')}</div>
    <p id="character-status" role="status" aria-live="polite">姿を確認しています…</p>
    <div class="character-actions"><button id="character-turn" class="text-button">向きを変える</button><button id="character-confirm" class="primary" disabled>この姿で狩る</button></div>
    <p class="character-note">記憶と形態の力は、どちらの姿にも引き継がれる。</p>`,'characters');
  document.body.classList.add('choosing-character');view.characterPreview=true;view.characterPreviewYaw=0;
  const status=document.getElementById('character-status'),confirm=document.getElementById('character-confirm');
  const rows=[...document.querySelectorAll('[data-character]')];
  async function preview(id) {
    const ticket=++request;candidate=id;confirm.disabled=true;
    rows.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.character===id)));
    status.textContent=id==='silver-reaper'?'銀白の姿を呼び起こしています…':'姿を確認しています…';
    try {
      await view.prepareCharacter(id);
      if(!active||ticket!==request)return;
      view.previewCharacter=id;status.textContent=PLAYABLE_CHARACTERS.find(c=>c.id===id).name;
      confirm.disabled=false;
    } catch(error) {
      if(!active||ticket!==request)return;
      status.textContent='姿を読み込めませんでした。カードを押すと再試行できます。';
      console.warn('[character selection]',error);
    }
  }
  rows.forEach(b=>{b.onclick=()=>{void preview(b.dataset.character);};});
  document.getElementById('character-turn').onclick=()=>{view.characterPreviewYaw+=Math.PI/2;};
  confirm.onclick=()=>{
    if(confirm.disabled)return;
    try {selectCharacter(store,candidate);onSaved();onClose();}
    catch(error){status.textContent=error.message;}
  };
  void preview(candidate);
  return ()=>{active=false;request++;view.characterPreview=false;view.previewCharacter=null;document.body.classList.remove('choosing-character');};
}
