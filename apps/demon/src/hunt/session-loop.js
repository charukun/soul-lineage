import {bodyStats, growthFor, huntPlan, goalReady, preyValue} from './balance.js';

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
      // A short, readable opening on generated maps; keep deep threats and named targets.
      if (village.source === 'generated' && (plan.chapter === 0 || plan.route === 'forage')) {
        for (const npc of this.village.npcs) if (!npc.marked && npc.z > this.village.entry.z - 14 && ['smith', 'hunter'].includes(npc.role)) {
          Object.assign(npc, {role: 'traveller', name: '旅人', hp: 38, maxhp: 38, behavior: 'flee'});
        }
      }
      this.syncGrowth(false);
      this.player.hp = this.player.maxhp;
    }
    getMaxHP() { return bodyStats(this.profile, 0, this.monsterSpecies).baseHP; }
    growth() { return growthFor(this.eaten, this.monsterSpecies, this.profile); }
    huntStats() { return bodyStats(this.profile, this.eaten, this.monsterSpecies); }
    goalReady() { return goalReady(this.huntPlan, this.eaten, this.targetEaten); }
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
      return super.emit(type, data);
    }
    finish(status) {
      if (this.finished) return;
      const exit = this.nearestEscape();
      this.huntReceipt = {plan: this.huntPlan, carried: this.carried, targetEaten: this.targetEaten,
        returnVerified: this.eaten > 0 && !this.fight && !this.devour && this.escapeHold > 1.6 && exit.distance < 2.8};
      return super.finish(status);
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
      const prey = rows.filter(r => !r.npc.dead).sort((a, b) =>
        (a.distance + a.npc.maxhp * .13) - (b.distance + b.npc.maxhp * .13))[0];
      return prey ? {...prey, fresh: !this.has(prey.npc.role)} : null;
    }
  };
}
