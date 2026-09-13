// Appearance selection is independent of the earned combat form and memories.
export const PLAYABLE_CHARACTERS = Object.freeze([
  Object.freeze({id:'night-creature',name:'夜の魔物',detail:'喰らった記憶で変わる、異形の肉体。',glyph:'◈'}),
  // Keep the legacy save id so existing profiles continue to resolve after the character was canonically named.
  Object.freeze({id:'silver-reaper',referenceId:'kirishiro-shizuha',name:'霧白静刃',detail:'銀白の長髪、黒衣を揺らす大鎌の狩り手。',glyph:'☾'}),
]);
export function playableCharacter(profile) {
  return PLAYABLE_CHARACTERS.find(row=>row.id===profile?.character) || PLAYABLE_CHARACTERS[0];
}
export function selectCharacter(store,id) {
  if(!PLAYABLE_CHARACTERS.some(row=>row.id===id))throw new Error('その姿は選べません。');
  store.change(profile=>{profile.character=id;});
}
