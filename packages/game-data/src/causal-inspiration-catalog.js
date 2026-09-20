import { INSPIRATION_MOTION_IDS } from './inspiration-catalog.js';

export const causalInspirationRevision = 'causal-inspiration-1';
export const INSPIRATION_KINDS = Object.freeze({heart:'心',body:'体',technique:'技',link:'連',variant:'変'});
export const INSPIRATION_NAME_GRADES = Object.freeze({normal:'',secret:'秘技',ultimate:'奥義'});
export function inspirationTechniqueName(row){
  if(!row)return '';
  const base=String(row.name||'').replace(/[・･]{2,}/g,'・').replace(/^・|・$/g,'');
  const grade=INSPIRATION_NAME_GRADES[row.nameGrade||'normal'];
  return grade?`${grade}・${base}`:base;
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
  effort:1, effects:{}, nameGrade:'normal', specialEffects:[], ...row,
  steps:Object.freeze(row.steps||[]),
  questions:Object.freeze(row.questions||[]), materials:Object.freeze((row.materials||[]).map(group=>Object.freeze(group))),
  windows:Object.freeze(row.windows||[]), weapons:Object.freeze(row.weapons||[]),
  motifs:Object.freeze(row.motifs||[]), phases:Object.freeze(row.phases||['jo','ha','kyu']), specialEffects:Object.freeze(row.specialEffects||[]),
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
  define({id:'skill.patience',name:'待ち',kind:'heart',family:'heart.patience',questions:['opening','fatigue'],
    materials:[['patience'],['observation','breath']],windows:['rest','read','pray','observe'],motifs:['wait','return'],
    mechanic:'無理に追わず、相手が動くまで間合いを保つ。',tradeoff:'先に攻め込む機会は減る。',effects:{mitigation:.02},intent:{counter:.35,attack:-.15}}),
  define({id:'skill.care',name:'手当の勘',kind:'heart',family:'life.care',questions:['care'],
    materials:[['care'],['observation','breath']],windows:['care','rest'],motifs:['care','read'],
    mechanic:'休息で身体を戻す。戦わない人生にも残せる心得。',tradeoff:'戦闘中の即時回復ではない。',effects:{recovery:.18},intent:{survival:.2}}),
  define({id:'skill.edge',name:'刃筋',kind:'heart',family:'life.edge',questions:['tool','guard'],
    materials:[['tool'],['observation','force']],windows:['forge','maintain','practice'],motifs:['tool','precision'],
    mechanic:'刃を向ける方向に注意し、得物の接触を活かす。',tradeoff:'遮蔽物や盾を無視する効果はない。',effects:{damage:.09},intent:{attack:.1}}),
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
export function answerSignature(row){
  if(!row)throw Error('Unknown causal answer');
  return JSON.stringify([row.kind==='variant'?'technique':row.kind,row.weapons,row.questions,row.steps.map(s=>[s.kind,s.footwork]),row.bodyChoice||null,row.executor||null,row.kind==='heart'?row.mechanic:null,row.kind==='body'?row.family:null,row.kind==='link'?row.family:null]);
}
export function validateCausalAnswers(){
  const ids=new Set(),signatures=new Set(),motions=new Set([...INSPIRATION_MOTION_IDS,'guard','ready','retreat','brace','parry','counter']);
  for(const row of CAUSAL_ANSWERS){
    if(ids.has(row.id)||!INSPIRATION_KINDS[row.kind]||!row.family||!row.mechanic||!row.tradeoff)throw Error(`Invalid causal answer: ${row.id}`);
    ids.add(row.id);const signature=answerSignature(row);if(signatures.has(signature))throw Error(`Cosmetic duplicate: ${row.id}`);signatures.add(signature);
    if(row.questions.some(q=>!INSPIRATION_QUESTIONS[q]))throw Error(`Unknown question: ${row.id}`);
    if(!Object.hasOwn(INSPIRATION_NAME_GRADES,row.nameGrade)||/[・･].*[・･]/.test(row.name))throw Error(`Invalid technique name: ${row.id}`);
    if(row.specialEffects.length&&!['secret','ultimate'].includes(row.nameGrade))throw Error(`Special technique requires title grade: ${row.id}`);
    if(row.steps.some(s=>!motions.has(s.kind)))throw Error(`Unregistered motion: ${row.id}`);
    if(row.steps.length>3||(!row.executor&&['technique','variant'].includes(row.kind)&&!row.steps.length))throw Error(`Missing execution: ${row.id}`);
  }
  return true;
}
