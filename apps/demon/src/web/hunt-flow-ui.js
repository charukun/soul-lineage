import {UPGRADES, SURVIVAL_SPECIES, readProgress, huntPlan, goalText, bodyStats, upgradeQuote, speciesRule} from '../hunt/balance.js';
import './hunt-flow.css';

const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const byId = id => document.getElementById(id);
export class HuntFlowUi {
  constructor({sheet, start, upgrade, profile, species, toggleReturn, selectSpecies}) {
    Object.assign(this, {sheet, start, upgrade, profile, species, toggleReturn, selectSpecies});
    document.body.classList.add('hunt-loop');
    this.objective = byId('objective');
    this.bag = document.createElement('div'); this.bag.className = 'hunt-bag';
    this.bag.innerHTML = '<span data-haul></span><span data-goal></span><progress max="1" value="0" aria-label="捕食目標"></progress>';
    this.objective.append(this.bag);
    this.bearing = document.createElement('b'); this.bearing.textContent = '↓'; this.bearing.setAttribute('aria-hidden', 'true');
    this.exitText = document.createElement('span'); byId('return-hint').replaceChildren(this.bearing, this.exitText);
    this.actionLine = document.createElement('p'); this.actionLine.className = 'hunt-action';
    this.actionLine.setAttribute('role', 'status'); this.actionLine.hidden = true; this.objective.append(this.actionLine);
    this.actionToken = ''; this.actionAt = 0;
    this.speciesButton = document.createElement('button'); this.speciesButton.id = 'hunt-species'; this.speciesButton.className = 'inline-action';
    this.speciesButton.type = 'button'; this.speciesButton.addEventListener('click', () => this.speciesPicker());
    byId('begin').before(this.speciesButton);
    this.campButton = document.createElement('button'); this.campButton.id = 'hunt-camp'; this.campButton.className = 'inline-action';
    this.campButton.type = 'button'; this.campButton.addEventListener('click', () => this.camp());
    byId('begin').after(this.campButton);
    this.hubStatus = document.createElement('p'); this.hubStatus.className = 'hunt-hub-status';
    this.campButton.after(this.hubStatus);
    this.installReturnHold();
  }
  installReturnHold() {
    const el = byId('return-hint'); let timer = null, pointer = null, ox = 0, oy = 0;
    const clear = () => { if (timer) clearTimeout(timer); timer = null; pointer = null; };
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('pointerdown', e => {
      const game = this.game;
      if (!game || game.finished || game.eaten < 1 || game.devour) return;
      e.preventDefault(); e.stopPropagation();
      if (game.autoReturn) { game.cancelAutoReturn(); clear(); return; }
      pointer = e.pointerId; ox = e.clientX; oy = e.clientY;
      try { el.setPointerCapture(pointer); } catch {}
      timer = setTimeout(() => {
        timer = null;
        if (this.game === game && game.startAutoReturn?.()) {
          this.actionToken = 'auto-return'; this.actionAt = game.time;
        }
      }, 520);
    });
    el.addEventListener('pointermove', e => {
      if (e.pointerId === pointer && Math.hypot(e.clientX - ox, e.clientY - oy) > 14) clear();
    });
    for (const type of ['pointerup','pointercancel','lostpointercapture']) el.addEventListener(type, clear);
  }
  refreshHub(profile) {
    const p = readProgress(profile), plan = huntPlan(profile), chosen = profile.monsterSpecies, rule = chosen ? speciesRule(chosen) : null;
    const stats = bodyStats(profile, 0, chosen || 'night-creature');
    const whisper = document.querySelector('#title .whisper');
    if (whisper) whisper.textContent = `${plan.name} · ${goalText(plan)}`;
    byId('begin').innerHTML = `狩りへ<span aria-hidden="true">◈</span>`;
    byId('begin').disabled = !chosen;
    this.speciesButton.textContent = chosen ? `種族 · ${rule.name}` : '種族を選ぶ';
    this.speciesButton.classList.toggle('required', !chosen);
    this.campButton.textContent = `肉体を強化 · 戦利品 ${p.essence}`;
    this.campButton.classList.toggle('affordable', Object.keys(UPGRADES).some(k => upgradeQuote(profile, k).affordable));
    this.hubStatus.textContent = chosen ? `${rule.name} · 生命 ${stats.baseHP} · 逃走 ${rule.escape} · 技速 ${stats.techniqueSpeed}% · 生還 ${p.returns}回` : 'まず種族を選ぶ。死亡した次の生では、また選び直せる。';
  }
  speciesPicker() {
    const profile = this.profile(), current = profile.monsterSpecies;
    if (current) {
      const rule = speciesRule(current);
      this.sheet('この生の種族', rule.name, `<p>${esc(rule.note)}</p><p class="muted">種族は死亡するまで変更できない。次の生で選び直せる。</p>`, 'species');
      return;
    }
    const cards = Object.values(SURVIVAL_SPECIES).map(rule => `<button type="button" class="inline-action hunt-species-choice" data-species="${rule.id}"><span><b>${esc(rule.name)}</b><small>逃走 ${esc(rule.escape)}</small></span><small>${esc(rule.note)}</small></button>`).join('');
    this.sheet('種族を選ぶ', 'この生の身体', `<p class="hunt-species-note">速い種族は逃げやすく、重い種族は生命が高い。死亡するまで変更できない。</p><div class="hunt-species-grid">${cards}</div>`, 'species');
    for (const button of document.querySelectorAll('[data-species]')) button.addEventListener('click', () => {
      if (!this.selectSpecies?.(button.dataset.species)) return;
      this.refreshHub(this.profile());
      byId('sheet-close')?.click();
    });
  }
  shouldReturn(game) { return game.goalReady() || game.eaten > 0 && game.player.hp < game.player.maxhp * .35; }
  target(game, returning) { return game.fight || game.devour || game.autoReturn || returning || this.shouldReturn(game) ? null : game.nextHuntPrey(); }
  update(game, {returning = false, overlay = false} = {}) {
    this.game = game;
    if (overlay && game.autoReturn) game.cancelAutoReturn?.();
    returning = returning || game.autoReturn || this.shouldReturn(game);
    const plan = game.huntPlan, ready = game.goalReady(), target = this.target(game, returning), exit = game.nearestEscape();
    const heading = this.objective.querySelector(':scope > small'), text = this.objective.querySelector(':scope > span');
    const guide = byId('first-hunt-guide');
    heading.textContent = plan.name;
    text.textContent = game.autoReturn ? `${exit.label}へ自動帰還 · ${Math.ceil(exit.distance)}m` : returning ? `${exit.label}へ · ${Math.ceil(exit.distance)}m` : ready ? '目標達成。持ち帰ろう' : goalText(plan);
    // Action tips are short-lived. The old persistent tutorial remains hidden.
    const token = game.devour ? 'eat' : game.fight ? 'fight' : game.autoReturn ? 'auto-return' : returning ? 'return' : target?.npc.dead ? 'fallen' : game.player.autoRoam ? 'hunt' : 'move';
    if (token !== this.actionToken) { this.actionToken = token; this.actionAt = game.time; }
    const action = {eat:'止まったまま、喰らう', fight:'危険なら敵から離れ続ける', 'auto-return':'自動帰還中。画面を操作すると解除', return:'帰還表示を長押しで自動移動', fallen:'倒れた獲物のそばで止まる', hunt:'獲物を探している', move:'滑らせて移動'}[token];
    guide.hidden = true;
    this.actionLine.hidden = overlay || game.time - this.actionAt > 3.2 || token === 'move' && game.time > 4;
    this.actionLine.textContent = action;
    this.bag.querySelector('[data-haul]').textContent = `持ち帰れば ${game.carried + (ready ? plan.bonus : 0)} 戦利品`;
    this.bag.querySelector('[data-goal]').textContent = `${Math.min(game.eaten, plan.quota)} / ${plan.quota}${plan.marked ? ` · 標的 ${game.targetEaten ? '済' : '未'}` : ''}`;
    this.bag.querySelector('progress').value = Math.min(1, game.eaten / plan.quota);
    byId('hud').dataset.huntState = game.fight ? 'combat' : returning ? 'return' : 'hunt';
    byId('return-hint').hidden = overlay || game.eaten < 1 || game.finished;
    byId('return-hint').classList.toggle('auto-returning', !!game.autoReturn);
    this.bearing.style.transform = `rotate(${(.33 - Math.atan2(exit.x - game.player.x, exit.z - game.player.z)) * 180 / Math.PI}deg)`;
    this.exitText.textContent = game.escapeHold > 0 ? '帰還中…' : game.autoReturn ? `${exit.label} ${Math.ceil(exit.distance)}m · 自動移動中` : `${exit.label} ${Math.ceil(exit.distance)}m · 長押しで自動`;
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
      const message = key === 'heart' ? `基礎生命 ${before.baseHP} → ${after.baseHP}` : key === 'fang' ? `技速 ${before.techniqueSpeed}% → ${after.techniqueSpeed}%` : `移動 ${before.moveBonus >= 0 ? '+' : ''}${before.moveBonus}% → ${after.moveBonus >= 0 ? '+' : ''}${after.moveBonus}%`;
      render(message);
    });
  }
  camp(message = '') {
    const profile = this.profile(), p = readProgress(profile);
    this.sheet('持ち帰った力を、身体へ', '肉体の強化', `<div class="hunt-wallet">戦利品 <b>${p.essence}</b></div><p class="hunt-gain" role="status">${esc(message || '強化はこの生で有効。死亡すると、戦利品ごと全て失う。')}</p>${this.upgradeHtml(profile)}<button class="primary" id="camp-hunt">狩りへ</button>`, 'camp');
    this.bindUpgrades(note => this.camp(note));
    byId('camp-hunt').onclick = () => this.start('mission');
  }
  result(event, game, message = '') {
    const profile = this.profile(), p = readProgress(profile), r = p.lastResult;
    if (!r) throw Error('狩りの精算結果を確認できません。');
    const defeated = event.status === 'defeated', totalLost = r.lost + (r.bankedLost || 0), next = huntPlan(profile, 'mission');
    const headline = defeated ? '死んだ。この生の力は、すべて失われた。' : r.extracted ? r.cleared ? `${game.huntPlan.name}、達成` : '生還。戦利品を確保した。' : '狩りを中断した。';
    const detail = defeated ? `戦利品 ${totalLost}、特能、写した技、肉体強化、章進行を失った。喰痕と転生史だけが残る。` : r.extracted ? `回収 ${r.carried}${r.bonus ? ` ＋ 目標報酬 ${r.bonus}` : ''}` : `未確保の戦利品 ${r.lost} を失った。この生で確保済みの力は残る。`;
    const upgrades = defeated ? '' : this.upgradeHtml(profile);
    const prompt = defeated ? '新しい生では、種族を選び直して最初の帰還から始める。' : message || (Object.keys(UPGRADES).some(k => upgradeQuote(profile, k).affordable) ? '強化できる。次の狩りを有利に。' : '生還を重ねるほど、この生は強くなる。');
    const html = `<div class="hunt-result"><div><small>${defeated ? 'この生で失った戦利品' : r.extracted ? '確保した戦利品' : '失った戦利品'}</small><strong>${defeated ? '−' + totalLost : !r.extracted ? '−' + r.lost : '+' + r.gained}</strong></div><div><small>保有</small><strong>${p.essence}</strong></div></div><p class="hunt-result-detail">${esc(detail)}</p><p class="hunt-gain" role="status">${esc(prompt)}</p>${upgrades}<p class="hunt-next">次：${esc(goalText(next))}</p><button class="primary" id="next-night">${defeated ? '種族を選んで新しい生へ' : '次の狩りへ'}</button>`;
    this.sheet(headline, defeated ? '全ロスト' : '狩りの結果', html, 'result');
    if (!defeated) this.bindUpgrades(note => this.result(event, game, note));
    byId('next-night').onclick = defeated ? () => this.speciesPicker() : () => this.start('mission');
  }
}
