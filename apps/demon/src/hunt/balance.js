// App-local progression. No browser, storage, renderer or combat-engine dependencies.
export const PROGRESS_KEY = 'huntProgression';
export const UPGRADES = Object.freeze({
  fang: {name: '牙を研ぐ', costs: [8, 16, 28, 44], effect: '技の動作が速くなる'},
  heart: {name: '骨を鍛える', costs: [8, 16, 28, 44], effect: '基礎生命 +18'},
  stride: {name: '足を鍛える', costs: [8, 18, 32], effect: '移動速度 +7%'}
});
export const AUTO_GROWTH_THRESHOLDS = Object.freeze([8, 24, 48, 80, 120, 168]);
export const MISSIONS = Object.freeze([
  {name: '最初の帰還', target: 'traveller', prey: '旅人', quota: 2, marked: false, bonus: 6, scale: 'small'},
  {name: '鐘を黙らせる', target: 'bellkeeper', prey: '鐘番', quota: 3, marked: true, bonus: 8, scale: 'small'},
  {name: '狩る者を狩る', target: 'hunter', prey: '猟師', quota: 3, marked: true, bonus: 10, scale: 'medium'},
  {name: '鉄を喰らう', target: 'smith', prey: '鍛冶師', quota: 4, marked: true, bonus: 12, scale: 'medium'},
  {name: '影を奪う', target: 'arcanist', prey: '術師', quota: 4, marked: true, bonus: 16, scale: 'large'},
  {name: '夜の覇者', target: 'knight', prey: '守護騎士', quota: 5, marked: true, bonus: 20, scale: 'large'}
]);
const PREY_VALUE = Object.freeze({traveller: 2, bellkeeper: 3, gravekeeper: 4, hunter: 5, smith: 5, acolyte: 6, arcanist: 8, knight: 12});
const integer = (v, max = 1_000_000_000) => Number.isSafeInteger(v) && v >= 0 && v <= max;
export function freshProgress() {
  return {version: 1, essence: 0, returns: 0, chapter: 0, bestHaul: 0, upgrades: {fang: 0, heart: 0, stride: 0}, lastResult: null};
}
export function readProgress(profile) {
  const p = profile?.[PROGRESS_KEY];
  if (p === undefined) return freshProgress();
  const fail = () => {throw Error('帰還の記録を確認できません。保存データは上書きしていません。');};
  if (!p || p.version !== 1 || !integer(p.essence) || !integer(p.returns) || !integer(p.chapter, MISSIONS.length) || !integer(p.bestHaul) || !p.upgrades) fail();
  if (p.autoGrowth !== undefined && typeof p.autoGrowth !== 'boolean') fail();
  for (const [key, value] of Object.entries(UPGRADES)) if (!integer(p.upgrades[key], value.costs.length)) fail();
  if (p.lastResult != null) {
    const r = p.lastResult;
    if (!r || !['escaped', 'completed', 'defeated', 'abandoned'].includes(r.status) || typeof r.extracted !== 'boolean' || typeof r.cleared !== 'boolean' || !integer(r.gained) || !integer(r.lost) || !integer(r.carried) || !integer(r.bonus) || !integer(r.eaten) || !integer(r.chapter, MISSIONS.length)) fail();
    const coherent = r.extracted ? r.lost === 0 && r.gained === r.carried + r.bonus : !r.cleared && r.gained === 0 && r.bonus === 0 && r.lost === r.carried;
    if (!coherent) fail();
  }
  return p;
}
function legacyInvestment(progress) {
  return Object.entries(UPGRADES).reduce((sum, [key, upgrade]) =>
    sum + upgrade.costs.slice(0, progress.upgrades[key]).reduce((total, cost) => total + cost, 0), 0);
}
export function automaticGrowth(profile) {
  const p = readProgress(profile), power = p.essence + legacyInvestment(p);
  const active = p.autoGrowth !== false && p.returns > 0;
  const stage = active ? AUTO_GROWTH_THRESHOLDS.filter(threshold => power >= threshold).length : 0;
  const nextAt = active ? AUTO_GROWTH_THRESHOLDS[stage] ?? null : AUTO_GROWTH_THRESHOLDS[0];
  return {
    active, power, stage, nextAt, remaining: nextAt === null ? 0 : Math.max(0, nextAt - power),
    hpBonus: stage * 12, tempoBonus: stage * .05, moveBonus: stage * 3.5
  };
}
export function huntPlan(profile, route = 'mission') {
  if (!['mission', 'forage'].includes(route)) throw Error('狩りの経路が不正です。');
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
  const n = Math.max(0, Math.min(24, Number(meals) || 0)), progress = n / 24;
  const large = ['horn-brute', 'grave-ogre'].includes(species), small = ['night-bat', 'goblin-runt'].includes(species);
  const start = large ? .74 : small ? .58 : .65, end = large ? 1.65 : small ? 1.18 : 1.45;
  const p = readProgress(profile), auto = automaticGrowth(profile);
  const moveBonus = auto.active ? auto.moveBonus : p.upgrades.stride * 7;
  return {progress, scale: start + (end - start) * progress, hpScale: 1 + Math.min(n, 8) * .035,
    powerScale: 1, moveScale: 1 + moveBonus / 100 + Math.min(n, 6) * .012, clearance: .26 + progress * .24};
}
export function bodyStats(profile, meals = 0, species = 'night-creature') {
  const p = readProgress(profile), u = p.upgrades, auto = automaticGrowth(profile), known = profile?.unlocked || [];
  const speciesHP = species === 'grave-ogre' ? 24 : species === 'horn-brute' ? 14 : species === 'night-bat' ? -12 : 0;
  const permanentHp = auto.active ? auto.hpBonus : u.heart * 18;
  const permanentTempo = auto.active ? auto.tempoBonus : u.fang * .08;
  const moveBonus = auto.active ? auto.moveBonus : u.stride * 7;
  const baseHP = 120 + speciesHP + permanentHp + (known.includes('smith') ? 35 : 0) + (profile?.form === 'brute' ? 20 : 0);
  const tempo = Math.min(1.3, .88 + permanentTempo + Math.min(6, Math.max(0, meals)) * .025);
  return {baseHP, maxHP: Math.round(baseHP * growthFor(meals, species, profile).hpScale), tempo,
    techniqueSpeed: Math.round(tempo / .88 * 100), moveBonus: Number(moveBonus.toFixed(1))};
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
  p.essence -= quote.cost; p.upgrades[key]++; p.autoGrowth = false;
  profile[PROGRESS_KEY] = p;
  return true;
}
export function settleProgress(profile, status, eaten, report) {
  const p = structuredClone(readProgress(profile));
  if (!['escaped', 'completed', 'defeated', 'abandoned'].includes(status) || !integer(eaten, 10000)) throw Error('狩りの結果が不正です。');
  if (!report || !integer(report.carried) || report.carried > eaten * 12 || !integer(report.plan?.chapter, MISSIONS.length) || report.plan.chapter !== p.chapter || !['mission', 'forage'].includes(report.plan?.route)) throw Error('戦利品の記録が不正です。');
  // Resolve rewards from canonical balance, never from caller-supplied bonus/quota.
  const plan = huntPlan({[PROGRESS_KEY]: {...p, chapter: report.plan.chapter}}, report.plan.route);
  const extracted = ['escaped', 'completed'].includes(status) && report.returnVerified === true && eaten > 0;
  const goal = goalReady(plan, eaten, report.targetEaten === true);
  const cleared = extracted && goal && plan.route === 'mission' && plan.chapter === p.chapter;
  const bonus = extracted && goal ? plan.bonus : 0;
  const gained = extracted ? report.carried + bonus : 0;
  if (!integer(p.essence + gained) || !integer(p.returns + Number(extracted))) throw Error('帰還の記録が上限に達しました。');
  p.essence += gained; p.returns += Number(extracted);
  if (extracted) p.autoGrowth = true;
  if (cleared) p.chapter = Math.min(MISSIONS.length, p.chapter + 1);
  p.bestHaul = Math.max(p.bestHaul, gained);
  p.lastResult = {status, extracted, cleared, gained, bonus, carried: report.carried, lost: extracted ? 0 : report.carried, eaten, chapter: p.chapter};
  profile[PROGRESS_KEY] = p;
  return p.lastResult;
}
