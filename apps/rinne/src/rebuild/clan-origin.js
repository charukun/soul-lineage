/** A family's chosen culture and traditions, never a character class or a stat roll. */
export const ORIGIN_VERSION = 1;
export const ORIGIN_QUESTIONS = Object.freeze([
  {key:'culture', title:'懐かしいのは、どの景色？', memory:'景色の記憶', choices:[
    {id:'wa', label:'山霧の屋敷', image:'wa'},
    {id:'heath', label:'草原の城壁', image:'heath'},
    {id:'grove', label:'深い森の灯り', image:'grove'},
  ]},
  {key:'ethos', title:'その家で、何度も聞いた言葉は？', memory:'声の記憶', choices:[
    {id:'guard', label:'守り抜け', image:'guard'},
    {id:'seek', label:'先を拓け', image:'seek'},
    {id:'discern', label:'よく見極めよ', image:'discern'},
  ]},
  {key:'art', title:'最後まで、手放せなかったものは？', memory:'手の記憶', choices:[
    {id:'katana', label:'一振りの刀', image:'katana'},
    {id:'spear', label:'使い込まれた槍', image:'spear'},
    {id:'staff', label:'灯りを宿す杖', image:'staff'},
  ]},
]);
const CULTURES = Object.freeze({
  wa:{label:'和の山里', home:'山里の屋敷', names:{guard:'霞守',seek:'暁渡',discern:'水鏡'}, crest:'petal'},
  heath:{label:'風渡る草原', home:'草原の館', names:{guard:'穂守',seek:'風渡',discern:'遠見'}, crest:'wind'},
  grove:{label:'灯りの森', home:'木陰の家', names:{guard:'灯守',seek:'枝渡',discern:'月読'}, crest:'leaf'},
});
const ARTS = Object.freeze({
  katana:{label:'刀の家伝', heirloom:'家宝の刀', weapon:'sword', practice:'抜きと納めの型', memory:'刀を抜く前に、心を静かに。'},
  spear:{label:'槍の家伝', heirloom:'家宝の槍', weapon:'spear', practice:'歩みと間合いの型', memory:'穂先だけでなく、足もとを見てごらん。'},
  staff:{label:'杖の家伝', heirloom:'家宝の杖', weapon:'staff', practice:'呼吸と巡りの型', memory:'灯りは、小さくても受け継げる。'},
});
const validChoice = (key,id) => ORIGIN_QUESTIONS.find(row=>row.key===key)?.choices.some(row=>row.id===id) === true;

export function normalizeClanOrigin(raw) {
  if(raw == null)return null; // Legacy lives are not assigned a made-up origin.
  if(typeof raw!=='object'||Array.isArray(raw)||raw.version!==ORIGIN_VERSION)throw Error('一族の起源の形式が違います。');
  for(const {key} of ORIGIN_QUESTIONS)if(!validChoice(key,raw[key]))throw Error('一族の記憶が不正です。');
  return {version:ORIGIN_VERSION,culture:raw.culture,ethos:raw.ethos,art:raw.art};
}
export function originFromAnswers(answers) {
  return normalizeClanOrigin({version:ORIGIN_VERSION,culture:answers?.culture,ethos:answers?.ethos,art:answers?.art});
}
export function normalizeOriginDraft(raw) {
  const draft={version:ORIGIN_VERSION,step:0,answers:{}};
  if(!raw||typeof raw!=='object'||raw.version!==ORIGIN_VERSION)return draft;
  for(const {key} of ORIGIN_QUESTIONS)if(validChoice(key,raw.answers?.[key]))draft.answers[key]=raw.answers[key];
  const firstMissing=ORIGIN_QUESTIONS.findIndex(({key})=>!draft.answers[key]);
  const completed=firstMissing<0?ORIGIN_QUESTIONS.length:firstMissing;
  draft.step=Math.min(completed,Number.isInteger(raw.step)?Math.max(0,raw.step):completed);
  return draft;
}
export function chooseOriginAnswer(draft,id) {
  const next=normalizeOriginDraft(draft),question=ORIGIN_QUESTIONS[next.step];
  if(!question||!validChoice(question.key,id))throw Error('この問いでは選べない記憶です。');
  next.answers[question.key]=id;
  return next;
}
export function advanceOriginDraft(draft) {
  const next=normalizeOriginDraft(draft),question=ORIGIN_QUESTIONS[next.step];
  if(question&&!validChoice(question.key,next.answers[question.key]))throw Error('心に残る記憶に触れてください。');
  next.step=Math.min(ORIGIN_QUESTIONS.length,next.step+1);
  return next;
}
export function clanPresentation(raw) {
  const origin=normalizeClanOrigin(raw);if(!origin)return null;
  const culture=CULTURES[origin.culture],art=ARTS[origin.art];
  const motto=ORIGIN_QUESTIONS[1].choices.find(row=>row.id===origin.ethos).label;
  return {...origin,family:`${culture.names[origin.ethos]}の一族`,cultureLabel:culture.label,home:culture.home,crest:culture.crest,motto,...art};
}
export function clanFamilyLine(state,kind='welcome') {
  const clan=clanPresentation(state?.clanOrigin);if(!clan)return '';
  if(kind==='train'||kind==='practice')return `${clan.practice}。${clan.memory}`;
  if(kind==='maintain'||kind==='forge')return `この${clan.heirloom}も、誰かが毎日手入れしていたんだよ。`;
  return `${state?.name||'あなた'}、おかえり。${clan.family}へ。`;
}
export function familyPracticeLabel(state,kind) {
  const clan=clanPresentation(state?.clanOrigin);
  return clan&&['train','practice'].includes(kind)?`${clan.practice}${state.ageYears<7?'の見学':'の稽古'}`:null;
}
