import {readProgress, huntPlan, goalText, bodyStats, automaticGrowth} from '../hunt/balance.js';
import './hunt-flow.css';
import './hunt-minimal-hud.css';
import './title-readability.css';

const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const byId = id => document.getElementById(id);
export class HuntFlowUi {
  constructor({sheet, guide, start, profile, species, toggleReturn}) {
    Object.assign(this, {sheet, guide, start, profile, species, toggleReturn});
    document.body.classList.add('hunt-loop');
    this.objective = byId('objective');
    this.bag = document.createElement('div'); this.bag.className = 'hunt-bag';
    this.bag.innerHTML = '<span class="hunt-goal" data-goal></span><span class="hunt-haul" data-haul></span><span class="hunt-alert" data-alert></span><progress max="1" value="0" aria-label="捕食目標"></progress>';
    this.objective.append(this.bag);
    this.bearing = document.createElement('b'); this.bearing.textContent = '↓'; this.bearing.setAttribute('aria-hidden', 'true');
    this.exitText = document.createElement('span'); this.exitText.className = 'hunt-return-copy';
    this.exitDistance = document.createElement('span'); this.exitValue = document.createElement('strong');
    this.exitText.append(this.exitDistance, this.exitValue); byId('return-hint').replaceChildren(this.bearing, this.exitText);
    this.actionLine = document.createElement('p'); this.actionLine.className = 'hunt-action';
    this.actionLine.setAttribute('role', 'status'); this.actionLine.hidden = true; this.objective.append(this.actionLine);
    this.actionToken = ''; this.actionAt = 0;
    this.guideSeen = new Set();
    this.hubStatus = document.createElement('p'); this.hubStatus.className = 'hunt-hub-status';
    document.querySelector('#title .title-menu')?.after(this.hubStatus);
  }
  refreshHub(profile) {
    const p = readProgress(profile), plan = huntPlan(profile), growth = automaticGrowth(profile);
    const whisper = document.querySelector('#title .whisper');
    if (whisper) whisper.textContent = `${plan.name} · ${goalText(plan)}`;
    this.hubStatus.textContent = `戦利品 ${growth.power} · 成長 ${growth.stage}段 · 生還 ${p.returns}回`;
    this.hubStatus.setAttribute('aria-label', `戦利品 ${growth.power}。成長 ${growth.stage}段。強さは戦利品に応じて自動で成長します。`);
  }
  shouldReturn(game) { return game.goalReady() || game.eaten > 0 && game.player.hp < game.player.maxhp * .35; }
  target(game, returning) { return game.fight || game.devour || returning || this.shouldReturn(game) ? null : game.nextHuntPrey(); }
  update(game, {returning = false, overlay = false} = {}) {
    returning = returning || this.shouldReturn(game);
    const plan = game.huntPlan, ready = game.goalReady(), pressure = game.huntPressure?.() || {level:0,label:'低'}, target = this.target(game, returning), exit = game.nearestEscape();
    const heading = this.objective.querySelector(':scope > small'), text = this.objective.querySelector(':scope > span');
    const guide = byId('first-hunt-guide');
    heading.textContent = plan.name;
    text.textContent = returning ? `${exit.label}へ · ${Math.ceil(exit.distance)}m` : ready ? '目標達成。持ち帰ろう' : goalText(plan);
    const token = game.devour ? 'eat' : game.fight ? 'fight' : returning ? 'return' : target?.npc.dead ? 'fallen' : 'move';
    if (!overlay && game.eaten > 0 && !game.fight && !game.devour && !this.guideSeen.has('return-ready')) {
      this.guideSeen.add('return-ready');
      this.guide?.show({side:'right', kicker:'帰りかた', title:'もう、帰れる', body:[{label:'帰還口', text:'輪の中で止まる'},{label:'欲張ると', text:'警戒が上がる'},{label:'帰れば', text:'戦利品を確保'}], variant:'compact', duration:4200});
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
    const alert = this.bag.querySelector('[data-alert]'); alert.textContent = `警戒 ${pressure.label}`; alert.dataset.level = String(pressure.level);
    this.bag.querySelector('progress').value = Math.min(1, game.eaten / plan.quota);
    this.objective.setAttribute('aria-label', `${goalText(plan)}。現在 ${eaten} / ${plan.quota}。持ち帰れば戦利品 ${haul}。警戒 ${pressure.label}`);
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
  result(event, game, message = '') {
    const profile = this.profile(), p = readProgress(profile), r = p.lastResult, growth = automaticGrowth(profile);
    if (!r) throw Error('狩りの精算結果を確認できません。');
    const defeated = event.status === 'defeated', next = huntPlan(profile, defeated ? 'forage' : 'mission');
    const stats = bodyStats(profile, 0, this.species?.());
    const headline = defeated ? '倒れた。力は、残った。' : r.extracted ? r.cleared ? `${game.huntPlan.name}、達成` : '生還。戦利品を確保した。' : '狩りを中断した。';
    const detail = r.extracted ? `回収 ${r.carried}${r.bonus ? ` ＋ 目標報酬 ${r.bonus}` : ''}` : `未確保の戦利品 ${r.lost} を失った。特能と確保済みの成長は残る。`;
    const nextGrowth = growth.nextAt === null ? '成長は上限' : `次の成長まで ${growth.remaining}`;
    const growthLine = `自動成長 ${growth.stage}段 · 生命 ${stats.baseHP} · 技速 ${stats.techniqueSpeed}% · ${nextGrowth}`;
    const gainNote = message || (r.gained > 0 ? '持ち帰った戦利品が強さに自動反映された。' : '確保済みの戦利品に応じて強さは自動で決まる。');
    const html = `<div class="hunt-result"><div><small>${r.extracted ? '確保した戦利品' : '失った戦利品'}</small><strong>${r.extracted ? '+' + r.gained : '−' + r.lost}</strong></div><div><small>累積戦利</small><strong>${growth.power}</strong></div></div><p class="hunt-result-detail">${esc(detail)}</p><p class="hunt-gain" role="status">${esc(gainNote)}</p><p class="hunt-next">${esc(growthLine)}</p><p class="hunt-next">次：${esc(goalText(next))}</p><button class="primary" id="next-night">${defeated ? '近場で立て直す' : '次の狩りへ'}</button>${defeated ? '<button class="inline-action" id="retry-mission">同じ目標に再挑戦</button>' : ''}`;
    this.sheet(headline, defeated ? '再挑戦' : '狩りの結果', html, 'result');
    byId('next-night').onclick = () => this.start(defeated ? 'forage' : 'mission');
    if (byId('retry-mission')) byId('retry-mission').onclick = () => this.start('mission');
  }
}
