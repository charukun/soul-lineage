const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));

export const SUPPORT_SKILLS=Object.freeze([
  {id:'skill.breath',name:'調息',type:'support',needs:['breathe'],threshold:.65,effects:{trainingGain:.12,staminaCost:-.05}},
  {id:'skill.observe',name:'観眼',type:'support',needs:['observe'],threshold:.65,effects:{actionSpark:.14}},
  {id:'skill.balance',name:'体幹',type:'support',needs:['balance'],threshold:.65,effects:{mitigation:.05}},
  {id:'skill.fall',name:'受身',type:'support',needs:['fall'],threshold:.65,effects:{mitigation:.05,evasion:.02}},
  {id:'skill.focus',name:'集中',type:'support',needs:['focus'],threshold:.65,effects:{damage:.06,actionSpark:.05}},
  {id:'skill.danger',name:'危険察知',type:'support',needs:['sense'],threshold:.65,effects:{mitigation:.03,evasion:.06}},
  {id:'skill.repeat',name:'反復',type:'support',needs:['practice'],threshold:.65,effects:{trainingGain:.24,actionSpark:.08}},
  {id:'skill.distance',name:'間合い',type:'support',needs:['practice'],threshold:.65,effects:{reach:.08,actionSpark:.08}},
  {id:'skill.adapt',name:'環境適応',type:'support',needs:['adapt'],threshold:.65,effects:{mitigation:.04,staminaCost:-.03}},
  {id:'skill.rhythm',name:'拍子',type:'support',needs:['play','practice'],threshold:.8,effects:{actionSpark:.08,staminaCost:-.03}},
  {id:'skill.patience',name:'待ち',type:'support',needs:['read','rest'],threshold:.8,effects:{trainingGain:.1,mitigation:.02}},
  {id:'skill.care',name:'手当の勘',type:'support',needs:['care'],threshold:.7,effects:{recovery:.18}},
  {id:'skill.step',name:'踏み込み',type:'support',needs:['play','train'],threshold:.8,effects:{reach:.05,actionSpark:.06}},
  {id:'skill.calm',name:'静心',type:'support',needs:['pray','rest'],threshold:.8,effects:{staminaCost:-.08,mitigation:.02}},
  {id:'skill.read',name:'先読み',type:'support',needs:['study','observe'],threshold:.8,effects:{actionSpark:.09,evasion:.03}},
  {id:'skill.edge',name:'刃筋',type:'support',needs:['forge','maintain'],threshold:.8,effects:{damage:.09}},
  {id:'skill.trail',name:'追歩',type:'support',needs:['track','play'],threshold:.8,effects:{reach:.05,evasion:.02}},
  {id:'skill.resolve',name:'不退',type:'support',needs:['care','combat'],threshold:.8,effects:{mitigation:.07,damage:.04}},
]);

export const ACTION_SKILLS=Object.freeze([
  {id:'action.guard-step',name:'受け流し歩法',type:'action',needs:['practice'],threshold:1.45,support:['skill.balance'],effects:{mitigation:.06,evasion:.03}},
  {id:'action.slip',name:'流し身',type:'action',needs:['practice'],threshold:1.75,support:['skill.danger'],effects:{evasion:.08}},
  {id:'action.lunge',name:'伸び足',type:'action',needs:['practice'],threshold:2.0,support:['skill.distance'],effects:{reach:.12,damage:.06}},
  {id:'action.counter',name:'返し',type:'action',needs:['practice'],threshold:2.25,support:['skill.observe','skill.danger'],effects:{damage:.11}},
  {id:'action.feint',name:'誘い',type:'action',needs:['practice'],threshold:2.55,support:['skill.focus','skill.observe'],effects:{damage:.08,evasion:.03}},
  {id:'action.flow',name:'連環',type:'action',needs:['practice'],threshold:2.85,support:['skill.breath','skill.repeat'],effects:{staminaCost:-.09,damage:.06}},
  {id:'action.breakfall',name:'崩し受身',type:'action',needs:['practice'],threshold:3.15,support:['skill.fall','skill.balance'],effects:{mitigation:.08}},
  {id:'action.finish',name:'詰め',type:'action',needs:['practice'],threshold:3.65,support:['skill.edge','skill.focus'],effects:{damage:.18,reach:.05}},
]);

export const DISCOVERIES=Object.freeze([...SUPPORT_SKILLS,...ACTION_SKILLS]);
export const SKILL_BY_ID=Object.freeze(Object.fromEntries(DISCOVERIES.map(row=>[row.id,row])));

export function skillEffects(state){
  const total={trainingGain:0,actionSpark:0,damage:0,mitigation:0,evasion:0,reach:0,staminaCost:0,recovery:0};
  for(const id of state?.knownSkills||[]){const row=SKILL_BY_ID[id];if(!row)continue;for(const [key,value] of Object.entries(row.effects||{}))total[key]=(total[key]||0)+value;}
  total.trainingGain=clamp(total.trainingGain,0,.85);
  total.actionSpark=clamp(total.actionSpark,0,.75);
  total.damage=clamp(total.damage,0,.7);
  total.mitigation=clamp(total.mitigation,0,.58);
  total.evasion=clamp(total.evasion,0,.38);
  total.reach=clamp(total.reach,0,.35);
  total.staminaCost=clamp(total.staminaCost,-.38,0);
  total.recovery=clamp(total.recovery,0,.5);
  return total;
}

function experienceScore(state,kind){return Number(state?.experiences?.[kind]?.score||0);}
function supportReady(state,row){return (row.support||[]).every(id=>state.knownSkills?.includes(id));}

export function eligibleDiscoveries(state){
  const effects=skillEffects(state),known=new Set([...(state?.knownSkills||[]),...(state?.pendingDiscoveries||[])]),rows=[];
  for(const row of DISCOVERIES){
    if(known.has(row.id))continue;
    const threshold=row.type==='action'?row.threshold/(1+effects.actionSpark):row.threshold;
    if(!(row.needs||[]).every(kind=>experienceScore(state,kind)>=threshold))continue;
    if(row.type==='action'&&!supportReady(state,row))continue;
    rows.push(row);
  }
  return rows;
}

export function skillName(id){return SKILL_BY_ID[id]?.name||id;}
