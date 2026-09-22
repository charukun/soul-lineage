import { createVillageCheckpoint, validateVillageCheckpoint } from '@soul/network';
import './village-veil.css';
const params = new URLSearchParams(location.search), role = params.get('villageHostLab');
export function installVillageHostRehearsal(api) {
  if (!['mayor', 'villager'].includes(role)) return null;
  return install(role, api);
}
async function install(role, api) {
  const villageId = params.get('village') || 'foundation';
  const playerId = role === 'mayor' ? 'mayor' : 'villager-' + sessionId(), key = 'rinne.village-host-lab.' + villageId;
  const channel = new BroadcastChannel(key), timing = { lease: 2400, cover: 1000, migration: 7000, notice: 30000, member: 3500 };
  let admitted = false, connected = true, phaseSince = Date.now(), stopped = false;
  const veil = document.createElement('div'); veil.className = 'village-veil'; veil.dataset.phase = 'open'; veil.dataset.notice = 'false';
  veil.innerHTML = '<div class="village-veil__message"><strong>闇が村へ迫っている</strong><small>村との繋がりを確かめています</small></div>'; document.body.append(veil);
  const read = () => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
  const write = value => { localStorage.setItem(key, JSON.stringify(value)); channel.postMessage('state'); return value; };
  const transact = async change => { const run = () => write(change(read(), Date.now())); return navigator.locks ? navigator.locks.request(key + '.lock', run) : run(); };
  const fresh = (member, now) => member?.connected && now - member.seenAt <= timing.member;
  const show = (phase, message) => { if (veil.dataset.phase !== phase) phaseSince = Date.now(); veil.dataset.phase = phase; veil.querySelector('strong').textContent = message; veil.dataset.notice = String(Date.now() - phaseSince >= timing.notice); window.__VILLAGE_WORLD_PAUSED__ = phase !== 'open'; };
  const initial = await transact((state, now) => {
    if (role === 'mayor') return { version: 1, villageId, mayorId: playerId, hostId: playerId, epoch: (state?.epoch || 0) + 1, revision: state?.revision || 0, leaseUntil: now + timing.lease, phase: 'open', migrationAt: null, checkpoint: state?.checkpoint || null, members: { ...(state?.members || {}), [playerId]: { seenAt: now, connected: true, eligible: true } } };
    if (!state || state.phase !== 'open' || !fresh(state.members?.[state.mayorId], now)) return state;
    state.members[playerId] = { seenAt: now, connected: true, eligible: true }; return state;
  });
  admitted = role === 'mayor' || Boolean(initial?.members?.[playerId]);
  if (!admitted) { show('closed', '村長の帰りを待っている'); stopped = true; }
  async function pulse() {
    if (!connected || stopped) return;
    const state = await transact((current, now) => {
      if (!current) return current;
      current.members ||= {}; if (admitted) current.members[playerId] = { seenAt: now, connected: true, eligible: true };
      for (const member of Object.values(current.members)) if (now - member.seenAt > timing.member) member.connected = false;
      const mayorPresent = fresh(current.members[current.mayorId], now);
      if (current.phase === 'open' && now > current.leaseUntil) { current.phase = 'migrating'; current.hostId = null; current.epoch += 1; current.migrationAt = now; }
      if (current.phase === 'migrating') {
        if (now - current.migrationAt < timing.cover) return current;
        const candidates = Object.entries(current.members).filter(([, m]) => fresh(m, now) && m.eligible).sort((a,b)=>b[1].seenAt-a[1].seenAt||a[0].localeCompare(b[0]));
        const candidate = mayorPresent ? current.mayorId : candidates[0]?.[0];
        if (candidate === playerId) { if (current.checkpoint) { validateVillageCheckpoint(current.checkpoint); api.apply(current.checkpoint); } current.hostId = playerId; current.phase = 'open'; current.leaseUntil = now + timing.lease; current.migrationAt = null; }
        else if (!candidate || now - current.migrationAt > timing.migration) { current.phase = 'closed'; current.hostId = null; }
      } else if (current.phase === 'closed' && role === 'mayor') { current.phase = 'migrating'; current.epoch += 1; current.migrationAt = now; }
      if (current.phase === 'open' && current.hostId === playerId) { current.leaseUntil = now + timing.lease; current.checkpoint = createVillageCheckpoint(api.capture()); current.revision = (current.revision || 0) + 1; }
      return current;
    });
    if (!state) show('closed', '村は闇に閉ざされている'); else if (state.phase === 'open') show('open', '闇が晴れていく'); else if (state.phase === 'migrating') show('migrating', '闇が村へ迫っている'); else show('closed', '村は闇に閉ざされている');
  }
  const timer = setInterval(() => pulse().catch(() => show('closed', '村との繋がりが途絶えた')), 500);
  addEventListener('pagehide', () => { connected = false; clearInterval(timer); channel.close(); });
  window.__VILLAGE_HOST_LAB__ = { playerId, role, state: read, disconnect: async () => { connected = false; await transact(s => { if (s?.members[playerId]) s.members[playerId].connected = false; if (s?.hostId === playerId) s.leaseUntil = 0; return s; }); }, reconnect: () => { connected = true; stopped = false; admitted = role === 'mayor' || admitted; pulse(); }, reset: () => { localStorage.removeItem(key); location.reload(); } };
  pulse();
  return { dispose() { connected = false; clearInterval(timer); channel.close(); } };
}
function sessionId() { let id = sessionStorage.getItem('rinne.village-host-lab.id'); if (!id) { id = crypto.randomUUID().slice(0, 8); sessionStorage.setItem('rinne.village-host-lab.id', id); } return id; }
