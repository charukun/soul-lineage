import { createCharacterWorkspace, downloadWorkspace } from './character-workspace.js';
import { MAX_WORKSPACE_BYTES } from './character-workspace-state.js';
const review = window.masterCharacterReview;
if (review?.session) {
  const workspace = createCharacterWorkspace(review); window.characterStudio = { review, workspace };
  const el = id => document.getElementById(id);
  const message = text => { el('status').textContent = text; };
  el('export').textContent = '編集データを保存（顔・髪・服を含む）';
  el('export').addEventListener('click', event => {
    event.preventDefault(); event.stopImmediatePropagation();
    try { workspace.save(); downloadWorkspace(workspace.snapshot()); } catch (error) { message(error.message); }
  }, true);
  let sequence = 0;
  el('session-file').addEventListener('change', async event => {
    event.stopImmediatePropagation(); const file = el('session-file').files[0], current = ++sequence;
    if (!file) return;
    try {
      if (!review.ready) throw new Error('モデルの読み込み後に取り込んでください');
      if (file.size > MAX_WORKSPACE_BYTES) throw new Error('編集データが大きすぎます');
      const text = await file.text(); if (current !== sequence) return;
      workspace.import(text); message('編集データを読み込みました。顔・髪・服も引き継ぎます。');
    } catch (error) { message(error.message); }
    finally { el('session-file').value = ''; }
  }, true);
  // Destructive cohort commands require deliberate confirmation, unlike view changes.
  for (const id of ['regenerate', 'next-seed']) el(id).addEventListener('click', event => {
    if (!confirm('個体群を再生成します。個別の編集は置き換わります。続けますか？')) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  el('note').addEventListener('input', workspace.save);
}
