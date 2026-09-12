import { DurableObject } from 'cloudflare:workers';
import { buildState } from './collector.mjs';
import { readStored, writeStored } from './github-client.mjs';
import { boardAlerts } from './public/health.mjs';
export { buildState } from './collector.mjs';
const STATE_KEY = 'ops-state-v2';
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } }); }
function publicState(state) { return state ? { ...state, alerts: boardAlerts(state) } : state; }

export class OpsState extends DurableObject {
  constructor(ctx, env) { super(ctx, env); this.ctx = ctx; this.env = env; this.inflight = null; }
  async getState() { return await readStored(this.ctx.storage, STATE_KEY) || await this.ctx.storage.get('ops-state-v1') || null; }
  async refresh(source = 'manual', requestToken = '') {
    if (this.inflight) return this.inflight;
    this.inflight = (async () => {
      const previous = await this.getState();
      try {
        // An Actions token is used for this request only, never persisted or sent to browsers.
        const token = requestToken || this.env.OPS_GITHUB_TOKEN || '';
        const state = await buildState(previous, { storage: this.ctx.storage, token });
        state.refreshReason = source;
        await writeStored(this.ctx.storage, STATE_KEY, state);
        return state;
      } catch (error) {
        if (!previous) throw error;
        const degraded = { ...previous, syncStatus: 'degraded', syncError: String(error?.message || '取得失敗'), lastAttemptAt: new Date().toISOString(),
          nextRetryAt: error.retryAt ? new Date(error.retryAt).toISOString() : null, refreshReason: source };
        await writeStored(this.ctx.storage, STATE_KEY, degraded);
        return degraded;
      } finally { this.inflight = null; }
    })();
    return this.inflight;
  }
}
function authorized(request, env) { return Boolean(env.OPS_REFRESH_TOKEN) && request.headers.get('authorization') === `Bearer ${env.OPS_REFRESH_TOKEN}`; }
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/state' && request.method === 'GET') {
        const stub = env.OPS_STATE.getByName('global');
        const state = await stub.getState() || await stub.refresh('cold-start');
        return json(publicState(state));
      }
      if (url.pathname === '/api/refresh' && request.method === 'POST') {
        if (!authorized(request, env)) return json({ error: 'unauthorized' }, 401);
        const token = request.headers.get('x-ops-github-token') || '';
        if (token.length > 1024) return json({ error: 'invalid_credential' }, 400);
        const stub = env.OPS_STATE.getByName('global');
        return json(publicState(await stub.refresh('github-event', token)));
      }
      if (url.pathname.startsWith('/api/')) return json({ error: 'not_found' }, 404);
      return env.ASSETS.fetch(request);
    } catch (error) { return json({ error: String(error?.message || 'state_unavailable') }, 503); }
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(env.OPS_STATE.getByName('global').refresh(`cron:${controller.cron}`));
  },
};
