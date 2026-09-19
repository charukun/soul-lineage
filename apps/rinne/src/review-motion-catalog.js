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
  ['reaction', /surpris|startle|fear|hurt|angry|laugh|cheer|apolog|confus|tired|exhaust|look.?around|(^|[_\s-])(hit|death|defeat|spawn|knock|stagger|yes|taunt)([_\s-]|$)/i],
  ['life', /idle|talk|speak|greet|wave|sit|stand|lie|lay|sleep|wake|interact|pick.?up|pickup|hold|throw|use.?item|work|clean|fix|drink|eat|consume|fish|dig|observe|point|clap|torch|push|farm|harvest|plant|water|lantern|lockpick|pickaxe|saw|chest/i],
  ['combat', /attack|melee|sword|spear|axe|hammer|bow|shoot|aim|reload|spell|cast|summon|parry|slash|thrust|chop|combo|guard|block|punch|kick|shield|scratch/i],
  ['move', /walk|jog|run|sprint|jump|land|hop|roll|dash|dodge|crawl|sneak|crouch|climb|strafe|turn|backward|step|swim|slide/i]
]);

const RECOMMENDATION_RULES = Object.freeze({
  life: Object.freeze([/(^|[_\s-])idle([_\s-]|$)/i,/talk|speak/i,/interact/i,/pick.?up|pickup/i,/wave|greet/i,/sit|lie|lay/i,/farm|fish|dig|hammer|pickaxe|saw|work|fix/i,/drink|eat|consume/i]),
  move: Object.freeze([/walk/i,/jog|run/i,/sprint/i,/jump/i,/crouch/i,/sneak|crawl/i,/roll|dodge/i,/climb|strafe/i]),
  combat: Object.freeze([/sword.*attack|1h.*attack|attack.*1h|one.?hand.*attack/i,/heavy.*attack/i,/combo/i,/block|parry|guard/i,/2h.*attack|attack.*2h|two.?hand.*attack/i,/spear|thrust/i,/bow|shoot/i,/spell|cast/i,/punch/i,/attack/i]),
  reaction: Object.freeze([/hit/i,/death|defeat/i,/hurt|stagger|knock/i,/surpris|startle/i,/fear/i,/cheer|laugh/i])
});
const finiteDuration=value=>Number.isFinite(Number(value))&&Number(value)>0?Number(value):0;
export function classifyReviewMotion(name='') {
  const normalized=String(name).trim();
  if(/farm|fish|tree.?chopp|(^|[_ -])(dig|digging|pickaxe|pickaxing|saw|sawing|work|working|hammer|hammering)([_ -]|$)/i.test(normalized)) return 'life';
  for(const [category,rule] of CATEGORY_RULES) if(rule.test(normalized)) return category;
  return 'other';
}
function recommendationRank(name,category){
  const rules=RECOMMENDATION_RULES[category]||[];
  const index=rules.findIndex(rule=>rule.test(name));
  return index<0?Number.POSITIVE_INFINITY:index;
}
export function buildMotionReviewCatalog(clips=[], {perCategory=8}={}) {
  if(!Array.isArray(clips)) throw new Error('Motion clips must be an array');
  if(!Number.isSafeInteger(perCategory)||perCategory<1||perCategory>20) throw new Error('Invalid motion recommendation limit');
  const records=clips.map((clip,index)=>{
    const name=String(clip?.upstreamClipName||clip?.name||'').trim()||('Motion '+String(index+1).padStart(2,'0'));
    const category=clip?.category||classifyReviewMotion(name);
    return {
      ...clip,index:Number.isSafeInteger(clip?.index)?clip.index:index,name,
      duration:finiteDuration(clip?.duration),category,
      recommendationRank:recommendationRank(name,category),recommended:false
    };
  });
  for(const category of ['life','move','combat','reaction']){
    const candidates=records.filter(row=>row.category===category)
      .sort((a,b)=>a.recommendationRank-b.recommendationRank||a.name.localeCompare(b.name,'en'));
    for(const row of candidates.slice(0,perCategory)) row.recommended=true;
  }
  return Object.freeze(records.map(row=>Object.freeze({...row})));
}
export function filterMotionReviewCatalog(catalog=[],filter='recommended'){
  if(filter==='all') return catalog;
  if(filter==='recommended') return catalog.filter(row=>row.recommended);
  if(!Object.hasOwn(REVIEW_MOTION_CATEGORY_LABELS,filter)) throw new Error('Unknown motion review filter: '+filter);
  return catalog.filter(row=>row.category===filter);
}
