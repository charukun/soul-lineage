import {UPGRADES, readProgress, huntPlan, goalText, bodyStats, upgradeQuote} from '../hunt/balance.js';
import './hunt-flow.css';

const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const byId = id => document.getElementById(id);
export class HuntFlowUi {
  constructor({sheet, guide, start, upgrade, profile, species, toggleReturn}) {
    Object.assign(this, {sheet, guide, start, upgrade, profile, species, toggleReturn});
    document.body.classList.add('hunt-loop');
    this.objective = byId('objective');
    this.bag = document.createElement('div'); this.bag.className = 'hunt-bag';
    this.bag.innerHTML = '<span class="hunt-goal" data-goal></span><span class="hunt-haul" data-haul></span><progress max="1" value="0" aria-label="捕食目標"></progress>';
    this.objective.append(this.bag);
    this.bearing = document.createElement('b'); this.bearing.textContent = '↓'; this.bearing.setAttribute('aria-hidden', 'true');
    this.exitText = document.createElement('span'); this.exitText.className = 'hunt-return-copy';
    this.exitDistance = document.createElement('span'); this.exitValue = document.createElement('strong');
    this.exitText.append(this.exitDistance, this.exitValue); byId('return-hint').replaceChildren(this.bearing, this.exitText);
    this.actionLine = document.createElement('p'); this.actionLine.className = 'hunt-action';
    this.actionLine.setAttribute('role', 'status'); this.actionLine.hidden = true; this.objective.append(this.actionLine);
    this.actionToken = ''; this.actionAt = 0;
    this.guideSeen = new Set();
    this.campButton = document.createElement('button'); this.campButton.id = 'hunt-camp'; this.campButton.className = 'inline-action';
    this.campButton.type = 'button'; this.campButton.addEventListener('click', () => this.camp());
    byId('begin').after(this.campButton);
    this.hubStatus = document.createElement('p'); this.hubStatus.className = 'hunt-hub-status';
    this.campButton.after(this.hubStatus);
  }
  refreshHub(profile) {
    const p = readProgress(profile), plan = huntPlan(profile), stats = bodyStats(profile, 0, this.species?.());
    const whisper = document.querySelector('#title .whisper');
    if (whisper) whisper.textContent = `${plan.name} · ${goalText(plan)}`;
    byId('begin').innerHTML = `狩りへ<span aria-hidden="true">◈</span>`;
    this.campButton.textContent = `肉体を強化 · 戦利品 ${p.essence}`;
    this.campButton.classList.toggle('affordable', Object.keys(UPGRADES).some(k => upgradeQuote(profile, k).affordable));
    this.hubStatus.textContent = `基礎生命 ${stats.baseHP} · 技速 ${stats.techniqueSpeed}% · 生還 ${p.returns}回`;
  }
  shouldReturn(game) { return game.goalReady() || game.eaten > 0 && game.player.hp < game.player.maxhp * .35; }
  target(game, returning) { return game.fight || game.devour || returning || this.shouldReturn(game) ? null : game.nextHuntPrey(); }
  update(game, {returning = false, overlay = false} = {}) {
    returning = returning || this.shouldReturn(game);
    const plan = game.huntPlan, ready = game.goalReady(), target = this.target(game, returning), exit = game.nearestEscape();
    const heading = this.objective.querySelector(':scope > small'), text = this.objective.querySelector(':scope > span');
    const guide = byId('first-hunt-guide');
    heading.textContent = plan.name;
    text.textContent = returning ? `${exit.label}へ · ${Math.ceil(exit.distance)}m` : ready ? '目標達成。持ち帰ろう' : goalText(plan);
    // Action tips are short-lived. The old persistent tutorial remains hidden.
    const token = game.devour ? 'eat' : game.fight ? 'fight' : returning ? 'return' : target?.npc.dead ? 'fallen' : 'move';
    if (!overlay && game.eaten > 0 && !game.fight && !game.devour && !this.guideSeen.has('return-ready')) {
      this.guideSeen.add('return-ready');
      this.guide?.show({side:'right', kicker:'帰りかた', title:'もう、帰れる', body:[{label:'帰還口', text:'輪の中で止まる'},{label:'帰れば', text:'戦利品を確保'}], variant:'compact', duration:4200});
    }
    if (token !== this.actionToken) {
      this.actionToken = token; this.actionAt = game.time;
      if (!overlay && token !== 'move' && !this.guideSeen.has(token)) {
        this.guideSeen.add(token);
        const copy = {
          fight:{kicker:'戦いかた', title:'近づけば、戦いが始まる', body:[{label:'危険なら', text:'敵と逆へ離れる'}]},
          fallen:{kicker:'捕食', title:'倒れた獲物へ', body:[{label:'そばで止まる', text:'捕食を始める'},{label:'動く', text:'捕食を中断'}]},
          eat:{kicker:'捕食', title:'止まったまま、喰らう', body:[{label:'動かない', text:'捕食を続ける'}]},
          return:{kicker:'帰りかた', title:'戦利品を持ち帰れる', body:[{label:'帰還口', text:'輪の中で止まる'}]}
        }[token];
        if (copy) this.guide?.show({...copy, side:'right', variant:token === 'return' ? 'compact' : 'normal', duration:3600});
      }
    }
    guide.hidden = true;
    this.actionLine.hidden = true;
    const haul = game.carried + (ready ? plan.bonus : 0), eaten = Math.min(game.eaten, plan.quota);
    this.bag.querySelector('[data-goal]').textContent = plan.marked ? `${plan.prey}${game.targetEaten ? '済' : '未'} ${eaten}/${plan.quota}` : `人影 ${eaten}/${plan.quota}`;
    this.bag.querySelector('[data-haul]').textContent = `戦利 ${haul}`;
    this.bag.querySelector('progress').value = Math.min(1, game.eaten / plan.quota);
    this.objective.setAttribute('aria-label', `${goalText(plan)}。現在 ${eaten} / ${plan.quota}。持ち帰れば戦利品 ${haul}`);
    byId('hud').dataset.huntState = game.fight ? 'combat' : returning ? 'return' : 'hunt';
    byId('return-hint').hidden = overlay || game.eaten < 1 || game.finished;
    this.bearing.style.transform = `rotate(${(.33 - Math.atan2(exit.x - game.player.x, exit.z - game.player.z)) * 180 / Math.PI}deg)`;
    if (game.escapeHold > 0) {
      this.exitDistance.textContent = '帰還中…'; this.exitValue.textContent = '';
    } else {
      this.exitDistance.textContent = `${Math.ceil(exit.distance)}m`;
      this.exitValue.textContent = `帰還 ${game.carried + (ready ? plan.bonus : 0)}`;
    }
  }
  upgradeHtml(profile) {
    return `<div class="hunt-upgrades">${Object.keys(UPGRADES).map(key => {
      const q = upgradeQuote(profile, key);
      const effect = key === 'fang' ? `技速 ${bodyStats(profile, 0, this.species?.()).techniqueSpeed}% → ${Math.round((.88 + (q.rank + 1) * .08) / .88 * 100)}%` : q.effect;
      return `<button type="button" class="inline-action" data-hunt-upgrade="${key}" ${!q.affordable ? 'disabled' : ''}><span>${q.name} <small>Lv.${q.rank}</small></span><b>${q.maxed ? '極' : q.cost}</b><small>${q.maxed ? '強化完了' : effect}</small></button>`;
    }).join('')}</div>`;
  }
  bindUpgrades(render) {
    for (const button of document.querySelectorAll('[data-hunt-upgrade]')) button.addEventListener('click', () => {
      const key = button.dataset.huntUpgrade, before = bodyStats(this.profile(), 0, this.species?.());
      if (!this.upgrade(key)) return;
      const after = bodyStats(this.profile(), 0, this.species?.());
      const message = key === 'heart' ? `基礎生命 ${before.baseHP} → ${after.baseHP}` : key === 'fang' ? `技速 ${before.techniqueSpeed}% → ${after.techniqueSpeed}%` : `移動 +${before.moveBonus}% → +${after.moveBonus}%`;
      render(message);
    });
  }
  camp(message = '') {
    const profile = this.profile(), p = readProgress(profile);
    this.sheet('持ち帰った力を、身体へ', '肉体の強化', `<div class="hunt-wallet">戦利品 <b>${p.essence}</b></div><p class="hunt-gain" role="status">${esc(message || 'この強化は、死んでも失わない。')}</p>${this.upgradeHtml(profile)}<button class="primary" id="camp-hunt">狩りへ</button>`, 'camp');
    this.bindUpgrades(note => this.camp(note));
    byId('camp-hunt').onclick = () => this.start('mission');
  }
  result(event, game, message = '') {
    const profile = this.profile(), p = readProgress(profile), r = p.lastResult;
    if (!r) throw Error('狩りの精算結果を確認できません。');
    const defeated = event.status === 'defeated', next = huntPlan(profile, defeated ? 'forage' : 'mission');
    const headline = defeated ? '倒れた。力は、残った。' : r.extracted ? r.cleared ? `${game.huntPlan.name}、達成` : '生還。戦利品を確保した。' : '狩りを中断した。';
    const detail = r.extracted ? `回収 ${r.carried}${r.bonus ? ` ＋ 目標報酬 ${r.bonus}` : ''}` : `未確保の戦利品 ${r.lost} を失った。特能と恒久強化は残る。`;
    const html = `<div class="hunt-result"><div><small>${r.extracted ? '確保した戦利品' : '失った戦利品'}</small><strong>${r.extracted ? '+' + r.gained : '−' + r.lost}</strong></div><div><small>保有</small><strong>${p.essence}</strong></div></div><p class="hunt-result-detail">${esc(detail)}</p><p class="hunt-gain" role="status">${esc(message || (Object.keys(UPGRADES).some(k => upgradeQuote(profile, k).affordable) ? '強化できる。次の狩りを有利に。' : '持ち帰るほど、次の身体は強くなる。'))}</p>${this.upgradeHtml(profile)}<p class="hunt-next">次：${esc(goalText(next))}</p><button class="primary" id="next-night">${defeated ? '近場で立て直す' : '次の狩りへ'}</button>${defeated ? '<button class="inline-action" id="retry-mission">同じ目標に再挑戦</button>' : ''}`;
    this.sheet(headline, defeated ? '再挑戦' : '狩りの結果', html, 'result');
    this.bindUpgrades(note => this.result(event, game, note));
    byId('next-night').onclick = () => this.start(defeated ? 'forage' : 'mission');
    if (byId('retry-mission')) byId('retry-mission').onclick = () => this.start('mission');
  }
}
