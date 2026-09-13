import { DurableObject } from 'cloudflare:workers';
import { buildState } from './collector.mjs';
import { readStored, writeStored } from './github-client.mjs';
import { degradedState } from './fallback-state.mjs';
import { boardAlerts } from './public/health.mjs';
export { buildState } from './collector.mjs';
const STATE_KEY = 'ops-state-v2';
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } }); }
function publicState(state, env) { return state ? { ...state, buildCommit: env.OPS_BUILD_SHA || null, alerts: boardAlerts(state) } : state; }

export class OpsState extends DurableObject {
  constructor(ctx, env) { super(ctx, env); this.ctx = ctx; this.env = env; this.inflight = null; this.inflightAuthenticated = false; }
  async getState() {
    // During migration, another already-published release may have fresher v1 data.
    const current = await readStored(this.ctx.storage, STATE_KEY);
    const legacy = await this.ctx.storage.get('ops-state-v1');
    if (!current) return legacy || null;
    const state = !legacy ? current : (Date.parse(legacy.generatedAt || '') || 0) > (Date.parse(current.generatedAt || '') || 0) ? legacy : current;
    const rescue = await readStored(this.ctx.storage, 'rescue-observation-v1');
    if (rescue && Date.parse(rescue.generatedAt) > Date.parse(state.integrationRescue?.generatedAt || 0)) return { ...state, integrationRescue: rescue };
    return state;
  }
  async observeRescue(snapshot) {
    const previous = await readStored(this.ctx.storage, 'rescue-observation-v1');
    if (!previous || Date.parse(snapshot.generatedAt) > Date.parse(previous.generatedAt)) await writeStored(this.ctx.storage, 'rescue-observation-v1', snapshot);
    return { accepted: true };
  }
  async refresh(source = 'manual', requestToken = '') {
    if (this.inflight) {
      if (!requestToken || this.inflightAuthenticated) return this.inflight;
      // Do not mistake an anonymous Cron result for the explicitly authenticated prime.
      await this.inflight.catch(() => {});
      return this.refresh(source, requestToken);
    }
    this.inflightAuthenticated = Boolean(requestToken || this.env.OPS_GITHUB_TOKEN);
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
        const state = await degradedState(previous, error, { source });
        await writeStored(this.ctx.storage, STATE_KEY, state);
        return state;
      } finally { this.inflight = null; this.inflightAuthenticated = false; }
    })();
    return this.inflight;
  }
}
function authorized(request, env) { return Boolean(env.OPS_REFRESH_TOKEN) && request.headers.get('authorization') === `Bearer ${env.OPS_REFRESH_TOKEN}`; }
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/version' && request.method === 'GET') {
        return json({ app: 'ops-board', commit: env.OPS_BUILD_SHA || null });
      }
      if (url.pathname === '/api/state' && request.method === 'GET') {
        const stub = env.OPS_STATE.getByName('global');
        const state = await stub.getState() || await stub.refresh('cold-start');
        return json(publicState(state, env));
      }
      if (url.pathname === '/api/refresh' && request.method === 'POST') {
        if (!authorized(request, env)) return json({ error: 'unauthorized' }, 401);
        const token = request.headers.get('x-ops-github-token') || '';
        if (token.length > 1024) return json({ error: 'invalid_credential' }, 400);
        const stub = env.OPS_STATE.getByName('global');
        return json(publicState(await stub.refresh('github-event', token), env));
      }
      if (url.pathname === '/api/rescue-observation' && request.method === 'POST') {
        if (!authorized(request, env)) return json({ error: 'unauthorized' }, 401);
        const body = await request.text();
        if (body.length > 900000) return json({ error: 'snapshot_too_large' }, 413);
        const snapshot = JSON.parse(body);
        if (!snapshot.available || !Number.isFinite(Date.parse(snapshot.generatedAt)) || !Array.isArray(snapshot.workers) || !Array.isArray(snapshot.queue)) return json({ error: 'invalid_snapshot' }, 400);
        return json(await env.OPS_STATE.getByName('global').observeRescue(snapshot));
      }
      if (url.pathname.startsWith('/api/')) return json({ error: 'not_found' }, 404);
      return env.ASSETS.fetch(request);
    } catch (error) { return json({ error: String(error?.message || 'state_unavailable') }, 503); }
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(env.OPS_STATE.getByName('global').refresh(`cron:${controller.cron}`));
  },
};
