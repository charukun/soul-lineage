const RINNE='https://soul-lineage-rinne-dev.c-okamoto.workers.dev/reference/npc-role-set/';
const STUDIO='https://soul-lineage-character-studio-dev.c-okamoto.workers.dev/review/character-thumbnails/';

// Existing project references are linked from their published source; no manual upload or asset duplication.
const roles=[
  ['child-boy','少年','village'],
  ['child-girl','少女','village'],
  ['elderly-man','老人','village'],
  ['elderly-woman','老女','village'],
  ['guard','衛兵','shared'],
  ['knight','騎士','demon'],
  ['blacksmith','鍛冶師','village'],
  ['laborer','村の働き手','village'],
  ['hunter','狩人','shared'],
  ['arcanist','術師','demon'],
];

export const GALLERY_SEEDS=Object.freeze([
  ...roles.map(([file,title,game])=>Object.freeze({
    id:`ref:npc.${file}.v1`,title,note:'既存のキャラクターリファレンス',game,kind:'character',
    media:RINNE+file+'.avif',source:'existing',createdAt:null,
  })),
  Object.freeze({id:'ref:protagonist-villager-v1',title:'主人公・村人',note:'既存の主人公候補サムネイル',game:'rinne',kind:'character',media:STUDIO+'protagonist-villager-v1.png',source:'existing',createdAt:null}),
  Object.freeze({id:'ref:protagonist-villager-female-v1',title:'主人公・村娘',note:'既存の主人公候補サムネイル',game:'rinne',kind:'character',media:STUDIO+'protagonist-villager-female-v1.png',source:'existing',createdAt:null}),
]);
