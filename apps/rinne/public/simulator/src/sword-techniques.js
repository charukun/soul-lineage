/** Reusable technique recipes: three basic actions per art, three arts per loadout.
 * Field names match the game's technique recipes; no 30-second pose keys live here.
 */
export const SWORD_TECHNIQUES=Object.freeze({
 jo:Object.freeze({id:'sword-gale-opening',name:'疾風の入り',type:'normal',weapon:'sword',element:'steel',aura:'none',rhythm:'flow',tempo:1,charge:'none',recovery:'normal',steps:Object.freeze([
  {kind:'dash',footwork:'rush',charge:'none'}, {kind:'slash',footwork:'forward',charge:'none'}, {kind:'back',footwork:'orbitL',charge:'none'},
 ])}),
 ha:Object.freeze({id:'sword-earth-sky',name:'地を払い、天へ返す',type:'normal',weapon:'sword',element:'steel',aura:'none',rhythm:'flow',tempo:1,charge:'breath',recovery:'normal',steps:Object.freeze([
  {kind:'sweep',footwork:'sideL',charge:'none'}, {kind:'uppercut',footwork:'forward',charge:'none'}, {kind:'round',footwork:'spiral',charge:'none'},
 ])}),
 kyu:Object.freeze({id:'sword-swallow-finish',name:'飛燕の締め',type:'normal',weapon:'sword',element:'steel',aura:'none',rhythm:'weight',tempo:1,charge:'breath',recovery:'long',steps:Object.freeze([
  {kind:'leap',footwork:'jump',charge:'none'}, {kind:'thrust',footwork:'chase',charge:'none'}, {kind:'heavy',footwork:'forward',charge:'none'},
 ])}),
});
// Alternate selections exercise the same basic actions in different neighbours.
// Keeping each recipe at three actions mirrors the game's technique slots.
export const SWORD_LOADOUTS=Object.freeze([
 SWORD_TECHNIQUES,
 Object.freeze({jo:{...SWORD_TECHNIQUES.jo,name:'低く切り込む',steps:[{kind:'slash',footwork:'forward'},{kind:'dash',footwork:'rush'},{kind:'sweep',footwork:'sideL'}]},ha:{...SWORD_TECHNIQUES.ha,name:'返しの旋風',steps:[{kind:'back',footwork:'orbitL'},{kind:'round',footwork:'spiral'},{kind:'uppercut',footwork:'forward'}]},kyu:{...SWORD_TECHNIQUES.kyu,name:'貫いて飛燕',steps:[{kind:'thrust',footwork:'chase'},{kind:'leap',footwork:'jump'},{kind:'heavy',footwork:'forward'}]}}),
 Object.freeze({jo:{...SWORD_TECHNIQUES.jo,name:'疾風の返し',steps:[{kind:'dash',footwork:'rush'},{kind:'back',footwork:'orbitL'},{kind:'slash',footwork:'forward'}]},ha:{...SWORD_TECHNIQUES.ha,name:'地旋の斬り上げ',steps:[{kind:'sweep',footwork:'sideL'},{kind:'round',footwork:'spiral'},{kind:'uppercut',footwork:'forward'}]},kyu:{...SWORD_TECHNIQUES.kyu,name:'飛燕・旋風の大太刀',steps:[{kind:'leap',footwork:'jump'},{kind:'round',footwork:'spiral'},{kind:'heavy',footwork:'forward'}]}}),
]);
