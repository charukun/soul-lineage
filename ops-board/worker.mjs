import { DurableObject } from 'cloudflare:workers';
import { buildState } from './collector.mjs';
import { readStored, writeStored } from './github-client.mjs';
import { degradedState } from './fallback-state.mjs';
import { reconcileRetryAlarm } from './retry-alarm.mjs';
import { boardAlerts } from './public/health.mjs';
import {
  PEER_WORLD_REGISTRY_KEY,emptyPeerWorldRegistry,createPeerWorldRoom,listPeerWorldRooms,joinPeerWorldRoom,
  readHostEvents,postPeerWorldOffer,readGuestEvents,postPeerWorldAnswer,updatePeerWorldTelemetry,
  deletePeerWorldRoom,publicPeerWorldSnapshot,
} from './peer-world-registry.mjs';
export { buildState } from './collector.mjs';
const STATE_KEY = 'ops-state-v2';
const PEER_CORS={
  'access-control-allow-origin':'*',
  'access-control-allow-methods':'GET,POST,DELETE,OPTIONS',
  'access-control-allow-headers':'content-type,authorization',
  'access-control-max-age':'600',
};
function json(data, status = 200, extra = {}) { return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra } }); }
function peerJson(data,status=200){return json(data,status,PEER_CORS);}
function publicState(state, env) { return state ? { ...state, buildCommit: env.OPS_BUILD_SHA || null, alerts: boardAlerts(state) } : state; }
const bearer=request=>{const value=request.headers.get('authorization')||'';return value.startsWith('Bearer ')?value.slice(7):'';};
async function peerBody(request,max=110000){const text=await request.text();if(text.length>max)throw new Error('payload_too_large');return text?JSON.parse(text):{};}
function peerErrorStatus(message){return message==='unauthorized'?401:message==='room_not_found'||message==='join_not_found'?404:message==='room_limit'||message==='join_limit'?429:400;}
const EVENT_REASONS = new Set(['prime', 'pr-event', 'integration', 'deployment']);
function eventReason(request) {
  const reason = (request.headers.get('x-ops-refresh-reason') || '').trim().toLowerCase();
  return EVENT_REASONS.has(reason) ? `github-event:${reason}` : 'github-event';
}
function githubAuthError(source) {
  return Object.assign(new Error('github_auth_required'), {
    authRequired: true,
    githubDiagnostic: { kind: 'auth-required', status: null, scope: 'none', source },
  });
}

export class OpsState extends DurableObject {
  constructor(ctx, env) { super(ctx, env); this.ctx = ctx; this.env = env; this.inflight = null; }
  async getState() {
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
  async peerRegistry(){return await readStored(this.ctx.storage,PEER_WORLD_REGISTRY_KEY)||emptyPeerWorldRegistry();}
  async peerApply(operation,...args){const current=await this.peerRegistry();const {state,result}=operation(current,...args,Date.now());await writeStored(this.ctx.storage,PEER_WORLD_REGISTRY_KEY,state);return result;}
  async peerSnapshot(){return publicPeerWorldSnapshot(await this.peerRegistry(),Date.now());}
  async peerList(){return this.peerApply(listPeerWorldRooms);}
  async peerCreate(input){return this.peerApply(createPeerWorldRoom,input);}
  async peerJoin(roomId,input,token){return this.peerApply(joinPeerWorldRoom,roomId,{...input,inviteToken:token});}
  async peerHostEvents(roomId,token,after){return this.peerApply(readHostEvents,roomId,token,after);}
  async peerOffer(roomId,joinId,token,offer){return this.peerApply(postPeerWorldOffer,roomId,joinId,token,offer);}
  async peerGuestEvents(roomId,joinId,token,after){return this.peerApply(readGuestEvents,roomId,joinId,token,after);}
  async peerAnswer(roomId,joinId,token,answer){return this.peerApply(postPeerWorldAnswer,roomId,joinId,token,answer);}
  async peerTelemetry(roomId,token,input){return this.peerApply(updatePeerWorldTelemetry,roomId,token,input);}
  async peerDelete(roomId,token){return this.peerApply(deletePeerWorldRoom,roomId,token);}
  async refresh(source = 'manual', requestToken = '') {
    if (this.inflight) return this.inflight;
    const token = (requestToken || this.env.OPS_GITHUB_TOKEN || '').trim();
    if (!token) throw githubAuthError(source);
    this.inflight = (async () => {
      let previous = null;
      try {
        previous = await this.getState();
        const state = await buildState(previous, { storage: this.ctx.storage, token, reason: source });
        state.refreshReason = source;
        state.nextRetryAt = null;
        await writeStored(this.ctx.storage, STATE_KEY, state);
        await reconcileRetryAlarm(this.ctx.storage, state);
        return state;
      } catch (error) {
        const state = await degradedState(previous, error, { source });
        await writeStored(this.ctx.storage, STATE_KEY, state);
        await reconcileRetryAlarm(this.ctx.storage, state);
        return state;
      } finally { this.inflight = null; }
    })();
    return this.inflight;
  }
  async alarm() {
    if (!this.env.OPS_GITHUB_TOKEN) return;
    await this.refresh('rate-limit-retry');
  }
}
function authorized(request, env) { return Boolean(env.OPS_REFRESH_TOKEN) && request.headers.get('authorization') === `Bearer ${env.OPS_REFRESH_TOKEN}`; }
async function handlePeerWorld(request,url,stub){
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:PEER_CORS});
  const segments=url.pathname.split('/').filter(Boolean); // api, peer-world, rooms, ...
  try{
    if(segments.length===3&&segments[2]==='rooms'){
      if(request.method==='GET')return peerJson(await stub.peerList());
      if(request.method==='POST')return peerJson(await stub.peerCreate(await peerBody(request)),201);
    }
    if(segments[2]!=='rooms'||!segments[3])return peerJson({error:'not_found'},404);
    const roomId=segments[3],token=bearer(request);
    if(segments.length===4&&request.method==='DELETE')return peerJson(await stub.peerDelete(roomId,token));
    if(segments[4]==='join'&&segments.length===5&&request.method==='POST')return peerJson(await stub.peerJoin(roomId,await peerBody(request),token),201);
    if(segments[4]==='host-events'&&request.method==='GET')return peerJson(await stub.peerHostEvents(roomId,token,Number(url.searchParams.get('after')||0)));
    if(segments[4]==='telemetry'&&request.method==='POST')return peerJson(await stub.peerTelemetry(roomId,token,await peerBody(request)));
    if(segments[4]==='joins'&&segments[5]){
      const joinId=segments[5];
      if(segments[6]==='offer'&&request.method==='POST'){const body=await peerBody(request);return peerJson(await stub.peerOffer(roomId,joinId,token,body.offer));}
      if(segments[6]==='events'&&request.method==='GET')return peerJson(await stub.peerGuestEvents(roomId,joinId,token,Number(url.searchParams.get('after')||0)));
      if(segments[6]==='answer'&&request.method==='POST'){const body=await peerBody(request);return peerJson(await stub.peerAnswer(roomId,joinId,token,body.answer));}
    }
    return peerJson({error:'not_found'},404);
  }catch(error){return peerJson({error:String(error?.message||'peer_world_error')},peerErrorStatus(error?.message));}
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if(url.pathname.startsWith('/api/peer-world/'))return handlePeerWorld(request,url,env.OPS_STATE.getByName('global'));
      if (url.pathname === '/api/version' && request.method === 'GET') return json({ app: 'ops-board', commit: env.OPS_BUILD_SHA || null });
      if (url.pathname === '/api/state' && request.method === 'GET') {
        const stub = env.OPS_STATE.getByName('global');
        let state = await stub.getState();
        if (!state && env.OPS_GITHUB_TOKEN) state = await stub.refresh('cold-start');
        if (!state) return json({ error: 'github_auth_required' }, 503);
        return json({ ...publicState(state, env), sharedWorld: await stub.peerSnapshot() });
      }
      if (url.pathname === '/api/refresh' && request.method === 'POST') {
        if (!authorized(request, env)) return json({ error: 'unauthorized' }, 401);
        const token = (request.headers.get('x-ops-github-token') || '').trim();
        if (token.length > 1024) return json({ error: 'invalid_credential' }, 400);
        if (!token && !env.OPS_GITHUB_TOKEN) return json({ error: 'github_auth_required' }, 503);
        const stub = env.OPS_STATE.getByName('global');
        return json(publicState(await stub.refresh(eventReason(request), token), env));
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
    if (!env.OPS_GITHUB_TOKEN) return;
    ctx.waitUntil(env.OPS_STATE.getByName('global').refresh(`cron:${controller.cron}`));
  },
};
