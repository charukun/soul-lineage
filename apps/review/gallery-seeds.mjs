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
  Object.freeze({id:'ref:library.villager-growth',title:'村人の成長譚',note:'幼少期から青年までのキャラクターデザイン案',game:'rinne',kind:'character',media:'/gallery-library/villager-growth.webp',source:'existing',createdAt:null}),
  Object.freeze({id:'ref:library.village-girl-growth',title:'村娘の成長譜',note:'4歳から18歳までのキャラクターデザイン案',game:'rinne',kind:'character',media:'/gallery-library/village-girl-growth.webp',source:'existing',createdAt:null}),
  Object.freeze({id:'ref:library.redhair-lowpoly-growth',title:'赤毛の少女・ローポリ成長シート',note:'年齢差と多方向のシルエット案',game:'rinne',kind:'character',media:'/gallery-library/redhair-lowpoly-growth.webp',source:'existing',createdAt:null}),
  Object.freeze({id:'ref:library.herbalist-growth',title:'赤毛の薬草師・成長姿',note:'薬草師の成長・衣装・小物の案',game:'rinne',kind:'character',media:'/gallery-library/herbalist-growth.webp',source:'existing',createdAt:null}),
  Object.freeze({id:'ref:library.chibi-boy-growth',title:'少年ちびキャラ・成長コンセプト',note:'年齢差と正面・側面・背面の案',game:'rinne',kind:'character',media:'/gallery-library/chibi-boy-growth.webp',source:'existing',createdAt:null}),
  Object.freeze({id:'ref:library.village-inspiration',title:'百年をつなぐ、村の閃き',note:'村と成長を描くキービジュアル案',game:'shared',kind:'world',media:'/gallery-library/village-inspiration.webp',source:'existing',createdAt:null}),
  Object.freeze({id:'ref:library.village-play-concept',title:'アオの村：探索と戦闘',note:'実装前のプレイ画面イメージ',game:'rinne',kind:'scene',media:'/gallery-library/village-play-concept.webp',source:'existing',createdAt:null}),
  ...roles.map(([file,title,game])=>Object.freeze({
    id:`ref:npc.${file}.v1`,title,note:'既存のキャラクターリファレンス',game,kind:'character',
    media:RINNE+file+'.avif',source:'existing',createdAt:null,
  })),
  Object.freeze({id:'ref:protagonist-villager-v1',title:'主人公・村人',note:'既存の主人公候補サムネイル',game:'rinne',kind:'character',media:STUDIO+'protagonist-villager-v1.png',source:'existing',createdAt:null}),
  Object.freeze({id:'ref:protagonist-villager-female-v1',title:'主人公・村娘',note:'既存の主人公候補サムネイル',game:'rinne',kind:'character',media:STUDIO+'protagonist-villager-female-v1.png',source:'existing',createdAt:null}),
]);
