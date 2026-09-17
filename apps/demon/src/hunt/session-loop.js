import {bodyStats, growthFor, huntPlan, goalReady, preyValue, speciesRule} from './balance.js';

export const AUTO_HUNT_DELAY = 1.2;
const ELITE_ROLES = new Set(['hunter', 'smith', 'acolyte', 'arcanist', 'knight']);

export function withHuntSession(BaseSession, chooseSpecies) {
  return class HuntSession extends BaseSession {
    constructor(village, profile, ports = {}) {
      const plan = huntPlan(profile, village.huntPlan?.route);
      const species = chooseSpecies(profile.id, profile.monsterSpecies);
      super(village, {...profile, monsterSpecies: species}, {
        ...ports,
        consume(role, options = {}) {
          // The named prey always leaves its ability; random extra learning remains unchanged.
          return ports.consume?.(role, {...options, learnTrait: options.learnTrait || role === plan.target}) ?? false;
        }
      });
      this.huntPlan = plan;
      this.carried = 0;
      this.huntReceipt = null;
      this.huntIdle = 0;
      this.autoReturn = false;
      // A short, readable opening on generated maps; keep deep threats and named targets.
      if (village.source === 'generated' && (plan.chapter === 0 || plan.route === 'forage')) {
        for (const npc of this.village.npcs) if (!npc.marked && npc.z > this.village.entry.z - 14 && ['smith', 'hunter'].includes(npc.role)) {
          Object.assign(npc, {role: 'traveller', name: '旅人', hp: 38, maxhp: 38, behavior: 'flee'});
        }
      }
      this.seedStrongEnemies();
      this.syncGrowth(false);
      this.player.hp = this.player.maxhp;
    }
    getMaxHP() { return bodyStats(this.profile, 0, this.monsterSpecies).baseHP; }
    growth() { return growthFor(this.eaten, this.monsterSpecies, this.profile); }
    huntStats() { return bodyStats(this.profile, this.eaten, this.monsterSpecies); }
    goalReady() { return goalReady(this.huntPlan, this.eaten, this.targetEaten); }
    survivalRule() { return speciesRule(this.monsterSpecies); }
    seedStrongEnemies() {
      if (this.village?.source !== 'generated' || this.huntPlan?.route === 'forage' || !Array.isArray(this.village.npcs)) return;
      const entry = this.village.entry || {x:0, z:20};
      const candidates = this.village.npcs.filter(n => !n.marked && ELITE_ROLES.has(n.role) && Math.hypot(n.x - entry.x, n.z - entry.z) > 15)
        .sort((a, b) => b.maxhp - a.maxhp);
      const count = this.huntPlan?.scale === 'large' ? 2 : 1;
      for (const npc of candidates.slice(0, count)) {
        const multiplier = npc.role === 'knight' ? 1.35 : 1.65;
        npc.maxhp = Math.round(npc.maxhp * multiplier);
        npc.hp = npc.maxhp;
        npc.elite = true;
        npc.name = `強敵・${npc.name}`;
      }
    }
    skillSet(npc) {
      const skills = super.skillSet(npc), tempo = this.huntStats().tempo;
      // Native Tidebreak normalizes and actually uses tempo. No decorative powerScale / fake hits.
      return {...skills, loadout: Object.fromEntries(Object.entries(skills.loadout).map(([slot, recipe]) =>
        [slot, {...structuredClone(recipe), tempo}]))};
    }
    engage(npc) {
      const cap = (this.huntPlan?.chapter || 0) < 2 || this.huntPlan?.route === 'forage' ? 2 : 4;
      if (this.fight && (this.combatantCount?.() || 1) >= cap) return;
      return super.engage(npc);
    }
    consume(npc) {
      if (npc.eaten) return;
      this.beforeMeal = {hp: this.player.hp, maxhp: this.player.maxhp};
      try { return super.consume(npc); }
      finally { this.beforeMeal = null; }
    }
    emit(type, data = {}) {
      if (type === 'consume' && this.beforeMeal) {
        const before = this.beforeMeal, maxGain = Math.max(0, this.player.maxhp - before.maxhp);
        const heal = 12 + Math.ceil(this.player.maxhp * .075) + (this.has('traveller') ? 8 : 0);
        this.player.hp = Math.min(this.player.maxhp, before.hp + maxGain + heal);
        const value = preyValue(data.role); this.carried += value;
        data = {...data, reward: {...data.reward, healed: Math.max(0, this.player.hp - before.hp),
          maxHpGain: maxGain, carried: this.carried, lootGain: value, techniqueSpeed: this.huntStats().techniqueSpeed}};
      }
      if (type === 'disengage') {
        const rule = this.survivalRule();
        this.safeTime = rule.grace;
        data = {...data, species: rule.id, grace: rule.grace};
      }
      return super.emit(type, data);
    }
    finish(status) {
      if (this.finished) return;
      const exit = this.nearestEscape();
      this.huntReceipt = {plan: this.huntPlan, carried: this.carried, targetEaten: this.targetEaten,
        returnVerified: this.eaten > 0 && !this.fight && !this.devour && this.escapeHold > 1.6 && exit.distance < 2.8};
      this.autoReturn = false;
      return super.finish(status);
    }
    startAutoReturn() {
      if (this.finished || this.eaten < 1 || this.devour) return false;
      this.autoReturn = true;
      this.huntIdle = 0;
      return true;
    }
    cancelAutoReturn() {
      if (!this.autoReturn) return false;
      this.autoReturn = false;
      if (this.player) this.player.autoRoam = false;
      return true;
    }
    navigationInput(target, stopDistance, amount = .72) {
      const dx = target.x - this.player.x, dz = target.z - this.player.z, distance = Math.hypot(dx, dz);
      if (distance <= stopDistance) return {x:0, z:0, amount:0, dash:false, autoRoam:true, active:false};
      return {x:dx / (distance || 1), z:dz / (distance || 1), amount, dash:false, autoRoam:true, active:false};
    }
    tick(dt, input = {}) {
      const manual = input.active === true || Number(input.amount || 0) > .05;
      if (manual) { this.huntIdle = 0; this.cancelAutoReturn(); }
      let v = input, automatic = false;
      if (this.autoReturn && !this.devour && !this.finished) {
        v = this.navigationInput(this.nearestEscape(), 2.15, .82);
        automatic = true;
      } else if (!manual && !this.fight && !this.devour && !this.finished) {
        if (this.goalReady() || this.player.hp < this.player.maxhp * .35) {
          this.huntIdle = 0;
          // Stay put instead of falling back to the old random wander once it is time to leave.
          v = {...input, x:0, z:0, amount:0, active:true, autoRoam:false};
        } else {
          this.huntIdle += Math.max(0, dt);
          if (this.huntIdle >= AUTO_HUNT_DELAY) {
            const target = this.nextHuntPrey();
            if (target) {
              v = this.navigationInput(target.npc, target.npc.dead ? 2.2 : 3.35, target.npc.dead ? .62 : .72);
              automatic = true;
            }
          }
        }
      } else if (this.fight || this.devour) this.huntIdle = 0;

      if (this.fight && Number(v.amount || 0) > .05) {
        const f = this.fight, p = this.player, d = Math.hypot(p.x - f.npc.x, p.z - f.npc.z);
        const im = Math.hypot(v.x || 0, v.z || 0), ax = (p.x - f.npc.x) / (d || 1), az = (p.z - f.npc.z) / (d || 1);
        const away = im > .001 ? ((v.x || 0) * ax + (v.z || 0) * az) / im : 0;
        if (away > .32 && d > 3.4) {
          const extra = (this.survivalRule().escapeRate - 1) * Math.min(Math.max(0, dt), 1 / 30);
          f.retreat = Math.max(0, Math.min(2, (f.retreat || 0) + extra));
        }
      }

      const result = super.tick(dt, v);
      if (automatic && !this.finished && this.player) this.player.autoRoam = true;
      if (this.finished) this.autoReturn = false;
      return result;
    }
    nextHuntPrey() {
      if (this.finished) return null;
      const p = this.player, plan = this.huntPlan;
      const shelter = this.village.shelter;
      const rows = this.village.npcs.filter(n => !n.eaten && (!shelter || this.has('acolyte') || Math.hypot(n.x - shelter.x, n.z - shelter.z) >= shelter.r)).map(n => ({npc: n, distance: Math.hypot(n.x - p.x, n.z - p.z)}));
      const fallen = rows.filter(r => r.npc.dead).sort((a, b) => a.distance - b.distance)[0];
      if (fallen && fallen.distance < 7) return {...fallen, fresh: false};
      const marked = rows.find(r => r.npc.marked && !r.npc.dead);
      if (plan.marked && !this.targetEaten && this.eaten >= plan.quota - 1 && marked) return {...marked, fresh: true};
      const living = rows.filter(r => !r.npc.dead), ordinary = living.filter(r => !r.npc.elite);
      const pool = ordinary.length ? ordinary : living;
      const prey = pool.sort((a, b) => (a.distance + a.npc.maxhp * .13) - (b.distance + b.npc.maxhp * .13))[0];
      return prey ? {...prey, fresh: !this.has(prey.npc.role)} : null;
    }
  };
}
