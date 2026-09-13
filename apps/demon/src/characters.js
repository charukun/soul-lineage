// Appearance selection is independent of the earned combat form and memories.
export const PLAYABLE_CHARACTERS = Object.freeze([
  Object.freeze({id:'night-creature',name:'夜の魔物',detail:'喰らった記憶で変わる、異形の肉体。',glyph:'◈'}),
  Object.freeze({id:'silver-reaper',referenceId:'video-character-001',name:'白銀の鎌姫',detail:'銀白の長髪、黒衣を揺らす大鎌の狩り手。',glyph:'☾'}),
]);
export function playableCharacter(profile) {
  return PLAYABLE_CHARACTERS.find(row=>row.id===profile?.character) || PLAYABLE_CHARACTERS[0];
}
export function selectCharacter(store,id) {
  if(!PLAYABLE_CHARACTERS.some(row=>row.id===id))throw new Error('その姿は選べません。');
  store.change(profile=>{profile.character=id;});
}
