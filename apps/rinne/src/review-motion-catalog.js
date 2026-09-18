export const REVIEW_MOTION_CATEGORY_LABELS = Object.freeze({
  recommended: 'おすすめ',
  life: '生活',
  move: '移動',
  combat: '戦闘',
  reaction: 'リアクション',
  other: 'その他',
  all: 'すべて'
});

const CATEGORY_RULES = Object.freeze([
  ['reaction', /(^|[_\s-])(hit|death|defeat|spawn|hurt|knock)/i],
  ['combat', /attack|melee|block|shoot|aim|reload|spell|cast|parry|slash|thrust/i],
  ['move', /walk|run|jump|hop|roll|dash|dodge|crawl|sneak|crouch|climb|strafe|turn/i],
  ['life', /idle|interact|pick.?up|pickup|throw|cheer|wave|sit|lay|lying|dance|work|drink|eat|fish|hammer|dig|lockpick/i]
]);

const RECOMMENDATION_RULES = Object.freeze({
  life: Object.freeze([/(^|[_\s-])idle([_\s-]|$)/i,/interact/i,/pick.?up|pickup/i,/cheer/i,/wave/i,/sit/i,/lay|lying/i,/dance/i]),
  move: Object.freeze([/walk/i,/run/i,/jump|hop/i,/crouch/i,/sneak|crawl/i,/dodge|roll/i,/dash/i,/climb/i]),
  combat: Object.freeze([/1h.*attack|attack.*1h|one.?hand.*attack/i,/heavy.*attack/i,/combo/i,/block|parry/i,/2h.*attack|attack.*2h|two.?hand.*attack/i,/shoot|bow/i,/spell|cast/i,/attack/i]),
  reaction: Object.freeze([/hit/i,/death|defeat/i,/spawn/i,/hurt|knock/i])
});
const finiteDuration = value => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : 0;
export function classifyReviewMotion(name='') {
  const normalized=String(name).trim();
  for(const [category,rule] of CATEGORY_RULES) if(rule.test(normalized)) return category;
  return 'other';
}
function recommendationRank(name, category) {
  const rules=RECOMMENDATION_RULES[category] || [];
  const index=rules.findIndex(rule=>rule.test(name));
  return index < 0 ? Number.POSITIVE_INFINITY : index;
}
export function buildMotionReviewCatalog(clips=[], {perCategory=6}={}) {
  if(!Array.isArray(clips)) throw new Error('Motion clips must be an array');
  if(!Number.isSafeInteger(perCategory) || perCategory < 1 || perCategory > 12) throw new Error('Invalid motion recommendation limit');
  const records=clips.map((clip,index)=>{
    const name=String(clip?.name || '').trim() || ('Motion ' + String(index + 1).padStart(2,'0'));
    const category=classifyReviewMotion(name);
    return {index,name,duration:finiteDuration(clip?.duration),category,recommendationRank:recommendationRank(name,category),recommended:false};
  });
  for(const category of ['life','move','combat','reaction']) {
    const candidates=records.filter(row=>row.category===category).sort((a,b)=>a.recommendationRank-b.recommendationRank || a.name.localeCompare(b.name,'en'));
    for(const row of candidates.slice(0,perCategory)) row.recommended=true;
  }
  return Object.freeze(records.map(row=>Object.freeze({...row})));
}
export function filterMotionReviewCatalog(catalog=[], filter='recommended') {
  if(filter==='all') return catalog;
  if(filter==='recommended') return catalog.filter(row=>row.recommended);
  if(!Object.hasOwn(REVIEW_MOTION_CATEGORY_LABELS,filter)) throw new Error('Unknown motion review filter: ' + filter);
  return catalog.filter(row=>row.category===filter);
}
