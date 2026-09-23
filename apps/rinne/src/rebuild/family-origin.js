// Portable family identity. No browser, storage, rendering, or combat-stat dependencies.
const rows = values => Object.freeze(values.map(value => Object.freeze(value)));
export const FAMILY_CULTURES = rows([
  {id:'wa', label:'山霧の屋敷', name:'霧山の一族', home:'霧山の家', crest:'三つ山', memory:'縁側に雨の匂い。庭から、稽古の音がする。'},
  {id:'plains', label:'草原の城壁', name:'風原の一族', home:'風原の家', crest:'風の輪', memory:'草を渡る風。門の向こうで、家族が手を振る。'},
  {id:'forest', label:'深い森の灯り', name:'木守の一族', home:'木守の家', crest:'双葉', memory:'木漏れ日の食卓。窓辺には、小さな灯り。'},
]);
export const FAMILY_ETHOS = rows([
  {id:'guard', label:'守り抜け', name:'守りの家風', memory:'「強さは、誰かが帰ってこられる場所のために。」'},
  {id:'seek', label:'先を拓け', name:'開拓の家風', memory:'「知らない道にも、お前の足跡を残しておいで。」'},
  {id:'discern', label:'よく見極めよ', name:'見極めの家風', memory:'「急がなくていい。よく見て、自分で決めるんだよ。」'},
]);
export const FAMILY_TRADITIONS = rows([
  {id:'katana', label:'一振りの刀', name:'刀の家伝', weapon:'sword', heirloom:'月影の刀', practice:'抜く前に、間合いを見る。', memory:'庭先で刀を納める音。家の型は、静かな一歩から始まる。'},
  {id:'spear', label:'使い込まれた槍', name:'槍の家伝', weapon:'spear', heirloom:'風渡りの槍', practice:'足を揃え、遠くを見据える。', memory:'朝の庭で、穂先が風を切る。家族の足運びを覚えている。'},
  {id:'staff', label:'古木の杖', name:'杖の家伝', weapon:'staff', heirloom:'木霊の杖', practice:'息を整え、気配を聴く。', memory:'木の杖を抱えた祖先。静けさの中にも、教えがあった。'},
]);
export const FAMILY_QUESTIONS = Object.freeze([
  Object.freeze({key:'cultureId', text:'懐かしいのは、どの景色？', choices:FAMILY_CULTURES}),
  Object.freeze({key:'ethosId', text:'その家で、何度も聞いた言葉は？', choices:FAMILY_ETHOS}),
  Object.freeze({key:'traditionId', text:'最後まで、手放せなかったものは？', choices:FAMILY_TRADITIONS}),
]);

const FAMILY_SCHEMA = 2, CONTRIBUTION_LIMIT = 32, LEGACY_LIMIT = 64, MIGRATION_LIMIT = 32;
const own = (rows, id) => rows.find(row => row.id === id);
const validId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(value);
const validVillageId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(value);
const text = (value, max = 80) => typeof value === 'string' && value.length <= max;
const count = value => Number.isSafeInteger(value) && value >= 0;
const finite = (value, lo, hi) => Number.isFinite(value) && value >= lo && value <= hi;
const nonBasic = id => typeof id === 'string' && id.length <= 100 && !id.startsWith('basic.');
const fail = () => { throw Error('一族の記録が不正です。'); };
const legacyStrength = generations => Number(Math.min(.52, .08 + Math.max(1, generations) * .08).toFixed(3));

function deriveLegacies(contributions) {
  const bySkill = new Map();
  for (const contribution of contributions) for (const skillId of contribution.skills) if (nonBasic(skillId)) {
    const row = bySkill.get(skillId) || {skillId,firstGeneration:contribution.generation,lastGeneration:contribution.generation,generations:0};
    row.firstGeneration = Math.min(row.firstGeneration, contribution.generation);
    row.lastGeneration = Math.max(row.lastGeneration, contribution.generation);
    row.generations++; bySkill.set(skillId,row);
  }
  return [...bySkill.values()].map(row=>({...row,strength:legacyStrength(row.generations),established:row.generations>=3})).slice(-LEGACY_LIMIT);
}
function validateLegacyRows(raw, fallback) {
  const source = Array.isArray(raw) ? raw : fallback, ids = new Set();
  if (!Array.isArray(source) || source.length > LEGACY_LIMIT) fail();
  return source.map(row => {
    if (!row || !text(row.skillId,100) || !nonBasic(row.skillId) || ids.has(row.skillId) || !count(row.firstGeneration) || row.firstGeneration < 1 || !count(row.lastGeneration) || row.lastGeneration < row.firstGeneration || !count(row.generations) || row.generations < 1 || !finite(row.strength,0,.52) || typeof row.established !== 'boolean') fail();
    ids.add(row.skillId);
    return {skillId:row.skillId,firstGeneration:row.firstGeneration,lastGeneration:row.lastGeneration,generations:row.generations,strength:row.strength,established:row.established};
  });
}
function validateMigrations(raw) {
  if (!Array.isArray(raw) || raw.length > MIGRATION_LIMIT) fail();
  return raw.map(row => {
    if (!row || !count(row.generation) || row.generation < 1 || !text(row.lifeId,120) || !validVillageId(row.fromVillageId) || !validVillageId(row.toVillageId) || row.fromVillageId === row.toVillageId) fail();
    return {generation:row.generation,lifeId:row.lifeId,fromVillageId:row.fromVillageId,toVillageId:row.toVillageId};
  });
}

export function validateFamily(raw) {
  if (!raw || ![1,FAMILY_SCHEMA].includes(raw.schemaVersion) || !validId(raw.id)) fail();
  const sourceVersion = raw.schemaVersion, selected = raw.origin === 'chosen';
  if (!selected && raw.origin !== 'legacy') fail();
  if (selected) {
    if (!own(FAMILY_CULTURES, raw.cultureId) || !own(FAMILY_ETHOS, raw.ethosId) || !own(FAMILY_TRADITIONS, raw.traditionId)) fail();
  } else if (raw.cultureId !== 'wanderer' || raw.ethosId !== 'free' || raw.traditionId !== 'none') fail();
  if (!Array.isArray(raw.contributions) || raw.contributions.length > CONTRIBUTION_LIMIT || !count(raw.archivedGenerations)) fail();
  const ids = new Set();
  const contributions = raw.contributions.map(row => {
    if (!row || !validId(row.lifeId) || ids.has(row.lifeId) || !count(row.generation) || row.generation < 1 || !text(row.name, 12) || !count(row.returns) || !count(row.defeats) || !Array.isArray(row.skills) || row.skills.length > 8 || row.skills.some(id => !text(id, 100))) fail();
    ids.add(row.lifeId);
    return {lifeId:row.lifeId,generation:row.generation,name:row.name,returns:row.returns,defeats:row.defeats,skills:[...row.skills]};
  });
  const homeVillageId = sourceVersion === 1 ? null : raw.homeVillageId;
  if (homeVillageId !== null && !validVillageId(homeVillageId)) fail();
  const migrations = sourceVersion === 1 ? [] : validateMigrations(raw.migrations);
  const archivedMigrations = sourceVersion === 1 ? 0 : raw.archivedMigrations;
  if (!count(archivedMigrations)) fail();
  const legacies = validateLegacyRows(sourceVersion === 1 ? null : raw.legacies, deriveLegacies(contributions));
  const familyMotions=raw.familyMotions??[];
  if(!Array.isArray(familyMotions)||familyMotions.length>32||new Set(familyMotions).size!==familyMotions.length||familyMotions.some(id=>!validId(id)))fail();
  return {schemaVersion:FAMILY_SCHEMA,id:raw.id,origin:raw.origin,cultureId:raw.cultureId,ethosId:raw.ethosId,traditionId:raw.traditionId,contributions,archivedGenerations:raw.archivedGenerations,homeVillageId,migrations,archivedMigrations,legacies,familyMotions:[...familyMotions]};
}
export function grantFamilyMotion(raw,id){
  const family=validateFamily(raw);
  if(!['family.moonfall','family.moonstill'].includes(id))fail();
  if(!family.familyMotions.includes(id))family.familyMotions.push(id);
  return validateFamily(family);
}
export function createFamily(answers, id) {
  return validateFamily({schemaVersion:FAMILY_SCHEMA,id,origin:'chosen',cultureId:answers?.cultureId,ethosId:answers?.ethosId,traditionId:answers?.traditionId,contributions:[],archivedGenerations:0,homeVillageId:null,migrations:[],archivedMigrations:0,legacies:[]});
}
function stableId(value) {
  let hash = 2166136261;
  for (const char of String(value)) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return `family-legacy-${(hash >>> 0).toString(16)}`;
}
export function familyForLife(state) {
  if (state.family !== undefined && state.family !== null) return validateFamily(state.family);
  return validateFamily({schemaVersion:FAMILY_SCHEMA,id:stableId(state.lineage?.[0]?.lifeId || state.id || state.seed || 'legacy'),origin:'legacy',cultureId:'wanderer',ethosId:'free',traditionId:'none',contributions:[],archivedGenerations:Math.max(0,(Number(state.generation)||1)-1),homeVillageId:null,migrations:[],archivedMigrations:0,legacies:[]});
}
export function settleFamily(raw, villageId, {generation=1,lifeId=''}={}) {
  if (!validVillageId(villageId) || !count(generation) || generation < 1 || !text(lifeId,120)) fail();
  const family = validateFamily(raw);
  if (family.homeVillageId === null) { family.homeVillageId = villageId; return validateFamily(family); }
  if (family.homeVillageId === villageId) return family;
  family.migrations.push({generation,lifeId,fromVillageId:family.homeVillageId,toVillageId:villageId});
  if (family.migrations.length > MIGRATION_LIMIT) { family.migrations.shift(); family.archivedMigrations++; }
  family.homeVillageId = villageId;
  return validateFamily(family);
}
function recordSkillLegacies(family, state) {
  const skills = [...new Set(state.knownSkills || [])].filter(nonBasic).slice(-LEGACY_LIMIT);
  for (const skillId of skills) {
    let legacy = family.legacies.find(row=>row.skillId===skillId);
    if (!legacy) {
      legacy={skillId,firstGeneration:state.generation,lastGeneration:state.generation,generations:1,strength:legacyStrength(1),established:false};
      family.legacies.push(legacy);
    } else if (legacy.lastGeneration !== state.generation) {
      legacy.lastGeneration=state.generation;legacy.generations++;legacy.strength=legacyStrength(legacy.generations);legacy.established=legacy.generations>=3;
    }
  }
  if (family.legacies.length > LEGACY_LIMIT) family.legacies.sort((a,b)=>Number(b.established)-Number(a.established)||b.strength-a.strength||b.lastGeneration-a.lastGeneration).length=LEGACY_LIMIT;
}
export function inheritFamily(state) {
  const family = familyForLife(state);
  if (!family.contributions.some(row => row.lifeId === state.id)) {
    recordSkillLegacies(family,state);
    family.contributions.push({lifeId:state.id,generation:state.generation,name:state.name,returns:Math.max(0,Math.floor(Number(state.returns)||0)),defeats:Math.max(0,Math.floor(Number(state.defeats)||0)),skills:[...new Set(state.knownSkills||[])].filter(nonBasic).slice(-8)});
    if (family.contributions.length > CONTRIBUTION_LIMIT) { family.contributions.shift(); family.archivedGenerations++; }
  }
  return validateFamily(family);
}
export function familyAffinityForSkill(raw, skill) {
  if (!raw || !skill || !text(skill.id,100)) return 0;
  const family = validateFamily(raw); let score = 0;
  if (family.origin === 'chosen') {
    const tradition = own(FAMILY_TRADITIONS,family.traditionId);
    if (tradition?.weapon && Array.isArray(skill.weapons) && skill.weapons.includes(tradition.weapon)) score += .06;
  }
  const legacy = family.legacies.find(row=>row.skillId===skill.id);
  if (legacy) score += legacy.strength;
  return Number(Math.min(.5,score).toFixed(3));
}
export function familyLegacyForSkill(raw, skillId) {
  if (!raw || !text(skillId,100)) return null;
  return validateFamily(raw).legacies.find(row=>row.skillId===skillId) || null;
}
export function describeFamily(raw) {
  const family = validateFamily(raw);
  const lineage={homeVillageId:family.homeVillageId,migrations:family.migrations.map(row=>({...row})),archivedMigrations:family.archivedMigrations,legacies:family.legacies.map(row=>({...row}))};
  if (family.origin === 'legacy') return {name:'旅人の一族',home:'帰る家',crest:'巡る輪',cultureId:'wanderer',ethos:'自由の家風',tradition:'これから紡ぐ家伝',heirloom:'一族の記録',weapon:null,memory:'歩んできた人生が、この家の根になっている。',teaching:'「お前の道を、歩いておいで。」',practice:'今日の経験も、次の世代へ。',...lineage};
  const culture=own(FAMILY_CULTURES,family.cultureId),ethos=own(FAMILY_ETHOS,family.ethosId),tradition=own(FAMILY_TRADITIONS,family.traditionId);
  return {name:culture.name,home:culture.home,crest:culture.crest,cultureId:culture.id,ethos:ethos.name,tradition:tradition.name,heirloom:tradition.heirloom,weapon:tradition.weapon,memory:culture.memory,teaching:ethos.memory,practice:tradition.practice,traditionMemory:tradition.memory,...lineage};
}
// The journey owns only a draft. No answers can reach a save before explicit confirmation.
export function createFamilyJourney() {
  let step=0,status='choosing';const answers={};
  return {
    snapshot:()=>({step,status,answers:{...answers}}),
    choose(id) {
      if (status !== 'choosing' || step >= FAMILY_QUESTIONS.length) return false;
      const question=FAMILY_QUESTIONS[step];if(!own(question.choices,id))return false;
      answers[question.key]=id;step++;return true;
    },
    back(){if(status!=='choosing'||step===0)return false;step--;return true;},
    cancel(){if(status!=='choosing')return false;status='cancelled';return true;},
    confirm(id,{hasSave=false,replaceAcknowledged=false}={}) {
      if(status!=='choosing'||step!==FAMILY_QUESTIONS.length||(hasSave&&!replaceAcknowledged))return null;
      const family=createFamily(answers,id);status='confirmed';return family;
    },
  };
}
