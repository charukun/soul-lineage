// A family's culture is a chosen history, never a character stat or weapon lock.
export const ORIGIN_QUESTIONS = Object.freeze([
  { key:'culture', title:'懐かしいのは、どの景色？', choices:[
    { id:'wa', label:'山霧の屋敷', detail:'水音と、軒先の鈴', scene:'wa' },
    { id:'hearth', label:'草原の城壁', detail:'灯りと、遠い鐘', scene:'hearth' },
    { id:'grove', label:'深い森の灯り', detail:'木漏れ日と、葉のささやき', scene:'grove' },
  ] },
  { key:'ethos', title:'その家で、何度も聞いた言葉は？', choices:[
    { id:'guard', label:'守り抜け', detail:'帰る場所を、絶やさずに', scene:'guard' },
    { id:'venture', label:'先を拓け', detail:'まだ見ぬ明日へ', scene:'venture' },
    { id:'discern', label:'よく見極めよ', detail:'静けさの中に、答えがある', scene:'discern' },
  ] },
  { key:'art', title:'最後まで、手放せなかったものは？', choices:[
    { id:'katana', label:'一振りの刀', detail:'代々、磨かれた間合い', scene:'katana' },
    { id:'spear', label:'使い込まれた槍', detail:'風を分ける、まっすぐな穂先', scene:'spear' },
    { id:'staff', label:'祈りの杖', detail:'小さな灯りを、次の手へ', scene:'staff' },
  ] },
]);
const CULTURES = Object.freeze({
  wa:{ label:'和の一族', home:'霧の山里', houses:{guard:'水守',venture:'朝凪',discern:'月影'} },
  hearth:{ label:'草原の一族', home:'鐘の鳴る丘', houses:{guard:'灯守',venture:'暁原',discern:'星見'} },
  grove:{ label:'森の一族', home:'木漏れ日の森', houses:{guard:'葉守',venture:'風渡',discern:'深森'} },
});
const ETHOS = Object.freeze({
  guard:{ label:'守り抜く家', motto:'帰る場所を、絶やさずに。', line:'大切なものを、守れる人に。' },
  venture:{ label:'道を拓く家', motto:'まだ見ぬ明日へ。', line:'あなたの道を、歩いておいで。' },
  discern:{ label:'見極める家', motto:'静けさの中に、答えがある。', line:'よく見て、あなたの答えを見つけてね。' },
});
const ARTS = Object.freeze({
  // Katana tradition shares the existing sword equipment/combat port.
  // No unreviewed model, move set, or early-age weapon is silently substituted.
  katana:{ label:'刀', weapon:'sword', practice:'家伝の間合い', episode:'distance', heirloom:'代々手入れされてきた、一振りの刀', line:'刀は急がず、間合いから。' },
  spear:{ label:'槍', weapon:'spear', practice:'家伝の足運び', episode:'balance', heirloom:'幾度も柄を替え、受け継いだ槍', line:'槍の穂先より、足元を大切に。' },
  staff:{ label:'杖', weapon:'staff', practice:'家伝の集中', episode:'focus', heirloom:'家の灯りを守ってきた、祈りの杖', line:'杖を握る前に、心を静かに。' },
});
const owns = (table,key) => typeof key==='string' && Object.hasOwn(table,key);
export function normalizeLineageOrigin(raw){
  if(raw==null)return null; // Old saves remain old lives, not a new-family prompt.
  if(raw.schemaVersion!==1 || !owns(CULTURES,raw.culture) || !owns(ETHOS,raw.ethos) || !owns(ARTS,raw.art))throw Error('一族の記録が不正です。');
  const founderId=raw.founderId??null;
  if(founderId!==null&&(typeof founderId!=='string'||!/^life-[a-zA-Z0-9-]{1,100}$/.test(founderId)))throw Error('一族の始祖の記録が不正です。');
  return {schemaVersion:1,culture:raw.culture,ethos:raw.ethos,art:raw.art,founderId};
}
export function createLineageOrigin(answers){
  return normalizeLineageOrigin({schemaVersion:1,culture:answers?.culture,ethos:answers?.ethos,art:answers?.art,founderId:null});
}
export function describeLineage(raw){
  const origin=normalizeLineageOrigin(raw);if(!origin)return null;
  const culture=CULTURES[origin.culture],ethos=ETHOS[origin.ethos],art=ARTS[origin.art];
  return {...origin,houseName:`${culture.houses[origin.ethos]}家`,cultureLabel:culture.label,home:culture.home,ethosLabel:ethos.label,motto:ethos.motto,parentLine:ethos.line,artLabel:art.label,weapon:art.weapon,practice:art.practice,episode:art.episode,heirloom:art.heirloom,teachingLine:art.line};
}
export function normalizeFamilyPractice(raw){
  if(raw==null)return {observations:0,practices:0};
  const result={};for(const key of ['observations','practices']){
    const value=raw[key]??0;if(!Number.isSafeInteger(value)||value<0||value>100000)throw Error('家伝の稽古の記録が不正です。');result[key]=value;
  }return result;
}
export function familyActivityLabel(state,kind,fallback){
  const family=describeLineage(state?.lineageOrigin);
  if(!family||!['train','practice'].includes(kind))return fallback;
  return state.ageYears<7?`${family.houseName}の稽古見学`:family.practice;
}
// Called once per completed, cooldown-qualified activity, not per frame or load.
export function familyPracticeEpisode(state,kind,place){
  const family=describeLineage(state?.lineageOrigin);
  if(!family||!['train','practice'].includes(kind))return {kind,place};
  state.familyPractice=normalizeFamilyPractice(state.familyPractice);
  const practiced=state.ageYears>=7&&state.equipment?.weapon===family.weapon;
  const key=practiced?'practices':'observations';state.familyPractice[key]=Math.min(100000,state.familyPractice[key]+1);
  return {kind:practiced?family.episode:kind,place:`${family.houseName}・${practiced?family.practice:'稽古見学'}`};
}
export function familyWelcome(state){
  const family=describeLineage(state?.lineageOrigin);if(!family)return null;
  return `${family.houseName}へ、${state.generation>1?'おかえり':'ようこそ'}。${family.parentLine}`;
}
export function chooseOriginAnswer(answers,step,id){
  const question=ORIGIN_QUESTIONS[step];
  if(!question||!question.choices.some(choice=>choice.id===id))throw Error('選べない記憶です。');
  return {...answers,[question.key]:id};
}
