export const REVIEW_MOTION_CATEGORY_LABELS = Object.freeze({
  recommended: 'おすすめ',
  life: '生活',
  move: '移動',
  parkour: 'パルクール',
  combat: '戦闘',
  reaction: 'リアクション',
  other: 'その他',
  all: 'すべて'
});

const MOTION_NAME_EXACT_JA = Object.freeze({
  't_pose':'基準姿勢',
  'tpose':'基準姿勢',
  'a_t_pose':'基準姿勢',
  'a_tpose':'基準姿勢',
  'pick_up':'拾う',
  'use_item':'道具を使う',
  'spawn_air':'空中から出現',
  'spawn_ground':'地上から出現',
  'push_ups':'腕立て伏せ',
  'sit_ups':'腹筋',
  'tree_chopping_loop':'伐採・反復',
  'overhand_throw':'上手投げ',
  'lay_to_idle':'横になって待機',
  'climb_up_1_m_rm':'1メートル登る・移動あり',
  'parkour_urban_traversal':'パルクール・市街移動',
  'parkour_cartwheel':'パルクール・側転',
  'parkour_crawl_forward':'パルクール・前方へ這う',
  'parkour_crawl_backward':'パルクール・後方へ這う'
});

const MOTION_NAME_TOKEN_JA = Object.freeze({
  melee:'近接',ranged:'遠距離',attack:'攻撃',chop:'振り下ろし',chopping:'振り下ろし',
  jump:'跳ぶ',slice:'斬り',diagonal:'斜め',horizontal:'横薙ぎ',stab:'突き',spin:'回転',spinning:'回転',
  idle:'待機',block:'防御',blocking:'防御姿勢',dualwield:'二刀',unarmed:'素手',kick:'蹴り',punch:'拳',
  aiming:'狙い',aim:'狙い',reload:'装填',shoot:'射撃',shooting:'射撃',bow:'弓',draw:'引き絞る',
  release:'放つ',magic:'魔法',raise:'構える',spellcasting:'詠唱',spell:'魔法',cast:'詠唱',summon:'召喚',
  death:'倒れる',defeat:'倒れる',hit:'被弾',hurt:'負傷',interact:'調べる',pickup:'拾う',pick:'拾う',
  spawn:'出現',air:'空中',ground:'地上',throw:'投げる',use:'使う',item:'道具',
  crawling:'這う',crawl:'這う',crouching:'しゃがむ',crouch:'しゃがむ',dodge:'回避',
  backward:'後方',backwards:'後方',forward:'前方',fwd:'前方',left:'左',right:'右',
  running:'走る',run:'走る',walking:'歩く',walk:'歩く',holding:'持つ',strafe:'横移動',sneaking:'忍び歩き',
  full:'全身',long:'長め',longer:'長め',short:'短め',land:'着地',start:'開始',
  cheering:'歓声',cheer:'歓声',lie:'横になる',lay:'横になる',down:'下',stand:'立つ',standing:'立つ',
  push:'押す',sit:'座る',sitting:'座る',chair:'椅子',floor:'床',waving:'手を振る',wave:'手を振る',
  skeletons:'骸骨',awaken:'起き上がる',resurrect:'復活',inactive:'休眠',taunt:'挑発',
  fishing:'釣り',fish:'釣り',bite:'食いつき',catch:'釣り上げ',reeling:'巻き取り',struggling:'抵抗',tug:'引く',
  hammer:'金槌',hammering:'金槌を振る',lockpick:'鍵開け',lockpicking:'鍵開け',pickaxe:'つるはし',
  pickaxing:'つるはしを振る',saw:'鋸',sawing:'鋸を引く',work:'作業',working:'作業',
  dance:'踊る',driving:'運転',fixing:'修理',kneeling:'ひざまずく',chest:'胸',head:'頭',talking:'話す',
  torch:'松明',jog:'軽く走る',table:'台',pistol:'拳銃',cross:'クロス',jab:'ジャブ',roll:'回転',
  enter:'入る',exit:'出る',simple:'基本',sprint:'全力疾走',swim:'泳ぐ',sword:'剣',formal:'丁寧',
  open:'開ける',climb:'登る',consume:'飲食',farm:'農作業',harvest:'収穫',plant:'植える',seed:'種',
  watering:'水やり',knockback:'吹き飛び',fold:'組む',arms:'腕',lantern:'ランタン',rail:'手すり',
  call:'呼ぶ',shield:'盾',break:'崩し',hook:'フック',ninja:'忍者',slide:'滑り込み',regular:'通常',
  combo:'連続',tree:'木',carry:'運ぶ',yes:'うなずく',zombie:'ゾンビ',scratch:'引っかく',
  parkour:'パルクール',hop:'小跳び',leap:'大跳び',urban:'市街',traversal:'移動',cartwheel:'側転',
  turn:'旋回',observe:'見る',point:'指さす',clap:'拍手',clean:'掃除',drink:'飲む',eat:'食べる',
  sleep:'眠る',wake:'起きる',greet:'挨拶',speak:'話す',fear:'怯える',laugh:'笑う',angry:'怒る',
  surprised:'驚く',surprise:'驚く',startle:'驚く',apologize:'謝る',confused:'戸惑う',tired:'疲れる',
  exhausted:'疲労',stagger:'よろめく',knock:'吹き飛ぶ',guard:'構える',parry:'受け流し',slash:'斬撃',
  thrust:'突き',axe:'斧',spear:'槍',staff:'杖',one:'1',shot:'一撃',rec:'戻り',rm:'移動あり',
  loop:'反復',pose:'姿勢',no:'単発',experimental:'試験',medium:'中型',transform:'変身'
});

const normalizeMotionNameKey=value=>String(value||'').trim()
  .replace(/([a-z0-9])([A-Z])/g,'$1_$2')
  .replace(/([A-Za-z])(\d)/g,'$1_$2')
  .replace(/(\d)([A-Za-z])/g,'$1_$2')
  .replace(/[^A-Za-z0-9]+/g,'_')
  .replace(/^_+|_+$/g,'')
  .toLowerCase();

export function reviewMotionDisplayName(name='',index=0){
  const key=normalizeMotionNameKey(name);
  if(MOTION_NAME_EXACT_JA[key])return MOTION_NAME_EXACT_JA[key];
  const tokens=key.split('_').filter(Boolean),parts=[];let translated=false;
  for(let i=0;i<tokens.length;i++){
    const token=tokens[i],next=tokens[i+1];
    if((token==='1'||token==='2')&&next==='h'){
      parts.push(token==='1'?'片手':'両手');translated=true;i++;continue;
    }
    if(token==='a'||token==='b'||token==='c'||token==='d'){
      parts.push(String({a:1,b:2,c:3,d:4}[token]));translated=true;continue;
    }
    if(/^\d+$/.test(token)){parts.push(token);continue;}
    const label=MOTION_NAME_TOKEN_JA[token];
    if(label){parts.push(label);translated=true;}
  }
  if(!translated)return `動作${String(Math.max(0,Number(index)||0)+1).padStart(2,'0')}`;
  return parts.filter((part,i,rows)=>i===0||part!==rows[i-1]).join('・');
}

const CATEGORY_RULES = Object.freeze([
  ['reaction', /surpris|startle|fear|hurt|angry|laugh|cheer|apolog|confus|tired|exhaust|look.?around|(^|[_\s-])(hit|death|defeat|spawn|knock|stagger|yes|taunt)([_\s-]|$)/i],
  ['life', /idle|talk|speak|greet|wave|sit|stand|lie|lay|sleep|wake|interact|pick.?up|pickup|hold|throw|use.?item|work|clean|fix|drink|eat|consume|fish|dig|observe|point|clap|torch|push|farm|harvest|plant|water|lantern|lockpick|pickaxe|saw|chest/i],
  ['combat', /attack|melee|sword|spear|axe|hammer|bow|shoot|aim|reload|spell|cast|summon|parry|slash|thrust|chop|combo|guard|block|punch|kick|shield|scratch/i],
  ['parkour', /parkour|climb(?:up)?|ninjajump|slide|cartwheel|vault|mantle|wall.?run/i],
  ['move', /walk|jog|run|sprint|jump|land|hop|roll|dash|dodge|crawl|sneak|crouch|climb|strafe|turn|backward|step|swim|slide/i]
]);

const RECOMMENDATION_RULES = Object.freeze({
  life: Object.freeze([/(^|[_\s-])idle([_\s-]|$)/i,/talk|speak/i,/interact/i,/pick.?up|pickup/i,/wave|greet/i,/sit|lie|lay/i,/farm|fish|dig|hammer|pickaxe|saw|work|fix/i,/drink|eat|consume/i]),
  move: Object.freeze([/walk/i,/jog|run/i,/sprint/i,/jump/i,/crouch/i,/sneak|crawl/i,/roll|dodge/i,/strafe/i]),
  parkour: Object.freeze([/climb|vault|mantle/i,/ninjajump|jump|leap|hop/i,/slide|crawl|crouch/i,/cartwheel|wall.?run/i,/turn/i]),
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
      displayName:reviewMotionDisplayName(name,index),
      duration:finiteDuration(clip?.duration),category,
      recommendationRank:recommendationRank(name,category),recommended:false
    };
  });
  for(const category of ['life','move','parkour','combat','reaction']){
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
