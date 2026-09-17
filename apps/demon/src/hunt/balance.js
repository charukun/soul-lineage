// App-local progression. No browser, storage, renderer or combat-engine dependencies.
export const PROGRESS_KEY = 'huntProgression';
export const UPGRADES = Object.freeze({
  fang: {name: '牙を研ぐ', costs: [8, 16, 28, 44], effect: '技の動作が速くなる'},
  heart: {name: '骨を鍛える', costs: [8, 16, 28, 44], effect: '基礎生命 +18'},
  stride: {name: '足を鍛える', costs: [8, 18, 32], effect: '移動速度 +7%'}
});
export const MISSIONS = Object.freeze([
  {name: '最初の帰還', target: 'traveller', prey: '旅人', quota: 2, marked: false, bonus: 6, scale: 'small'},
  {name: '鐘を黙らせる', target: 'bellkeeper', prey: '鐘番', quota: 3, marked: true, bonus: 8, scale: 'small'},
  {name: '狩る者を狩る', target: 'hunter', prey: '猟師', quota: 3, marked: true, bonus: 10, scale: 'medium'},
  {name: '鉄を喰らう', target: 'smith', prey: '鍛冶師', quota: 4, marked: true, bonus: 12, scale: 'medium'},
  {name: '影を奪う', target: 'arcanist', prey: '術師', quota: 4, marked: true, bonus: 16, scale: 'large'},
  {name: '夜の覇者', target: 'knight', prey: '守護騎士', quota: 5, marked: true, bonus: 20, scale: 'large'}
]);
export const SURVIVAL_SPECIES = Object.freeze({
  'night-creature': Object.freeze({id:'night-creature', name:'夜喰い', escape:'標準', escapeRate:1, grace:2.1, moveScale:1, hpBonus:0, note:'癖が少なく、狩りと逃走の両方をこなす。'}),
  'goblin-runt': Object.freeze({id:'goblin-runt', name:'餓小鬼', escape:'高', escapeRate:1.28, grace:2.7, moveScale:1.12, hpBonus:-10, note:'小さく素早い。生命は低いが追跡を振り切りやすい。'}),
  'horn-brute': Object.freeze({id:'horn-brute', name:'角暴鬼', escape:'低', escapeRate:.82, grace:1.7, moveScale:.91, hpBonus:14, note:'打たれ強い。逃走は苦手で、戦うか早めに退く判断が要る。'}),
  'maw-stalker': Object.freeze({id:'maw-stalker', name:'裂顎影', escape:'高', escapeRate:1.45, grace:3, moveScale:1.18, hpBonus:-4, note:'追跡と離脱が得意。強敵を避けて獲物を選びやすい。'}),
  'grave-ogre': Object.freeze({id:'grave-ogre', name:'墓喰大鬼', escape:'最低', escapeRate:.68, grace:1.45, moveScale:.82, hpBonus:24, note:'非常に頑丈だが鈍い。深追いすると帰れなくなる。'}),
  'night-bat': Object.freeze({id:'night-bat', name:'夜蝙蝠', escape:'最高', escapeRate:1.7, grace:3.4, moveScale:1.27, hpBonus:-12, note:'最速の離脱型。生命が低く、捕まると脆い。'})
});
const PREY_VALUE = Object.freeze({traveller: 2, bellkeeper: 3, gravekeeper: 4, hunter: 5, smith: 5, acolyte: 6, arcanist: 8, knight: 12});
const integer = (v, max = 1_000_000_000) => Number.isSafeInteger(v) && v >= 0 && v <= max;
export function speciesRule(species = 'night-creature') { return SURVIVAL_SPECIES[species] || SURVIVAL_SPECIES['night-creature']; }
export function freshProgress() {
  return {version: 1, essence: 0, returns: 0, chapter: 0, bestHaul: 0, upgrades: {fang: 0, heart: 0, stride: 0}, lastResult: null};
}
export function readProgress(profile) {
  const p = profile?.[PROGRESS_KEY];
  if (profile?.monsterSpecies !== undefined && !Object.hasOwn(SURVIVAL_SPECIES, profile.monsterSpecies)) throw Error('種族の記録を確認できません。保存データは上書きしていません。');
  if (p === undefined) return freshProgress();
  const fail = () => {throw Error('帰還の記録を確認できません。保存データは上書きしていません。');};
  if (!p || p.version !== 1 || !integer(p.essence) || !integer(p.returns) || !integer(p.chapter, MISSIONS.length) || !integer(p.bestHaul) || !p.upgrades) fail();
  for (const [key, value] of Object.entries(UPGRADES)) if (!integer(p.upgrades[key], value.costs.length)) fail();
  if (p.lastResult != null) {
    const r = p.lastResult;
    if (!r || !['escaped', 'completed', 'defeated', 'abandoned'].includes(r.status) || typeof r.extracted !== 'boolean' || typeof r.cleared !== 'boolean' || !integer(r.gained) || !integer(r.lost) || !integer(r.carried) || !integer(r.bonus) || !integer(r.eaten) || !integer(r.chapter, MISSIONS.length) || r.fullLoss !== undefined && typeof r.fullLoss !== 'boolean' || r.bankedLost !== undefined && !integer(r.bankedLost)) fail();
  }
  return p;
}
export function huntPlan(profile, route = 'mission') {
  const progress = readProgress(profile), chapter = progress.chapter;
  if (route === 'forage') return {chapter, route, name: '近場で立て直す', target: 'traveller', prey: '旅人', quota: 2, marked: false, bonus: 2, scale: 'small'};
  return {...MISSIONS[Math.min(chapter, MISSIONS.length - 1)], chapter, route: 'mission'};
}
export function chooseHunt(offers, profile, route = 'mission') {
  const plan = huntPlan(profile, route);
  const source = offers.find(v => v.source === 'generated' && v.raidScale === plan.scale) || offers.find(v => v.source === 'generated');
  if (!source) throw Error('今夜の狩場を見つけられませんでした。');
  // Keep the canonical, already-offered village ID: no new re-entry identity.
  return {...source, target: plan.target, raidScale: plan.scale, huntPlan: plan};
}
export function preyValue(role) { return PREY_VALUE[role] || 0; }
export function goalReady(plan, eaten, targetEaten) {
  return eaten >= plan.quota && (!plan.marked || targetEaten);
}
export function goalText(plan) { return plan.marked ? `${plan.prey}を含む${plan.quota}体を喰らって帰る` : `${plan.quota}体を喰らって帰る`; }
export function growthFor(meals = 0, species = 'night-creature', profile = {}) {
  const n = Math.max(0, Math.min(24, Number(meals) || 0)), progress = n / 24, rule = speciesRule(species);
  const large = ['horn-brute', 'grave-ogre'].includes(species), small = ['night-bat', 'goblin-runt'].includes(species);
  const start = large ? .74 : small ? .58 : .65, end = large ? 1.65 : small ? 1.18 : 1.45;
  const rank = readProgress(profile).upgrades.stride;
  return {progress, scale: start + (end - start) * progress, hpScale: 1 + Math.min(n, 8) * .035,
    powerScale: 1, moveScale: rule.moveScale + rank * .07 + Math.min(n, 6) * .012, clearance: .26 + progress * .24};
}
export function bodyStats(profile, meals = 0, species = 'night-creature') {
  const u = readProgress(profile).upgrades, known = profile?.unlocked || [], rule = speciesRule(species);
  const baseHP = 120 + rule.hpBonus + u.heart * 18 + (known.includes('smith') ? 35 : 0) + (profile?.form === 'brute' ? 20 : 0);
  const tempo = Math.min(1.3, .88 + u.fang * .08 + Math.min(6, Math.max(0, meals)) * .025);
  return {baseHP, maxHP: Math.round(baseHP * growthFor(meals, species, profile).hpScale), tempo,
    techniqueSpeed: Math.round(tempo / .88 * 100), moveBonus: Math.round((growthFor(0, species, profile).moveScale - 1) * 100)};
}
export function chooseLifeSpecies(profile, species) {
  if (!Object.hasOwn(SURVIVAL_SPECIES, species)) throw Error('選べない種族です。');
  if (profile.monsterSpecies) {
    if (profile.monsterSpecies === species) return false;
    throw Error('種族はこの生が終わるまで変更できません。');
  }
  profile.monsterSpecies = species;
  return true;
}
export function upgradeQuote(profile, key) {
  if (!Object.hasOwn(UPGRADES, key)) throw Error('その強化はありません。');
  const p = readProgress(profile), upgrade = UPGRADES[key], rank = p.upgrades[key], cost = upgrade.costs[rank] ?? null;
  return {...upgrade, key, rank, cost, maxed: cost === null, affordable: cost !== null && p.essence >= cost};
}
export function buyUpgrade(profile, key) {
  const quote = upgradeQuote(profile, key);
  if (!quote.affordable) return false;
  const p = structuredClone(readProgress(profile));
  p.essence -= quote.cost; p.upgrades[key]++;
  profile[PROGRESS_KEY] = p;
  return true;
}
export function loseLifeProgress(profile, result = readProgress(profile).lastResult) {
  if (!result || result.status !== 'defeated') throw Error('死亡していない生を失うことはできません。');
  profile.unlocked = [];
  profile.equipped = [];
  profile.form = 'hollow';
  profile.adaptations = {};
  delete profile.monsterSpecies;
  const next = freshProgress();
  next.lastResult = {...structuredClone(result), fullLoss: true};
  profile[PROGRESS_KEY] = next;
  return next.lastResult;
}
export function settleProgress(profile, status, eaten, report) {
  const p = structuredClone(readProgress(profile));
  if (!['escaped', 'completed', 'defeated', 'abandoned'].includes(status) || !integer(eaten, 10000)) throw Error('狩りの結果が不正です。');
  if (!report || !integer(report.carried) || report.carried > eaten * 12 || !integer(report.plan?.chapter, MISSIONS.length) || !['mission', 'forage'].includes(report.plan?.route)) throw Error('戦利品の記録が不正です。');
  // Resolve rewards from canonical balance, never from caller-supplied bonus/quota.
  const plan = huntPlan({[PROGRESS_KEY]: {...p, chapter: report.plan.chapter}}, report.plan.route);
  const extracted = ['escaped', 'completed'].includes(status) && report.returnVerified === true && eaten > 0;
  const goal = goalReady(plan, eaten, report.targetEaten === true);
  const cleared = extracted && goal && plan.route === 'mission' && plan.chapter === p.chapter;
  const bonus = extracted && goal ? plan.bonus : 0;
  const gained = extracted ? report.carried + bonus : 0;
  if (!integer(p.essence + gained) || !integer(p.returns + Number(extracted))) throw Error('帰還の記録が上限に達しました。');
  const lost = extracted ? 0 : report.carried, bankedLost = status === 'defeated' ? p.essence : 0;
  if (!integer(lost) || !integer(bankedLost)) throw Error('失った戦利品の記録が上限に達しました。');
  p.essence += gained; p.returns += Number(extracted);
  if (cleared) p.chapter = Math.min(MISSIONS.length, p.chapter + 1);
  p.bestHaul = Math.max(p.bestHaul, gained);
  p.lastResult = {status, extracted, cleared, gained, bonus, carried: report.carried, lost, bankedLost, eaten, chapter: p.chapter, fullLoss: status === 'defeated'};
  profile[PROGRESS_KEY] = p;
  return p.lastResult;
}
