import { INSPIRATION_MOTION_IDS } from './inspiration-catalog.js';
import { generatedTechniqueById, generatedTechniqueCandidates } from './technique-grammar.js';

export const causalInspirationRevision = 'causal-inspiration-1';
export const INSPIRATION_KINDS = Object.freeze({heart:'心',body:'体',technique:'技',link:'連',variant:'変'});
export const INSPIRATION_NAME_GRADES = Object.freeze({normal:'',secret:'秘技',ultimate:'奥義'});
export const INSPIRATION_ATTRIBUTE_LABELS = Object.freeze({fire:'炎',water:'水',ice:'氷',wind:'風',earth:'土',lightning:'雷',light:'光',dark:'闇'});
export const INSPIRATION_ATTRIBUTES = Object.freeze(Object.keys(INSPIRATION_ATTRIBUTE_LABELS));
const INSPIRATION_ATTRIBUTE_SET = new Set(INSPIRATION_ATTRIBUTES);
export const isInspirationAttribute=value=>typeof value==='string'&&INSPIRATION_ATTRIBUTE_SET.has(value);
export const normalizeInspirationAttributes=(values=[])=>[...new Set((Array.isArray(values)?values:[]).filter(isInspirationAttribute))];
export const INSPIRATION_TRAIT_IMPACTS = Object.freeze({cosmetic:'演出',status:'特性',rule:'固有'});
export const INSPIRATION_TRAIT_RARITIES = Object.freeze({common:'通常',rare:'希少',singular:'唯一'});

export function inspirationTechniqueStructureKey(row){
  if(!row)return '';
  return JSON.stringify([
    row.kind==='variant'?'technique':row.kind,
    [...(row.weapons||[])].sort(),
    (row.steps||[]).map(step=>[step.kind,step.footwork||'stay',step.charge||'none']),
    row.space||'',
    row.limbs||'',
    row.executor||'',
  ]);
}
export function inspirationTechniqueGrade(row){
  const rules=(row?.specialEffects||[]).filter(effect=>effect?.impact==='rule');
  if(!rules.length)return 'normal';
  return rules.some(effect=>effect.rarity==='singular'&&String(effect.unlockCondition||'').trim())?'ultimate':'secret';
}
export function inspirationTechniqueName(row){
  if(!row)return '';
  const base=String(row.name||'').replace(/[・･]/g,'').trim();
  const grade=INSPIRATION_NAME_GRADES[inspirationTechniqueGrade(row)];
  return grade?grade+'・'+base:base;
}
export function inspirationTechniquePresentation(row){
  return Object.freeze({
    name:inspirationTechniqueName(row),
    grade:inspirationTechniqueGrade(row),
    attributes:Object.freeze((row?.attributes||[]).map(id=>INSPIRATION_ATTRIBUTE_LABELS[id]||id)),
    traits:Object.freeze((row?.specialEffects||[]).map(effect=>effect.label||effect.id).filter(Boolean)),
  });
}
export const INSPIRATION_QUESTIONS = Object.freeze({
  balance:'崩れた姿勢を戻したい', fatigue:'息を残して動きたい', opening:'相手の隙を見つけたい',
  close:'懐へ入られた時に応じたい', reach:'届かない間合いを解きたい', crowd:'囲まれても出口を作りたい',
  guard:'受け止められた力を逃がしたい', recovery:'打ち終わりを無防備にしたくない',
  care:'無理をさせず支えたい', tool:'道具の重さを活かしたい', rhythm:'動作の間をつなぎたい',
  ammunition:'限られた矢を無駄にしたくない', line:'射線が開く瞬間を捉えたい',
});
const step=(kind,footwork='stay',charge='none')=>Object.freeze({kind,footwork,charge});
const define=row=>Object.freeze({
  weapons:[], windows:[], materials:[], phases:['jo','ha','kyu'], motifs:[], intent:{}, bodyAffinity:{},
  effort:1, effects:{}, attributes:[], faith:{}, specialEffects:[], ...row,
  steps:Object.freeze(row.steps||[]),
  questions:Object.freeze(row.questions||[]), materials:Object.freeze((row.materials||[]).map(group=>Object.freeze(group))),
  windows:Object.freeze(row.windows||[]), weapons:Object.freeze(row.weapons||[]),
  motifs:Object.freeze(row.motifs||[]), phases:Object.freeze(row.phases||['jo','ha','kyu']), attributes:Object.freeze(row.attributes||[]), faith:Object.freeze({...row.faith}), specialEffects:Object.freeze((row.specialEffects||[]).map(effect=>Object.freeze({...effect}))),
});

// Authored answers, not animation assets or loot. Acquisition belongs to the life domain.
// A signature ignores naming, cosmetic media, playback speed and scalar damage.
export const CAUSAL_ANSWERS = Object.freeze([
  define({id:'skill.balance',name:'軸取り',kind:'body',family:'body.axis',questions:['balance'],
    materials:[['balance'],['handling','observation']],windows:['balance','play','practice','voyage'],motifs:['balance'],
    mechanic:'足場に合わせて重心を落とし、受けの構えを選べる。',tradeoff:'低い構えでは追い足が小さくなる。',bodyChoice:{kind:'stance',id:'chinshin'},effects:{mitigation:.05},intent:{guard:.4}}),
  define({id:'skill.recovery-breath',name:'息継ぎ',kind:'body',family:'body.breath',questions:['fatigue'],
    materials:[['breath'],['patience','handling']],windows:['rest','breathe','practice'],motifs:['breath','return'],
    mechanic:'打ち終わりに呼吸を戻す残心を選べる。',tradeoff:'回復の間は追撃しない。',bodyChoice:{kind:'zanshin',id:'breath'},effects:{staminaCost:-.07,recovery:.08},intent:{survival:.5}}),
  define({id:'skill.flow-step',name:'流歩',kind:'body',family:'body.flow',questions:['balance','crowd'],
    materials:[['balance'],['space']],windows:['play','balance','practice'],motifs:['angle','balance'],
    mechanic:'正面に留まらず、攻撃の間に角度を作る構えを選べる。',tradeoff:'直線的な押し合いには向かない。',bodyChoice:{kind:'stance',id:'ryu'},effects:{reach:.04,evasion:.04},intent:{mobility:.6}}),
  define({id:'skill.grip',name:'握り',kind:'body',family:'body.grip',questions:['tool'],
    materials:[['tool'],['force','handling']],windows:['maintain','forge','practice'],motifs:['force','tool'],
    mechanic:'握り直して道具の重さを支える。重い得物の打ち崩しへつながる。',tradeoff:'持ち替えだけでは身につかない。',effects:{damage:.05,staminaCost:-.03},intent:{attack:.2}}),
  define({id:'skill.observe',name:'観眼',kind:'heart',family:'heart.observation',questions:['opening'],
    materials:[['observation'],['timing','patience']],windows:['observe','train','study','rest'],motifs:['read','timing'],
    mechanic:'相手の動きの終わりへ注意を向ける。',tradeoff:'見ていない方向の攻撃までは読めない。',intent:{counter:.2,spacing:.1}}),
  define({id:'skill.pursuer',name:'追う者',kind:'heart',family:'heart.pursuit',questions:['opening','close'],
    materials:[['space'],['observation','timing']],windows:['track','practice','observe'],motifs:['chase','timing'],
    mechanic:'相手が後ずさりを続けた隙に、間合いを詰めて飛びかかる。',tradeoff:'疲労中や進路が塞がれた時は追えない。',intent:{attack:.16,mobility:.12}}),
  define({id:'skill.patience',name:'待ち',kind:'heart',family:'heart.patience',questions:['opening','fatigue'],
    materials:[['patience'],['observation','breath']],windows:['rest','read','pray','observe'],motifs:['wait','return'],
    mechanic:'無理に追わず、相手が動くまで間合いを保つ。',tradeoff:'先に攻め込む機会は減る。',effects:{mitigation:.02},intent:{counter:.35,attack:-.15}}),
  define({id:'skill.care',name:'手当の勘',kind:'heart',family:'life.care',questions:['care'],
    materials:[['care'],['observation','breath']],windows:['care','rest'],motifs:['care','read'],
    mechanic:'休息で身体を戻す。戦わない人生にも残せる心得。',tradeoff:'戦闘中の即時回復ではない。',effects:{recovery:.18},intent:{survival:.2}}),
  define({id:'skill.nonlethal',name:'不殺',kind:'heart',family:'heart.nonlethal',questions:['care','opening'],
    materials:[['care'],['patience','observation']],windows:['care','rest','pray','observe'],motifs:['care','wait'],
    mechanic:'倒した相手へトドメを刺さず、無力化した時点で次の脅威へ意識を移す。',tradeoff:'戦闘が続けば倒れた相手が立ち上がり、再び戦線へ戻ることがある。',intent:{survival:.12,mobility:.08,attack:-.1}}),
  define({id:'skill.edge',name:'刃筋',kind:'heart',family:'life.edge',questions:['tool','guard'],
    materials:[['tool'],['observation','force']],windows:['forge','maintain','practice'],motifs:['tool','precision'],
    mechanic:'刃を向ける方向に注意し、得物の接触を活かす。',tradeoff:'遮蔽物や盾を無視する効果はない。',effects:{damage:.09},intent:{attack:.1}}),
  define({id:'skill.fire-vigil',name:'火守り',kind:'heart',family:'faith.fire.vigil',questions:['fatigue','tool'],
    materials:[['patience'],['tool']],windows:['pray','forge','rest','maintain'],motifs:['patience','tool'],
    mechanic:'炎を恐れるだけでなく、絶やさず扱うものとして心に置く。',tradeoff:'炎を生み出したり、炎害への耐性を直接与える心得ではない。',faith:{fire:.38},intent:{survival:.08}}),
  define({id:'skill.fire-hearth',name:'炉守り',kind:'heart',family:'faith.fire.hearth',questions:['care','tool'],
    materials:[['care'],['tool','observation']],windows:['care','forge'],motifs:['care','tool'],
    mechanic:'火を暮らしと命をつなぐものとして扱い、その意味を自分の型へ持ち込む。',tradeoff:'信仰は威力倍率や炎属性ダメージそのものではない。',faith:{fire:.34},intent:{survival:.05,attack:.05}}),
  define({id:'spark.spear.tide',name:'潮返し',kind:'technique',family:'spear.return',weapons:['spear'],questions:['close'],
    materials:[['handling'],['balance','observation']],motifs:['return','balance'],intent:{counter:.7,survival:.3},bodyAffinity:{balance:.6,reach:.2},
    mechanic:'石突で間を作り、引いた足から穂先を戻す。',tradeoff:'背後に余地がない時は引けない。',space:'retreat',limbs:'twoArms',
    steps:[step('pommel','retreat'),step('thrust','chase')],phases:['jo','ha']}),
  define({id:'spark.spear.pressure',name:'押し通し',kind:'technique',family:'spear.pressure',weapons:['spear'],questions:['close','guard'],
    materials:[['handling'],['force','tool']],motifs:['force','advance'],intent:{attack:.7,guard:.1},bodyAffinity:{drive:.7},effort:1.12,
    mechanic:'柄で押し返し、正面へ踏み込んで槍を通す。',tradeoff:'踏み込みの後に横が空く。',limbs:'twoArms',
    steps:[step('pommel','forward'),step('pierce','rush')],phases:['ha','kyu']}),
  define({id:'spark.sword.under',name:'潜り返し',kind:'technique',family:'sword.inside',weapons:['sword','dagger'],questions:['reach','close'],
    materials:[['handling'],['balance','space']],motifs:['return','angle'],intent:{mobility:.65,counter:.35},bodyAffinity:{coordination:.7,reach:-.25},space:'side',
    mechanic:'正面を横切って懐へ入り、斬り上げて外へ抜ける。',tradeoff:'横の余地が必要で、長い正面リーチを失う。',limbs:'legs',
    steps:[step('uppercut','cross'),step('back','sideR')],phases:['ha','kyu']}),
  define({id:'spark.sword.ward',name:'守り返し',kind:'technique',family:'sword.ward',weapons:['sword','dagger'],questions:['opening','recovery'],
    materials:[['handling'],['observation','patience']],motifs:['wait','return'],intent:{guard:.55,counter:.55},
    mechanic:'受けの姿勢を残し、角度を変えた返しから突く。',tradeoff:'初手は攻撃せず相手を待つ。',
    steps:[step('guard'),step('back','sideL'),step('thrust','forward')],phases:['jo','ha']}),
  define({id:'spark.great.anchor',name:'支え落とし',kind:'technique',family:'great.anchor',weapons:['great'],questions:['recovery','close'],
    materials:[['handling'],['force','tool','balance']],motifs:['force','wait'],intent:{guard:.4,attack:.3},bodyAffinity:{drive:.4,endurance:.3},effort:1.12,limbs:'twoArms',
    mechanic:'柄頭で支えを作り、跳ばずに刃の重さを落とす。',tradeoff:'大きく追わないため逃げる相手には届きにくい。',
    steps:[step('pommel'),step('heavy','forward','breath')],phases:['ha','kyu']}),
  define({id:'spark.axe.hook',name:'引き崩し',kind:'technique',family:'axe.hook',weapons:['axe'],questions:['guard','crowd'],
    materials:[['handling'],['tool','force']],motifs:['return','angle'],intent:{counter:.4,mobility:.3},space:'side',limbs:'twoArms',
    mechanic:'柄で相手の前進を受け、引く動きから横へ薙ぐ。',tradeoff:'広い振り幅が必要。壁越しには当たらない。',
    steps:[step('pommel','retreat'),step('sweep','orbitR')],phases:['ha','kyu']}),
  define({id:'spark.fist.inside',name:'懐打ち',kind:'technique',family:'fist.inside',weapons:['fist'],questions:['reach','close'],
    materials:[['handling'],['balance','force']],motifs:['angle','advance'],intent:{mobility:.5,attack:.3},bodyAffinity:{coordination:.5},space:'side',limbs:'legs',
    mechanic:'短い間合いへ身体ごと入り、腹打ちから突き上げる。',tradeoff:'懐へ入るまで武器の射程差を負う。',
    steps:[step('bodyblow','cross'),step('risingfist','forward')],phases:['ha','kyu']}),
  define({id:'spark.staff.gap',name:'払い間',kind:'technique',family:'staff.exit',weapons:['staff'],questions:['close','crowd'],
    materials:[['handling'],['space','balance']],motifs:['space','return'],intent:{survival:.7,mobility:.3},space:'retreat',limbs:'twoArms',
    mechanic:'杖で進路を払い、構えへ戻りながら離れる。',tradeoff:'追撃を捨てて距離を優先する。',
    steps:[step('sweep','orbitR'),step('ready','retreat')],phases:['jo','ha']}),
  define({id:'spark.spear.wedge',name:'楔返し',kind:'variant',family:'spear.return',requiresFamily:'spear.return',weapons:['spear'],questions:['guard'],
    materials:[['handling'],['precision','observation']],motifs:['return','precision'],intent:{counter:.5,spacing:.4},space:'side',limbs:'twoArms',
    mechanic:'引いて正面へ戻す代わりに外側へ踏み、突きの線を変える。',tradeoff:'正面から押し込む力は弱い。鎧の自動貫通ではない。',
    steps:[step('pommel','sideL'),step('pierce','orbitR')],phases:['ha','kyu']}),
  define({id:'spark.great.wait',name:'待受落とし',kind:'variant',family:'great.anchor',requiresFamily:'great.anchor',weapons:['great'],questions:['fatigue','opening'],
    materials:[['handling'],['patience','observation']],motifs:['wait','precision'],intent:{counter:.6,survival:.4},effort:.94,limbs:'twoArms',
    mechanic:'大きな踏み込みを止め、受けの後、その場へ刃を落とす。',tradeoff:'こちらから距離を詰めない。若い身体でも選べる。',
    steps:[step('guard'),step('heavy','stay')],phases:['jo','ha']}),
  define({id:'spark.link.return',name:'引いて返す連',kind:'link',family:'link.return',questions:['rhythm'],
    materials:[['handling'],['timing','balance']],motifs:['return','timing'],
    mechanic:'距離を作る序から返しの破へつなぐ、実際に成立した連の記録。',tradeoff:'技そのものは増えず、連を使うための体力も必要。',intent:{counter:.3},windows:['sequence']}),
  define({id:'spark.link.press',name:'押して通す連',kind:'link',family:'link.press',questions:['rhythm'],
    materials:[['handling'],['force','tool']],motifs:['advance','force'],
    mechanic:'正面を崩す序から踏み込みの急へつなぐ、実際に成立した連の記録。',tradeoff:'押し続ける分、引き際を選ぶ必要がある。',intent:{attack:.3},windows:['sequence']}),
  // Retained as an explicit capability-gated definition. A melee executor must never pretend to fire an arrow.
  define({id:'spark.bow.wait',name:'通り待ち',kind:'technique',family:'bow.intercept',weapons:['bow'],questions:['line','ammunition'],
    materials:[['handling'],['observation','patience']],motifs:['wait','precision'],intent:{spacing:.6,counter:.3},executor:'bow-projectile',
    mechanic:'通る射線を待って一本を放つ。',tradeoff:'射線・実矢・弓用モーションの実行器が必要。',phases:['ha','kyu']}),
]);
export const CAUSAL_ANSWER_BY_ID = Object.freeze(Object.fromEntries(CAUSAL_ANSWERS.map(row=>[row.id,row])));
export function resolveInspirationAnswer(id){return CAUSAL_ANSWER_BY_ID[id]||generatedTechniqueById(id)||null;}
export function inspirationCombatAnswerPool(weapon){
  const authored=CAUSAL_ANSWERS.filter(row=>['technique','variant'].includes(row.kind)&&row.weapons?.includes(weapon));
  const keys=new Set(authored.map(inspirationTechniqueStructureKey));
  const generated=generatedTechniqueCandidates({weapon}).filter(row=>!keys.has(inspirationTechniqueStructureKey(row)));
  return Object.freeze([...authored,...generated]);
}
export function answerSignature(row){
  if(!row)throw Error('Unknown causal answer');
  return JSON.stringify([row.kind==='variant'?'technique':row.kind,row.weapons,row.questions,row.steps.map(s=>[s.kind,s.footwork]),row.bodyChoice||null,row.executor||null,row.kind==='heart'?row.mechanic:null,row.kind==='body'?row.family:null,row.kind==='link'?row.family:null]);
}
export function validateInspirationNamePolicy(rows=CAUSAL_ANSWERS){
  const structures=new Map();
  for(const row of rows){
    if(Object.hasOwn(row,'nameGrade'))throw Error('Manual technique grade is forbidden: '+(row.id||row.name));
    if(['technique','variant','link'].includes(row.kind)){
      const base=String(row.name||'').trim();
      if(base.length<2||base.length>7||/[・･]/.test(base)||/^(秘技|奥義)[・･]?/.test(base))throw Error('Invalid technique base name: '+row.id);
      for(const attribute of row.attributes||[]){
        if(!Object.hasOwn(INSPIRATION_ATTRIBUTE_LABELS,attribute))throw Error('Unknown technique attribute: '+row.id);
        if(base.includes(INSPIRATION_ATTRIBUTE_LABELS[attribute]))throw Error('Attribute leaked into technique name: '+row.id);
      }
      if(['technique','variant'].includes(row.kind)){
        const key=inspirationTechniqueStructureKey(row),known=structures.get(key);
        if(known&&known!==base)throw Error('Same technique structure has multiple names: '+row.id);
        structures.set(key,base);
      }
    }
    for(const effect of row.specialEffects||[]){
      if(!effect?.id||!effect?.label||!Object.hasOwn(INSPIRATION_TRAIT_IMPACTS,effect.impact)||!Object.hasOwn(INSPIRATION_TRAIT_RARITIES,effect.rarity))throw Error('Invalid special effect: '+row.id);
      if(effect.impact==='rule'&&effect.rarity==='singular'&&!String(effect.unlockCondition||'').trim())throw Error('Ultimate rule effect requires unlock condition: '+row.id);
    }
  }
  return true;
}
export function validateCausalAnswers(){
  const ids=new Set(),signatures=new Set(),motions=new Set([...INSPIRATION_MOTION_IDS,'guard','ready','retreat','brace','parry','counter']);
  for(const row of CAUSAL_ANSWERS){
    if(ids.has(row.id)||!INSPIRATION_KINDS[row.kind]||!row.family||!row.mechanic||!row.tradeoff)throw Error(`Invalid causal answer: ${row.id}`);
    ids.add(row.id);const signature=answerSignature(row);if(signatures.has(signature))throw Error(`Cosmetic duplicate: ${row.id}`);signatures.add(signature);
    if(row.questions.some(q=>!INSPIRATION_QUESTIONS[q]))throw Error(`Unknown question: ${row.id}`);
    if(Object.keys(row.faith).length&&row.kind!=='heart')throw Error(`Faith metadata belongs to heart: ${row.id}`);
    for(const [attribute,value] of Object.entries(row.faith))if(!isInspirationAttribute(attribute)||!Number.isFinite(value)||value<=0||value>1)throw Error(`Invalid faith attribute: ${row.id}`);
    if(row.steps.some(s=>!motions.has(s.kind)))throw Error(`Unregistered motion: ${row.id}`);
    if(row.steps.length>3||(!row.executor&&['technique','variant'].includes(row.kind)&&!row.steps.length))throw Error(`Missing execution: ${row.id}`);
  }
  validateInspirationNamePolicy(CAUSAL_ANSWERS);return true;
}
