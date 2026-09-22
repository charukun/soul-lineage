import { MODES, STEP_MS } from '../game/reality-lab/config.js';
import { actorState } from '../game/reality-lab/world.js';

const colors = ['#d7c391', '#92cdb8', '#a9b7e2'];
export function drawWorld(canvas, model) {
  const ctx = canvas.getContext('2d'), width = canvas.width, height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  if (!model) return;
  const point = a => ({ x: 25 + a.cell * 310 + 150 + (a.x - a.cell * 240) * 14, y: 155 + a.z * 13 });
  for (let cell = 0; cell < 3; cell += 1) {
    ctx.fillStyle = model.world.materialized[cell] ? '#1c2d27' : '#151c22';
    ctx.fillRect(15 + cell * 310, 15, 300, height - 30);
    ctx.fillStyle = colors[cell]; ctx.font = '16px sans-serif'; ctx.fillText(`Cell ${cell + 1}`, 30 + cell * 310, 42);
    ctx.font = '12px sans-serif'; ctx.fillStyle = '#a9bbae';
    const owner = model.mode === 'cells' ? model.cellHosts[cell] : model.authority.hostId;
    ctx.fillText(model.world.materialized[cell] ? `配信 ${owner || '—'}` : 'Macro · NPCは未計算', 30 + cell * 310, 63);
  }
  const actors = [...model.world.players, ...model.world.npcs.filter(a => model.world.materialized[a.cell])].map(actorState);
  for (const a of actors.filter(a => a.state === 'player' && model.alive.has(a.id))) {
    const sourceId = model.mode === 'cells' ? model.cellHosts[a.cell] : model.authority.hostId;
    const source = actors.find(p => p.id === sourceId);
    if (source && source.id !== a.id) {
      const p = point(a), s = point(source); ctx.strokeStyle = '#718f7840';
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    }
  }
  for (const a of actors) {
    const p = point(a), dead = a.state === 'player' && !model.alive.has(a.id);
    ctx.fillStyle = dead ? '#64706a' : colors[a.cell];
    if (a.state === 'npc') ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    else {
      ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
      if (model.mode === 'cells' ? model.cellHosts.includes(a.id) : model.authority.hostId === a.id) { ctx.strokeStyle = colors[a.cell]; ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI * 2); ctx.stroke(); }
      ctx.font = '10px sans-serif'; ctx.fillText(a.id, p.x + 7, p.y - 5);
    }
  }
  if (model.authority.phase !== 'open' || !model.alive.has(model.authority.hostId)) {
    ctx.fillStyle = '#04080de0'; ctx.fillRect(0, 0, width, height); ctx.fillStyle = '#d4dccf'; ctx.font = '22px sans-serif';
    ctx.fillText(model.authority.phase === 'closed' ? '復元データ不足 · 世界は停止中' : '闇 · 世界時間は停止中', 280, 145);
  }
}

export function renderResults(container, results) {
  container.replaceChildren();
  for (const r of results) {
    const card = document.createElement('article'); card.className = 'card';
    const h = document.createElement('h3'); h.textContent = MODES[r.mode];
    const big = document.createElement('p'); big.className = 'big'; big.textContent = `${r.maxPeerKbps.toFixed(1)} `;
    const unit = document.createElement('small'); unit.textContent = 'kB/s · 最大端末の平均送信'; big.append(unit);
    const dl = document.createElement('dl');
    const rows = [['Primary平均', `${r.primaryKbps.toFixed(1)} kB/s`], ['総payload', `${(r.payloadBytes / 1000).toFixed(0)} kB`], ['停止 / 巻戻し', `${(r.darkMs / 1000).toFixed(2)} / ${(r.rollbackMs / 1000).toFixed(2)} 秒`], ['不一致 / 再同期受信', `${r.invalid} / ${r.repairs}`], ['位置誤差 平均', r.meanPositionError === null ? '未観測' : `${r.meanPositionError.toFixed(2)} m`], ['未受信サンプル', r.missingSamples], ['個体更新回数', r.actorUpdates.toLocaleString()], ['復元の照合', r.collapseMatchesReference ? '逐次計算と一致' : '不一致'], ['最終状態 / Epoch', `${r.phase} / ${r.epoch}`]];
    for (const [name, value] of rows) { const row = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = name; dd.textContent = value; if (r.phase !== 'open' && name.startsWith('最終')) dd.className = 'warning'; row.append(dt, dd); dl.append(row); }
    card.append(h, big, dl); container.append(card);
  }
}
export function renderEvents(list, models) {
  list.replaceChildren();
  for (const model of models) for (const event of model.events) {
    const li = document.createElement('li'); li.textContent = `${MODES[model.mode]} · ${(event.at / 1000).toFixed(2)}秒 · E${event.epoch} · ${event.message}`; list.append(li);
  }
}
export function worldCaption(model) {
  return `${MODES[model.mode]} · 仮想経過 ${(model.now / 1000).toFixed(2)}秒 / 世界 ${(model.world.tick * STEP_MS / 1000).toFixed(2)}秒 · Epoch ${model.authority.epoch} · Host ${model.authority.hostId || '不在'} · 遠方の兆し受信 ${model.omenRecipients.size}人 · 図は模型の正解状態`;
}
